# Nexus Backend Setup Guide

This guide will help you set up the Nexus backend API for development and production.

## 📋 Prerequisites

- Node.js 18.0 or higher
- MongoDB 4.4 or higher
- Git
- Code editor (VS Code recommended)

## 🚀 Quick Setup

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Environment Configuration

```bash
# Copy environment template
cp .env.example .env

# Edit the .env file with your configuration
nano .env  # or use your preferred editor
```

### 3. Database Setup

#### Option A: Local MongoDB

```bash
# Start MongoDB service
sudo systemctl start mongod

# Or run directly
mongod
```

#### Option B: MongoDB Atlas (Cloud)

1. Create a free account at [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create a new cluster
3. Get your connection string
4. Update `MONGODB_URI` in your `.env` file

#### Option C: Docker

```bash
# Pull and run MongoDB container
docker run -d -p 27017:27017 --name mongodb mongo:latest

# With persistent volume
docker run -d -p 27017:27017 --name mongodb -v mongodb_data:/data/db mongo:latest
```

### 4. External Services Setup

#### Cloudinary (File Storage)

1. Sign up at [Cloudinary](https://cloudinary.com)
2. Get your API credentials from the dashboard
3. Update environment variables:
   ```env
   CLOUDINARY_CLOUD_NAME=your_cloud_name
   CLOUDINARY_API_KEY=your_api_key
   CLOUDINARY_API_SECRET=your_api_secret
   ```

#### Stripe (Payments)

1. Create account at [Stripe](https://stripe.com)
2. Get test keys from the dashboard
3. Update environment variables:
   ```env
   STRIPE_SECRET_KEY=sk_test_your_secret_key
   STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key
   ```

#### Email Service (Nodemailer)

##### Option A: Gmail

1. Enable 2-factor authentication on your Gmail account
2. Generate an app password
3. Update environment variables:
   ```env
   EMAIL_HOST=smtp.gmail.com
   EMAIL_PORT=587
   EMAIL_USER=your_email@gmail.com
   EMAIL_PASS=your_app_password
   ```

##### Option B: SendGrid

1. Create account at [SendGrid](https://sendgrid.com)
2. Generate an API key
3. Update environment variables:
   ```env
   EMAIL_HOST=smtp.sendgrid.net
   EMAIL_PORT=587
   EMAIL_USER=apikey
   EMAIL_PASS=your_sendgrid_api_key
   ```

### 5. Start the Server

```bash
# Development mode with auto-restart
npm run dev

# Production mode
npm start
```

The server will start on `http://localhost:5000`

## 🔧 Development Setup

### VS Code Configuration

Create `.vscode/settings.json`:

```json
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "files.exclude": {
    "**/node_modules": true,
    "**/logs": true
  }
}
```

Create `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug Server",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/server.js",
      "env": {
        "NODE_ENV": "development"
      },
      "console": "integratedTerminal",
      "restart": true,
      "runtimeExecutable": "nodemon"
    }
  ]
}
```

### Database Seeding (Optional)

Create a seed script to populate initial data:

```javascript
// scripts/seed.js
import mongoose from 'mongoose';
import User from '../src/models/User.js';
import dotenv from 'dotenv';

dotenv.config();

const seedData = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Create sample users
    const users = [
      {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        password: 'SecurePass123',
        role: 'investor',
        bio: 'Experienced angel investor'
      },
      {
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane.smith@example.com',
        password: 'SecurePass123',
        role: 'entrepreneur',
        bio: 'Tech startup founder'
      }
    ];

    await User.insertMany(users);
    console.log('Sample users created');

    process.exit(0);
  } catch (error) {
    console.error('Seeding error:', error);
    process.exit(1);
  }
};

seedData();
```

Run the seed script:

```bash
node scripts/seed.js
```

## 🧪 Testing Setup

### Unit Tests

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

### API Testing

#### Using Postman

1. Import the Postman collection from `docs/Postman-Collection.json`
2. Set the `baseUrl` variable to `http://localhost:5000/api/v1`
3. Run the "Register User" request to get a token
4. The token will be automatically stored in the `authToken` variable

#### Using curl

```bash
# Register user
curl -X POST http://localhost:5000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "John",
    "lastName": "Doe", 
    "email": "john@example.com",
    "password": "SecurePass123",
    "role": "investor"
  }'

# Login
curl -X POST http://localhost:5000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "SecurePass123"
  }'
```

## 🚀 Production Deployment

### Environment Preparation

1. **Set production environment variables:**
   ```env
   NODE_ENV=production
   PORT=5000
   MONGODB_URI=mongodb://your-production-db
   JWT_SECRET=your-production-secret
   ```

2. **Install production dependencies only:**
   ```bash
   npm ci --only=production
   ```

### Docker Deployment

Create `Dockerfile`:

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY . .

# Create logs directory
RUN mkdir -p logs

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:5000/health || exit 1

# Start application
CMD ["npm", "start"]
```

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  nexus-backend:
    build: .
    ports:
      - "5000:5000"
    environment:
      - NODE_ENV=production
      - MONGODB_URI=mongodb://mongodb:27017/nexus
    depends_on:
      - mongodb
    restart: unless-stopped

  mongodb:
    image: mongo:latest
    ports:
      - "27017:27017"
    volumes:
      - mongodb_data:/data/db
    restart: unless-stopped

volumes:
  mongodb_data:
```

Deploy with Docker:

```bash
# Build and start services
docker-compose up -d

# View logs
docker-compose logs -f nexus-backend

# Stop services
docker-compose down
```

### Platform Deployment

#### Render

1. Connect your GitHub repository to Render
2. Create a new Web Service
3. Set build command: `npm install`
4. Set start command: `npm start`
5. Add environment variables
6. Deploy

#### Railway

1. Install Railway CLI: `npm install -g @railway/cli`
2. Login: `railway login`
3. Deploy: `railway up`
4. Configure environment variables in Railway dashboard

#### AWS (EC2)

1. Launch EC2 instance (Ubuntu 20.04 LTS)
2. Install Node.js and MongoDB
3. Clone your repository
4. Install dependencies and configure environment
5. Use PM2 for process management:
   ```bash
   npm install -g pm2
   pm2 start server.js --name nexus-backend
   pm2 startup
   pm2 save
   ```

## 🔍 Monitoring and Logging

### Application Logs

Logs are stored in the `logs/` directory:

- `combined.log` - All application logs
- `error.log` - Error logs only

View logs:

```bash
# View real-time logs
tail -f logs/combined.log

# View error logs
tail -f logs/error.log

# View with PM2 (if using PM2)
pm2 logs nexus-backend
```

### Health Monitoring

The health check endpoint provides system status:

```bash
curl http://localhost:5000/health
```

### Performance Monitoring

Consider integrating with:

- **New Relic** - APM and monitoring
- **Datadog** - Infrastructure and application monitoring
- **Sentry** - Error tracking and performance

## 🔒 Security Best Practices

### Environment Security

1. **Never commit `.env` files** to version control
2. **Use strong, unique secrets** for production
3. **Rotate secrets regularly**
4. **Use different secrets** for different environments

### Database Security

1. **Enable MongoDB authentication**
2. **Use SSL/TLS connections**
3. **Implement database backups**
4. **Monitor database access**

### API Security

1. **Enable HTTPS in production**
2. **Implement rate limiting**
3. **Validate all inputs**
4. **Use CORS properly**
5. **Keep dependencies updated**

## 🐛 Troubleshooting

### Common Issues

#### Database Connection Failed

```bash
# Check MongoDB status
sudo systemctl status mongod

# Check connection string
mongosh "mongodb://localhost:27017/nexus"

# View MongoDB logs
sudo tail -f /var/log/mongodb/mongod.log
```

#### Port Already in Use

```bash
# Find process using port 5000
lsof -i :5000

# Kill process
kill -9 <PID>

# Or use different port
PORT=5001 npm start
```

#### Module Not Found

```bash
# Clear npm cache
npm cache clean --force

# Delete node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

#### Permission Issues

```bash
# Fix file permissions
chmod +x server.js

# Fix log directory permissions
sudo chown -R $USER:$USER logs/
```

### Debug Mode

Enable debug logging:

```bash
DEBUG=nexus:* npm run dev
```

### Performance Issues

1. **Check memory usage:**
   ```bash
   node --inspect server.js
   ```

2. **Monitor with PM2:**
   ```bash
   pm2 monit
   ```

3. **Profile with clinic.js:**
   ```bash
   npm install -g clinic
   clinic doctor -- node server.js
   ```

## 📚 Additional Resources

- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)
- [Express.js Guide](https://expressjs.com/en/guide/)
- [MongoDB Documentation](https://docs.mongodb.com/)
- [Socket.IO Documentation](https://socket.io/docs/)
- [Stripe API Documentation](https://stripe.com/docs/api)

## 🆘 Support

If you encounter issues:

1. Check the logs for error messages
2. Review this troubleshooting guide
3. Search existing GitHub issues
4. Create a new issue with detailed information
5. Contact support at support@nexus.com

## 🔄 Updates and Maintenance

### Dependency Updates

```bash
# Check for outdated packages
npm outdated

# Update packages
npm update

# Audit for security vulnerabilities
npm audit
npm audit fix
```

### Database Maintenance

```bash
# Backup database
mongodump --db nexus --out backup/

# Restore database
mongorestore backup/nexus

# Compact database
mongosh nexus --eval "db.runCommand({compact: 'users'})"
```

### Log Rotation

Configure log rotation in production:

```bash
# Install logrotate
sudo apt-get install logrotate

# Create logrotate config
sudo nano /etc/logrotate.d/nexus-backend
```

Config file content:

```
/path/to/nexus-backend/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 0644 www-data www-data
    postrotate
        pm2 reloadLogs
    endscript
}
```
