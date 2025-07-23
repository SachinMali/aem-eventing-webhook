var express = require('express');
var path = require('path');
var logger = require('morgan');
var bodyParser = require('body-parser');
var debug = require('debug')('webhook-server:server');
var rateLimit = require('express-rate-limit');
var helmet = require('helmet');

var app = express();
var port = normalizePort(process.env.PORT || '3000');
app.set('port', port);
var server = require('http').Server(app);
var io = require('socket.io')(server);

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://maxcdn.bootstrapcdn.com"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://code.jquery.com", "https://ajax.aspnetcdn.com", "https://maxcdn.bootstrapcdn.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "wss:", "ws:"]
    }
  }
}));

app.use(logger('dev'));
app.use(bodyParser.json({type: 'application/cloudevents+json'}));
app.use(bodyParser.urlencoded({ extended: false }));

// Rate limiting configuration
var webhookLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs (Adobe I/O friendly)
  message: {
    error: 'Too many webhook requests from this IP, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  keyGenerator: function(req) {
    // Handle Azure App Service proxy IP addresses
    var ip = req.ip || req.connection.remoteAddress;
    // Remove port number if present (e.g., "192.150.10.204:36061" -> "192.150.10.204")
    var cleanIp = ip ? ip.split(':')[0] : 'unknown';
    
    // Check if it's likely Adobe I/O (you can add known Adobe IP ranges here)
    var isAdobeIO = req.headers['user-agent'] && 
                   (req.headers['user-agent'].includes('Adobe') || 
                    req.headers['user-agent'].includes('adobe'));
    
    // Use different keys for Adobe I/O vs others for potential different limits
    return isAdobeIO ? 'adobe-io-' + cleanIp : cleanIp;
  },
  handler: function(req, res) {
    var isAdobeIO = req.headers['user-agent'] && 
                   (req.headers['user-agent'].includes('Adobe') || 
                    req.headers['user-agent'].includes('adobe'));
    
    console.log('Rate limit exceeded for IP:', req.ip, 
                isAdobeIO ? '(Adobe I/O)' : '(Other)');
    res.status(429).json({
      error: 'Too many webhook requests from this IP, please try again later.',
      retryAfter: '15 minutes'
    });
  }
});

// HTTPS enforcement for production (Azure)
if (process.env.NODE_ENV === 'production') {
  app.use(function(req, res, next) {
    if (req.headers['x-forwarded-proto'] !== 'https') {
      return res.redirect('https://' + req.headers.host + req.url);
    }
    next();
  });
}

app.use(function (req, res, next) {
    next();
});

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// Health check endpoint for Azure
app.get('/health', function(req, res) {
  res.status(200).json({
    status: 'OK',
    message: 'AEM Eventing Webhook Service is running',
    timestamp: new Date().toISOString(),
    nodeVersion: process.version,
    platform: process.platform
  });
});

/* Here we process the request to make a payload object. This payload object is emitted to
 * the UI and placed into a fixed template using io.sockets.
 * Please note the return line. That is required for when you register for a new webhook.
 * Event Gateway will send you a challenge (it will be a GET), and expects you to extract the
 * challenge string and send it back. Without this step. your webhook will fail to register.
*/
app.use('/webhook', webhookLimiter, function(req, res) {

  // Handle Adobe webhook challenge (GET request with challenge query parameter)
  if (req.query.challenge) {
    console.log('Adobe webhook challenge received:', req.query.challenge);
    
    var payload = {
      headers : req.headers || {},
      params : req.params || {},
      query : req.query,
      path: req.path,
      protocol : req.protocol,
      method: req.method,
      body : req.body,
      time : new Date()
    };

    io.sockets.emit('webhookEvent:' + req.path.replace('/', ''), payload);
    io.sockets.emit('webhookEvent:all', payload);

    // handle the challenge
    return res.send(req.query.challenge);
  }

  // AEM Event Validation - check for Adobe headers
  var adobeHeaders = [
    'x-adobe-provider',
    'x-adobe-event-id', 
    'x-adobe-event-code'
  ];

  var hasAdobeHeaders = adobeHeaders.some(function(header) {
    return req.headers[header];
  });

  if (!hasAdobeHeaders) {
    console.log('Rejected non-AEM event - missing Adobe headers from IP:', req.ip);
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Only AEM events are accepted'
    });
  }

  // Valid AEM event - process normally
  var payload = {
    headers : req.headers || {},
		params : req.params || {},
		query : req.query,
		path: req.path,
		protocol : req.protocol,
		method: req.method,
		body : req.body,
		time : new Date()
	};

  io.sockets.emit('webhookEvent:' + req.path.replace('/', ''), payload);
  io.sockets.emit('webhookEvent:all', payload);

  // Send success response
  res.status(200).json({
    success: true,
    message: 'AEM event received successfully'
  });

});

io.on('connection', function (socket) {
  socket.emit('welcome', {});  
});

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handlers
app.use(function(err, req, res, next) {
  res.status(err.status || 500);
  res.send({
    message: err.message,
    error: {}
  });
});

module.exports = app;


/**
 * Listen on provided port, on all network interfaces.
 */

server.listen(port);
server.on('error', onError);
server.on('listening', onListening);

/**
 * Normalize a port into a number, string, or false.
 */

function normalizePort(val) {
  var port = parseInt(val, 10);

  if (isNaN(port)) {
    // named pipe
    return val;
  }

  if (port >= 0) {
    // port number
    return port;
  }

  return false;
}

/**
 * Event listener for HTTP server "error" event.
 */

function onError(error) {
  if (error.syscall !== 'listen') {
    throw error;
  }

  var bind = typeof port === 'string'
    ? 'Pipe ' + port
    : 'Port ' + port;

  // handle specific listen errors with friendly messages
  switch (error.code) {
    case 'EACCES':
      console.error(bind + ' requires elevated privileges');
      process.exit(1);
      break;
    case 'EADDRINUSE':
      console.error(bind + ' is already in use');
      process.exit(1);
      break;
    default:
      throw error;
  }
}

/**
 * Event listener for HTTP server "listening" event.
 */

function onListening() {
  var addr = server.address();
  var bind = typeof addr === 'string'
    ? 'pipe ' + addr
    : 'port ' + addr.port;
  debug('Listening on ' + bind);
}
