module.exports = {
  // Server configuration
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // Azure App Service configuration
  trustProxy: process.env.NODE_ENV === 'production',
  
  // Rate limiting configuration
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX) || 100, // requests per window
    webhookMax: parseInt(process.env.WEBHOOK_RATE_LIMIT_MAX) || 50 // webhook requests per window
  },
  
  // Application Insights
  appInsights: {
    connectionString: process.env.APPLICATIONINSIGHTS_CONNECTION_STRING,
    enabled: !!process.env.APPLICATIONINSIGHTS_CONNECTION_STRING
  },
  
  // Security
  security: {
    enableHttpsRedirect: process.env.NODE_ENV === 'production',
    enableHsts: process.env.NODE_ENV === 'production'
  },
  
  // CORS configuration
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    credentials: process.env.CORS_CREDENTIALS === 'true'
  },
  
  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    enableMorgan: process.env.ENABLE_MORGAN !== 'false'
  }
}; 