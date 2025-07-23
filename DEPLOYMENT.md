# Azure App Service Deployment Guide

This guide will help you deploy the AEM Eventing Webhook to Azure App Service.

## Prerequisites

- Azure subscription
- Azure CLI installed (optional, for command line deployment)
- Git repository with your code
- Node.js 22 LTS (for local development)

## Deployment Options

### Option 1: Azure Portal (Recommended for beginners)

1. **Create App Service**
   - Go to Azure Portal
   - Create a new "Web App"
       - Choose Node.js 22 LTS as the runtime stack
   - Select your subscription and resource group
   - Choose a unique app name
   - Select your region

2. **Configure App Settings**
   - Go to Configuration > Application settings
   - Add these environment variables:
     ```
     NODE_ENV=production
     PORT=8080 (Azure App Service uses 8080 by default)
     ```

3. **Deploy Code**
   - Go to Deployment Center
   - Choose your deployment source (GitHub, Azure Repos, etc.)
   - Connect your repository
   - Deploy

### Option 2: Azure CLI

```bash
# Login to Azure
az login

# Create resource group (if not exists)
az group create --name myResourceGroup --location eastus

# Create App Service plan
az appservice plan create --name myAppServicePlan --resource-group myResourceGroup --sku B1 --is-linux

# Create web app
az webapp create --resource-group myResourceGroup --plan myAppServicePlan --name my-aem-webhook --runtime "NODE|22-lts"

# Configure app settings
az webapp config appsettings set --resource-group myResourceGroup --name my-aem-webhook --settings NODE_ENV=production

# Deploy from local git
az webapp deployment source config-local-git --resource-group myResourceGroup --name my-aem-webhook
```

### Option 3: GitHub Actions (CI/CD)

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Azure App Service

on:
  push:
    branches: [ main ]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Set up Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        
    - name: Install dependencies
      run: npm ci
      
    - name: Deploy to Azure
      uses: azure/webapps-deploy@v2
      with:
        app-name: 'your-app-name'
        publish-profile: ${{ secrets.AZURE_WEBAPP_PUBLISH_PROFILE }}
```

## Configuration

### Environment Variables

Set these in Azure App Service Configuration:

#### Required Variables:
- `NODE_ENV=production`
- `PORT=8080` (Azure App Service default)
- `WEBSITE_NODE_DEFAULT_VERSION=22.17.0`

#### Application Insights (Recommended):
- `APPLICATIONINSIGHTS_CONNECTION_STRING=your_connection_string_here`

#### Rate Limiting (Optional):
- `RATE_LIMIT_MAX=100` (default: 100 requests per 15 minutes)
- `WEBHOOK_RATE_LIMIT_MAX=50` (default: 50 webhook requests per 15 minutes)

#### CORS Configuration (Optional):
- `CORS_ORIGIN=*` (default: allow all origins)
- `CORS_CREDENTIALS=false` (default: false)

#### Logging (Optional):
- `LOG_LEVEL=info` (default: info)
- `ENABLE_MORGAN=true` (default: true)

#### AEM Event Validation (Optional):
- `AEM_VALIDATION_ENABLED=true` (default: true)

### Webhook URL

After deployment, your webhook URL will be:
```
https://your-app-name.azurewebsites.net/webhook
```

## Monitoring

### Application Insights (Recommended)

1. Create Application Insights resource
2. Add to your App Service
3. Monitor webhook events and performance

### Logs

- **Application Logs**: Go to App Service > Logs > Application Logs
- **Web Server Logs**: Go to App Service > Logs > Web Server Logs

## Troubleshooting

### Common Issues

1. **Port Issues**: Azure App Service uses port 8080, not 3000
2. **Node Version**: Ensure you're using Node.js 22 LTS
3. **Web.config**: Make sure web.config is in the root directory
4. **Dependencies**: Run `npm install --production` in deployment

### Health Check

Test your deployment:
```bash
curl https://your-app-name.azurewebsites.net/health
```

### Webhook Test

Test webhook functionality:
```bash
curl -X POST https://your-app-name.azurewebsites.net/webhook \
  -H "Content-Type: application/json" \
  -d '{"eventType": "page.modified", "data": {"page": "/content/test"}}'
```

## Security Considerations

1. **HTTPS Only**: Azure App Service provides HTTPS by default, and the app enforces HTTPS redirects in production
2. **Rate Limiting**: Implemented with configurable limits (100 requests/15min general, 50 webhook requests/15min)
3. **Security Headers**: Helmet.js provides comprehensive security headers including HSTS
4. **Input Validation**: Validate all incoming webhook data
5. **Authentication**: Consider adding authentication for production (not implemented in this version)

## Scaling

- **Basic Plan**: Good for development/testing
- **Standard Plan**: Better for production with auto-scaling
- **Premium Plan**: For high-traffic applications

## Cost Optimization

- Use Basic plan for development
- Scale down during off-hours
- Monitor usage in Azure Cost Management 