# AEM Eventing Webhook

A simple webhook service to test Adobe Experience Manager (AEM) eventing via Adobe I/O and Adobe Developer Console project.

## Features

- **Webhook Endpoint**: Receives and processes AEM events
- **Real-time Updates**: Uses Socket.IO for real-time event broadcasting
- **Health Monitoring**: Built-in health check endpoint
- **Event Processing**: Handles various AEM event types (page modifications, asset changes)
- **Challenge Response**: Supports Adobe I/O webhook registration challenges

## Prerequisites

- Node.js (v22 LTS or higher)
- npm (v10 or higher)

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd aem-eventing-webhook
```

2. Install dependencies:
```bash
npm install
```

## Usage

### Starting the Server

```bash
npm start
```

Or directly with Node.js:
```bash
node app.js
```

The server will start on port 3000 by default. You can change this by setting the `PORT` environment variable.

### Available Endpoints

- **GET /** - Service information and available endpoints
- **GET /health** - Health check endpoint
- **POST /webhook** - Main webhook endpoint for receiving AEM events

### Webhook Registration

When registering your webhook with Adobe I/O, use:
```
http://your-domain:3000/webhook
```

The service automatically handles the challenge-response mechanism required for webhook registration.

### Supported Event Types

The webhook can process various AEM event types:
- `page.modified` - Page modification events
- `asset.created` - Asset creation events
- `asset.modified` - Asset modification events
- `asset.deleted` - Asset deletion events

## Development

### Project Structure

```
aem-eventing-webhook/
├── app.js              # Main application file
├── package.json        # Dependencies and scripts
├── public/             # Static files
│   ├── index.html      # Web interface
│   ├── stylesheets/    # CSS files
│   └── javascripts/    # Client-side JavaScript
├── views/              # Server-side templates
└── README.md           # This file
```

### Environment Variables

- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Environment mode (development/production)

## Testing

### Health Check
```bash
curl http://localhost:3000/health
```

### Webhook Test
```bash
curl -X POST http://localhost:3000/webhook \
  -H "Content-Type: application/json" \
  -d '{"eventType": "page.modified", "data": {"page": "/content/test"}}'
```

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## Support

For issues and questions, please create an issue in the repository.