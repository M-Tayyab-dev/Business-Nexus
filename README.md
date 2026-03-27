# Nexus Backend API

A production-ready backend for the Nexus Investor & Entrepreneur Collaboration Platform built with Node.js, Express, MongoDB, and Socket.IO.

## 🚀 Features

- **🔐 Authentication & Authorization**: JWT-based auth with role-based access control
- **📅 Meeting Scheduling**: Conflict detection, recurring meetings, and real-time updates
- **📹 Video Calling**: WebRTC signaling server with Socket.IO
- **📄 Document Management**: Cloud storage, e-signatures, and version control
- **💳 Payment System**: Stripe integration with mock mode for development
- **🔒 Security**: Rate limiting, input validation, XSS protection, and more
- **📊 Analytics**: Transaction and meeting statistics
- **📧 Email Notifications**: OTP, meeting invitations, and payment alerts

## 🛠️ Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT with bcrypt password hashing
- **Real-time**: Socket.IO for video calling signaling
- **File Storage**: Cloudinary
- **Payments**: Stripe (test mode)
- **Email**: Nodemailer
- **Validation**: Joi
- **Security**: Helmet, CORS, Rate Limiting, Input Sanitization

## 📋 Prerequisites

- Node.js 18.0 or higher
- MongoDB 4.4 or higher
- Redis (optional, for session storage)
- Cloudinary account (for file storage)
- Stripe account (for payments)
- Email service (Gmail, SendGrid, etc.)

## 🚀 Quick Start

### 1. Clone and Install

```bash
cd backend
npm install
```

### 2. Environment Setup

Copy the environment template:

```bash
cp .env.example .env
```

Configure your environment variables:

```env
# Server Configuration
NODE_ENV=development
PORT=5000
API_VERSION=v1

# Database Configuration
MONGODB_URI=mongodb://localhost:27017/nexus

# JWT Configuration
JWT_SECRET=your_super_secret_jwt_key_here
JWT_EXPIRE=7d
JWT_REFRESH_SECRET=your_refresh_token_secret_here
JWT_REFRESH_EXPIRE=30d

# Email Configuration
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
FROM_EMAIL=noreply@nexus.com
FROM_NAME=Nexus Platform

# Cloud Storage (Cloudinary)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# CORS Configuration
FRONTEND_URL=http://localhost:3000
ALLOWED_ORIGINS=http://localhost:3000

# Security
BCRYPT_ROUNDS=12
```

### 3. Database Setup

Start MongoDB:

```bash
# Using MongoDB Community Server
mongod

# Or using Docker
docker run -d -p 27017:27017 --name mongodb mongo:latest
```

### 4. Start the Server

```bash
# Development mode
npm run dev

# Production mode
npm start
```

The server will start on `http://localhost:5000`

## 📁 Project Structure

```
backend/
├── src/
│   ├── config/           # Database and service configurations
│   ├── controllers/      # Route controllers
│   ├── middleware/       # Custom middleware
│   ├── models/          # Mongoose models
│   ├── routes/          # API routes
│   ├── services/        # Business logic services
│   ├── utils/           # Utility functions
│   └── validators/      # Input validation schemas
├── docs/                # API documentation
├── logs/                # Application logs
├── uploads/             # Temporary file uploads
├── .env.example         # Environment template
├── package.json         # Dependencies and scripts
├── README.md           # This file
└── server.js           # Application entry point
```

## 🔐 API Endpoints

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/auth/register` | Register new user |
| POST | `/api/v1/auth/login` | User login |
| POST | `/api/v1/auth/refresh-token` | Refresh JWT token |
| POST | `/api/v1/auth/verify-email` | Verify email address |
| POST | `/api/v1/auth/request-password-reset` | Request password reset |
| POST | `/api/v1/auth/reset-password` | Reset password |
| POST | `/api/v1/auth/change-password` | Change password |
| GET | `/api/v1/auth/profile` | Get user profile |
| PUT | `/api/v1/auth/profile` | Update user profile |
| POST | `/api/v1/auth/enable-2fa` | Enable 2FA |
| POST | `/api/v1/auth/logout` | User logout |

### Meetings

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/meetings` | Create meeting |
| GET | `/api/v1/meetings` | Get user meetings |
| GET | `/api/v1/meetings/:id` | Get single meeting |
| PUT | `/api/v1/meetings/:id` | Update meeting |
| POST | `/api/v1/meetings/:id/respond` | Respond to invitation |
| POST | `/api/v1/meetings/:id/participants` | Add participant |
| DELETE | `/api/v1/meetings/:id/participants/:participantId` | Remove participant |
| DELETE | `/api/v1/meetings/:id` | Cancel meeting |
| GET | `/api/v1/meetings/conflicts` | Check scheduling conflicts |
| GET | `/api/v1/meetings/stats` | Get meeting statistics |

### Video Calls

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/video-calls/active-rooms` | Get active rooms |
| GET | `/api/v1/video-calls/rooms/:meetingId/participants` | Get room participants |
| POST | `/api/v1/video-calls/rooms/:meetingId/link` | Generate meeting link |
| POST | `/api/v1/video-calls/rooms/:meetingId/end` | End meeting |

### Documents

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/documents` | Upload document |
| GET | `/api/v1/documents` | Get user documents |
| GET | `/api/v1/documents/:id` | Get single document |
| PUT | `/api/v1/documents/:id` | Update document |
| DELETE | `/api/v1/documents/:id` | Delete document |
| POST | `/api/v1/documents/:id/share` | Share document |
| POST | `/api/v1/documents/:id/signatures/request` | Request signature |
| POST | `/api/v1/documents/:id/sign` | Sign document |
| GET | `/api/v1/documents/:id/versions` | Get document versions |
| GET | `/api/v1/documents/:id/download` | Download document |
| GET | `/api/v1/documents/stats` | Get document statistics |

### Transactions

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/transactions/payment-intent` | Create payment intent |
| POST | `/api/v1/transactions` | Create transaction |
| POST | `/api/v1/transactions/:id/process` | Process payment |
| GET | `/api/v1/transactions` | Get user transactions |
| GET | `/api/v1/transactions/:id` | Get single transaction |
| PUT | `/api/v1/transactions/:id` | Update transaction |
| POST | `/api/v1/transactions/:id/refund` | Refund transaction |
| GET | `/api/v1/transactions/stats` | Get transaction statistics |
| GET | `/api/v1/transactions/wallet/balance` | Get wallet balance |

## 🔌 Socket.IO Events

### Video Calling

| Event | Description |
|-------|-------------|
| `join-room` | Join a meeting room |
| `leave-room` | Leave a meeting room |
| `offer` | WebRTC offer |
| `answer` | WebRTC answer |
| `ice-candidate` | ICE candidate |
| `mute-audio` | Mute/unmute audio |
| `mute-video` | Mute/unmute video |
| `start-screen-share` | Start screen sharing |
| `stop-screen-share` | Stop screen sharing |
| `send-message` | Send chat message |
| `raise-hand` | Raise hand |
| `start-recording` | Start recording |
| `stop-recording` | Stop recording |

## 🛡️ Security Features

- **Rate Limiting**: Configurable rate limits per endpoint
- **Input Validation**: Joi schema validation for all inputs
- **XSS Protection**: Built-in XSS prevention
- **SQL Injection Prevention**: MongoDB injection protection
- **CORS**: Configurable CORS policies
- **Helmet**: Security headers configuration
- **Authentication**: JWT-based authentication with refresh tokens
- **Authorization**: Role-based access control
- **Password Security**: Bcrypt hashing with configurable rounds

## 📊 Monitoring & Logging

- **Winston Logger**: Structured logging with multiple levels
- **Request Logging**: HTTP request/response logging
- **Error Tracking**: Comprehensive error handling and logging
- **Health Checks**: Built-in health check endpoint
- **Performance Monitoring**: Request duration tracking

## 🚀 Deployment

### Environment Variables

Make sure to set these environment variables in production:

```env
NODE_ENV=production
MONGODB_URI=mongodb://your-production-db
JWT_SECRET=your-production-secret
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
STRIPE_SECRET_KEY=your-production-stripe-key
EMAIL_HOST=your-email-host
EMAIL_USER=your-email-user
EMAIL_PASS=your-email-password
```

### Docker Deployment

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 5000

CMD ["npm", "start"]
```

### Platform Deployment

The backend is ready for deployment on:

- **Render**: Connect GitHub repository and configure environment variables
- **Railway**: Deploy with one-click Docker deployment
- **AWS**: Use ECS or EC2 with load balancer
- **DigitalOcean**: App Platform or Droplet

## 🧪 Testing

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Run linting
npm run lint
```

## 📝 API Documentation

Visit `/api-docs` endpoint for interactive API documentation.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new features
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For support and questions:

- Create an issue on GitHub
- Email: support@nexus.com
- Documentation: Check the `/api-docs` endpoint

## 🔄 Version History

- **v1.0.0** - Initial release with all core features
  - Authentication & Authorization
  - Meeting Management
  - Video Calling
  - Document Processing
  - Payment System
  - Security Features
