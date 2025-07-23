const express = require('express');
const path = require('path');
const logger = require('morgan');
const bodyParser = require('body-parser');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const debug = require('debug')('webhook-server:server');

// Application Insights setup
let appInsights = null;
if (process.env.APPLICATIONINSIGHTS_CONNECTION_STRING) {
  appInsights = require('applicationinsights');
  appInsights.setup(process.env.APPLICATIONINSIGHTS_CONNECTION_STRING)
    .setAutoDependencyCorrelation(true)
    .setAutoCollectRequests(true)
    .setAutoCollectPerformance(true)
    .setAutoCollectExceptions(true)
    .setAutoCollectDependencies(true)
    .setAutoCollectConsole(true)
    .setUseDiskRetryCaching(true)
    .start();
  
  console.log('Application Insights initialized');
}

const app = express();
const port = normalizePort(process.env.PORT || '3000');
app.set('port', port);

// Azure App Service configuration
app.set('trust proxy', 1); // Trust first proxy (Azure App Service)

const server = require('http').Server(app);
const io = require('socket.io')(server);

// HTTPS enforcement middleware (for production)
if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    // Check if the request is coming through HTTPS
    if (req.headers['x-forwarded-proto'] !== 'https' && req.headers['x-forwarded-proto'] !== 'https') {
      return res.redirect(`https://${req.headers.host}${req.url}`);
    }
    next();
  });
}

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://maxcdn.bootstrapcdn.com"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://code.jquery.com", "https://ajax.aspnetcdn.com", "https://maxcdn.bootstrapcdn.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "wss:", "ws:"]
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Apply rate limiting to all requests
app.use(limiter);

// Webhook-specific rate limiting (more restrictive)
const webhookLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // limit each IP to 50 webhook requests per windowMs
  message: {
    error: 'Too many webhook requests from this IP, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Middleware
app.use(cors());
app.use(logger('dev'));
app.use(bodyParser.json({type: 'application/cloudevents+json'}));
app.use(bodyParser.urlencoded({ extended: false }));

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'AEM Eventing Webhook Service is running',
    timestamp: new Date().toISOString()
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'AEM Eventing Webhook Service',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      webhook: '/webhook'
    }
  });
});

/* Here we process the request to make a payload object. This payload object is emitted to
 * the UI and placed into a fixed template using io.sockets.
 * Please note the return line. That is required for when you register for a new webhook.
 * Event Gateway will send you a challenge (it will be a GET), and expects you to extract the
 * challenge string and send it back. Without this step. your webhook will fail to register.
*/
app.use('/webhook', webhookLimiter, function(req, res) {
  const startTime = Date.now();
  
  try {
    const payload = {
      headers: req.headers || {},
      params: req.params || {},
      query: req.query,
      path: req.path,
      protocol: req.protocol,
      method: req.method,
      body: req.body,
      time: new Date()
    };

    console.log('Received webhook event:', JSON.stringify(payload, null, 2));

    // Track webhook event in Application Insights
    if (appInsights) {
      const client = appInsights.defaultClient;
      client.trackEvent({
        name: 'WebhookEventReceived',
        properties: {
          eventType: req.body?.eventType || 'unknown',
          source: req.headers['user-agent'] || 'unknown',
          ip: req.ip,
          method: req.method
        }
      });
    }

    // Emit to socket.io for real-time updates
    io.sockets.emit('webhookEvent:' + req.path.replace('/', ''), payload);
    io.sockets.emit('webhookEvent:all', payload);

    // Handle the challenge for webhook registration
    if (req.query.challenge) {
      return res.send(req.query.challenge);
    }

    // Process AEM events
    if (req.body && req.body.eventType) {
      switch (req.body.eventType) {
        case 'page.modified':
          console.log('Page modified event received');
          break;
        case 'asset.created':
          console.log('Asset created event received');
          break;
        case 'asset.modified':
          console.log('Asset modified event received');
          break;
        case 'asset.deleted':
          console.log('Asset deleted event received');
          break;
        default:
          console.log(`Unknown event type: ${req.body.eventType}`);
      }
    }

    // Track successful processing
    if (appInsights) {
      const client = appInsights.defaultClient;
      const duration = Date.now() - startTime;
      client.trackRequest({
        name: 'WebhookProcessed',
        url: req.url,
        duration: duration,
        resultCode: 200,
        success: true
      });
    }

    // Send success response
    res.status(200).json({
      success: true,
      message: 'Webhook event processed successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error processing webhook:', error);
    
    // Track error in Application Insights
    if (appInsights) {
      const client = appInsights.defaultClient;
      const duration = Date.now() - startTime;
      client.trackRequest({
        name: 'WebhookError',
        url: req.url,
        duration: duration,
        resultCode: 500,
        success: false
      });
      client.trackException({
        exception: error
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Error processing webhook event',
      error: error.message
    });
  }
});

io.on('connection', function (socket) {
  socket.emit('welcome', {});  
});

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  const err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handlers
app.use(function(err, req, res, next) {
  console.error('Error:', err);
  res.status(err.status || 500);
  res.json({
    success: false,
    message: err.message,
    error: process.env.NODE_ENV === 'development' ? err.stack : {}
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
  const addr = server.address();
  const bind = typeof addr === 'string'
    ? 'pipe ' + addr
    : 'port ' + addr.port;
  debug('Listening on ' + bind);
  console.log(`🚀 AEM Eventing Webhook Service running on port ${addr.port}`);
  console.log(`📊 Health check: http://localhost:${addr.port}/health`);
  console.log(`🔗 Webhook endpoint: http://localhost:${addr.port}/webhook`);
}
