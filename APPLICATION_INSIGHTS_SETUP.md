# Application Insights Setup Guide

This guide will help you set up Azure Application Insights for monitoring your AEM Eventing Webhook.

## Prerequisites

- Azure subscription
- Access to Azure Portal

## Step 1: Create Application Insights Resource

1. **Go to Azure Portal**
   - Navigate to [portal.azure.com](https://portal.azure.com)
   - Click "Create a resource"

2. **Search for Application Insights**
   - Search for "Application Insights"
   - Select "Application Insights" from the results

3. **Configure Application Insights**
   - **Resource Group**: Select your existing resource group or create a new one
   - **Name**: Enter a unique name (e.g., `aem-webhook-insights`)
   - **Region**: Choose the same region as your App Service
   - **Resource Mode**: Select "Workspace-based"
   - **Workspace**: Create a new Log Analytics workspace or use existing
   - Click "Review + create" then "Create"

## Step 2: Get Connection String

1. **Navigate to your Application Insights resource**
   - Go to the Application Insights resource you just created

2. **Copy Connection String**
   - In the left menu, click "Configure" > "Connection strings"
   - Copy the "Connection string" value
   - It will look like: `InstrumentationKey=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx;IngestionEndpoint=https://...`

## Step 3: Configure App Service

1. **Go to your App Service**
   - Navigate to your Azure App Service

2. **Add Application Settings**
   - Go to "Configuration" > "Application settings"
   - Click "New application setting"
   - **Name**: `APPLICATIONINSIGHTS_CONNECTION_STRING`
   - **Value**: Paste the connection string from Step 2
   - Click "OK" then "Save"

3. **Restart App Service**
   - Click "Restart" to apply the changes

## Step 4: Verify Setup

1. **Check Application Insights**
   - Go back to your Application Insights resource
   - In the left menu, click "Live Metrics"
   - You should see your app service sending data

2. **Test Webhook**
   - Send a test webhook request to your endpoint
   - Check "Application map" to see the request flow
   - Check "Logs" to see custom events

## What's Being Tracked

### Automatic Collection
- HTTP requests and responses
- Performance metrics
- Exceptions and errors
- Dependencies (database calls, HTTP requests)
- Console logs

### Custom Events
- **WebhookEventReceived**: When a webhook is received
  - Properties: eventType, source, ip, method
- **WebhookProcessed**: Successful webhook processing
  - Properties: duration, resultCode, success
- **WebhookError**: Failed webhook processing
  - Properties: duration, resultCode, success, exception

## Monitoring Dashboard

### Key Metrics to Monitor
1. **Request Rate**: Number of webhook requests per minute
2. **Response Time**: Average time to process webhooks
3. **Error Rate**: Percentage of failed webhook requests
4. **Availability**: Uptime percentage

### Creating Custom Dashboards
1. Go to Application Insights > "Dashboards"
2. Click "New dashboard"
3. Add widgets for:
   - Request rate
   - Response time
   - Error rate
   - Custom events

## Alerts

### Set Up Alerts
1. Go to Application Insights > "Alerts"
2. Click "New alert rule"
3. Configure alerts for:
   - High error rate (>5%)
   - Slow response time (>5 seconds)
   - High request rate (unusual traffic)

### Example Alert Rules
```json
{
  "name": "High Webhook Error Rate",
  "condition": {
    "operator": "GreaterThan",
    "threshold": 5,
    "metric": "Failed requests percentage"
  },
  "action": {
    "type": "Email",
    "recipients": ["your-email@domain.com"]
  }
}
```

## Troubleshooting

### Common Issues

1. **No Data Appearing**
   - Check connection string is correct
   - Verify App Service is restarted
   - Check if Application Insights is enabled

2. **Missing Custom Events**
   - Verify environment variable is set
   - Check console logs for "Application Insights initialized"
   - Ensure webhook endpoint is being called

3. **Performance Issues**
   - Application Insights adds minimal overhead
   - If issues occur, check sampling settings

### Debug Mode
To enable debug logging, add this environment variable:
```
APPLICATIONINSIGHTS_LOGGINGLEVEL=debug
```

## Cost Optimization

### Sampling
Application Insights uses sampling to reduce costs:
- Default: 100% sampling (all data)
- Adjust in Application Insights settings if needed

### Data Retention
- Default: 90 days
- Can be reduced to 30 days to save costs
- Configure in Application Insights settings

## Next Steps

1. **Set up alerts** for critical metrics
2. **Create dashboards** for monitoring
3. **Configure log analytics** for advanced queries
4. **Set up Power BI** integration for custom reports 