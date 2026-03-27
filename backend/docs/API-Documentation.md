# Nexus Backend API Documentation

## Base URL

```
Development: http://localhost:5000/api/v1
Production: https://your-domain.com/api/v1
```

## Authentication

Most endpoints require authentication using JWT tokens. Include the token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

## Response Format

All API responses follow this format:

```json
{
  "success": true,
  "message": "Operation successful",
  "data": {
    // Response data
  }
}
```

Error responses:

```json
{
  "success": false,
  "message": "Error description",
  "errors": [
    {
      "field": "field_name",
      "message": "Validation error message"
    }
  ]
}
```

## Authentication Endpoints

### Register User

**POST** `/auth/register`

Register a new user account.

**Request Body:**
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john.doe@example.com",
  "password": "SecurePass123",
  "role": "investor",
  "bio": "Experienced angel investor",
  "interests": ["tech", "healthcare", "fintech"]
}
```

**Response:**
```json
{
  "success": true,
  "message": "User registered successfully. Please check your email for verification.",
  "data": {
    "user": {
      "id": "64f8a1b2c3d4e5f6a7b8c9d0",
      "firstName": "John",
      "lastName": "Doe",
      "email": "john.doe@example.com",
      "role": "investor",
      "bio": "Experienced angel investor",
      "interests": ["tech", "healthcare", "fintech"],
      "isEmailVerified": false,
      "createdAt": "2024-01-15T10:30:00.000Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

### Login

**POST** `/auth/login`

Authenticate user and return JWT tokens.

**Request Body:**
```json
{
  "email": "john.doe@example.com",
  "password": "SecurePass123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "64f8a1b2c3d4e5f6a7b8c9d0",
      "firstName": "John",
      "lastName": "Doe",
      "email": "john.doe@example.com",
      "role": "investor"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

### Refresh Token

**POST** `/auth/refresh-token`

Refresh JWT access token.

**Request Body:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### Get Profile

**GET** `/auth/profile`

Get current user profile information.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "64f8a1b2c3d4e5f6a7b8c9d0",
      "firstName": "John",
      "lastName": "Doe",
      "email": "john.doe@example.com",
      "role": "investor",
      "bio": "Experienced angel investor",
      "interests": ["tech", "healthcare", "fintech"],
      "profilePicture": "https://example.com/avatar.jpg",
      "investmentRange": {
        "min": 10000,
        "max": 100000,
        "currency": "USD"
      }
    }
  }
}
```

## Meeting Endpoints

### Create Meeting

**POST** `/meetings`

Create a new meeting with participants.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "title": "Investment Discussion",
  "description": "Discuss investment opportunity in Tech Startup",
  "participants": ["64f8a1b2c3d4e5f6a7b8c9d1", "64f8a1b2c3d4e5f6a7b8c9d2"],
  "startTime": "2024-01-20T14:00:00.000Z",
  "endTime": "2024-01-20T15:00:00.000Z",
  "timezone": "UTC",
  "meetingType": "video",
  "agenda": [
    {
      "item": "Company overview",
      "duration": 15
    },
    {
      "item": "Investment terms",
      "duration": 30
    },
    {
      "item": "Q&A session",
      "duration": 15
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Meeting created successfully",
  "data": {
    "meeting": {
      "id": "64f8a1b2c3d4e5f6a7b8c9d3",
      "title": "Investment Discussion",
      "description": "Discuss investment opportunity in Tech Startup",
      "organizer": {
        "id": "64f8a1b2c3d4e5f6a7b8c9d0",
        "firstName": "John",
        "lastName": "Doe"
      },
      "participants": [
        {
          "user": {
            "id": "64f8a1b2c3d4e5f6a7b8c9d1",
            "firstName": "Jane",
            "lastName": "Smith"
          },
          "status": "pending"
        }
      ],
      "startTime": "2024-01-20T14:00:00.000Z",
      "endTime": "2024-01-20T15:00:00.000Z",
      "status": "scheduled",
      "meetingLink": "https://nexus.com/meeting/1642689600000"
    }
  }
}
```

### Get My Meetings

**GET** `/meetings`

Get meetings for the current user.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `page` (number): Page number (default: 1)
- `limit` (number): Items per page (default: 20)
- `status` (string): Filter by status
- `startDate` (date): Filter by start date
- `endDate` (date): Filter by end date
- `type` (string): Filter by meeting type

**Response:**
```json
{
  "success": true,
  "data": {
    "meetings": [
      {
        "id": "64f8a1b2c3d4e5f6a7b8c9d3",
        "title": "Investment Discussion",
        "startTime": "2024-01-20T14:00:00.000Z",
        "endTime": "2024-01-20T15:00:00.000Z",
        "status": "scheduled",
        "duration": 60,
        "timeStatus": "upcoming"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 1,
      "pages": 1
    }
  }
}
```

### Respond to Meeting

**POST** `/meetings/:id/respond`

Respond to a meeting invitation.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "response": "accepted"
}
```

## Document Endpoints

### Upload Document

**POST** `/documents`

Upload a document to cloud storage.

**Headers:** `Authorization: Bearer <token>`, `Content-Type: multipart/form-data`

**Request Body (FormData):**
- `file`: File to upload
- `title`: Document title
- `description`: Document description
- `category`: Document category
- `tags`: Comma-separated tags
- `accessLevel`: Access level (private, shared, public)

**Response:**
```json
{
  "success": true,
  "message": "Document uploaded successfully",
  "data": {
    "document": {
      "id": "64f8a1b2c3d4e5f6a7b8c9d4",
      "title": "Investment Proposal",
      "description": "Q1 2024 investment proposal",
      "fileName": "doc_1642689600000_proposal.pdf",
      "originalName": "investment_proposal.pdf",
      "mimeType": "application/pdf",
      "fileSize": 1048576,
      "filePath": "https://res.cloudinary.com/...",
      "category": "proposal",
      "tags": ["investment", "proposal", "q1-2024"],
      "uploadedBy": {
        "id": "64f8a1b2c3d4e5f6a7b8c9d0",
        "firstName": "John",
        "lastName": "Doe"
      },
      "fileSizeFormatted": "1 MB"
    }
  }
}
```

### Get Documents

**GET** `/documents`

Get documents for the current user.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `page` (number): Page number
- `limit` (number): Items per page
- `category` (string): Filter by category
- `status` (string): Filter by status
- `search` (string): Search query
- `sortBy` (string): Sort field
- `sortOrder` (string): Sort order (asc/desc)

### Share Document

**POST** `/documents/:id/share`

Share a document with another user.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "userId": "64f8a1b2c3d4e5f6a7b8c9d1",
  "permission": "view"
}
```

## Transaction Endpoints

### Create Transaction

**POST** `/transactions`

Create a new payment transaction.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "amount": 5000,
  "currency": "USD",
  "receiver": "64f8a1b2c3d4e5f6a7b8c9d1",
  "type": "investment",
  "paymentMethod": "stripe",
  "description": "Initial investment in Tech Startup"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Transaction created successfully",
  "data": {
    "transaction": {
      "id": "64f8a1b2c3d4e5f6a7b8c9d5",
      "amount": 5000,
      "currency": "USD",
      "sender": {
        "id": "64f8a1b2c3d4e5f6a7b8c9d0",
        "firstName": "John",
        "lastName": "Doe"
      },
      "receiver": {
        "id": "64f8a1b2c3d4e5f6a7b8c9d1",
        "firstName": "Jane",
        "lastName": "Smith"
      },
      "type": "investment",
      "status": "pending",
      "createdAt": "2024-01-15T10:30:00.000Z"
    }
  }
}
```

### Process Payment

**POST** `/transactions/:id/process`

Process payment for a transaction.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "paymentMethodId": "pm_stripe_payment_method_id"
}
```

### Get Transactions

**GET** `/transactions`

Get transactions for the current user.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `page` (number): Page number
- `limit` (number): Items per page
- `type` (string): Filter by transaction type
- `status` (string): Filter by status
- `startDate` (date): Filter by start date
- `endDate` (date): Filter by end date

## Video Call Endpoints

### Get Active Rooms

**GET** `/video-calls/active-rooms`

Get active video call rooms for the current user.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "success": true,
  "data": {
    "activeMeetings": [
      {
        "id": "64f8a1b2c3d4e5f6a7b8c9d3",
        "title": "Investment Discussion",
        "status": "in_progress",
        "startTime": "2024-01-20T14:00:00.000Z",
        "meetingLink": "https://nexus.com/meeting/1642689600000"
      }
    ],
    "activeRooms": true
  }
}
```

### Generate Meeting Link

**POST** `/video-calls/rooms/:meetingId/link`

Generate a meeting link for video call.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "success": true,
  "data": {
    "meetingLink": "https://nexus.com/meeting/64f8a1b2c3d4e5f6a7b8c9d3_1642689600000",
    "meetingId": "64f8a1b2c3d4e5f6a7b8c9d3",
    "title": "Investment Discussion",
    "startTime": "2024-01-20T14:00:00.000Z",
    "endTime": "2024-01-20T15:00:00.000Z"
  }
}
```

## Socket.IO Events

### Connection

Connect to Socket.IO server with authentication:

```javascript
const socket = io('http://localhost:5000', {
  auth: {
    userId: 'your-user-id',
    userName: 'John Doe'
  }
});
```

### Video Call Events

#### Join Room
```javascript
socket.emit('join-room', {
  meetingId: '64f8a1b2c3d4e5f6a7b8c9d3',
  userName: 'John Doe'
});
```

#### WebRTC Signaling
```javascript
// Send offer
socket.emit('offer', {
  targetUserId: 'user-id',
  offer: rtcOffer,
  meetingId: 'meeting-id'
});

// Send answer
socket.emit('answer', {
  targetUserId: 'user-id',
  answer: rtcAnswer,
  meetingId: 'meeting-id'
});

// Send ICE candidate
socket.emit('ice-candidate', {
  targetUserId: 'user-id',
  candidate: iceCandidate,
  meetingId: 'meeting-id'
});
```

#### Audio/Video Control
```javascript
// Mute/unmute audio
socket.emit('mute-audio', {
  meetingId: 'meeting-id',
  muted: true
});

// Mute/unmute video
socket.emit('mute-video', {
  meetingId: 'meeting-id',
  muted: false
});
```

#### Screen Sharing
```javascript
// Start screen share
socket.emit('start-screen-share', {
  meetingId: 'meeting-id'
});

// Stop screen share
socket.emit('stop-screen-share', {
  meetingId: 'meeting-id'
});
```

#### Chat
```javascript
socket.emit('send-message', {
  meetingId: 'meeting-id',
  message: 'Hello everyone!'
});
```

## Error Codes

| Code | Description |
|------|-------------|
| 400 | Bad Request - Validation error |
| 401 | Unauthorized - Invalid or missing token |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Resource not found |
| 409 | Conflict - Resource conflict |
| 429 | Too Many Requests - Rate limit exceeded |
| 500 | Internal Server Error |

## Rate Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| Auth endpoints | 10 requests | 15 minutes |
| General endpoints | 100 requests | 15 minutes |
| Upload endpoints | 20 requests | 1 hour |
| Sensitive endpoints | 5 requests | 15 minutes |

## File Upload Limits

- Maximum file size: 10MB
- Allowed types: JPEG, PNG, GIF, PDF, Word documents
- Maximum files per request: 1

## Pagination

All list endpoints support pagination:

- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20, max: 100)

Response includes pagination metadata:

```json
{
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "pages": 8
  }
}
```

## Search and Filtering

Most list endpoints support search and filtering:

- `search`: Text search query
- `sortBy`: Field to sort by
- `sortOrder`: Sort order (asc/desc)
- Various filter fields specific to each endpoint

## Webhooks

### Stripe Webhooks

Configure your Stripe webhook endpoint to receive payment events:

```
POST /webhooks/stripe
```

**Events handled:**
- `payment_intent.succeeded`
- `payment_intent.payment_failed`
- `payment_intent.canceled`

## Testing

Use the provided Postman collection or test with curl:

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

## SDK Examples

### JavaScript/Node.js

```javascript
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:5000/api/v1',
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add auth interceptor
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Register user
const register = async (userData) => {
  const response = await api.post('/auth/register', userData);
  return response.data;
};

// Create meeting
const createMeeting = async (meetingData) => {
  const response = await api.post('/meetings', meetingData);
  return response.data;
};
```

### Python

```python
import requests

class NexusAPI:
    def __init__(self, base_url='http://localhost:5000/api/v1'):
        self.base_url = base_url
        self.token = None
    
    def login(self, email, password):
        response = requests.post(f'{self.base_url}/auth/login', json={
            'email': email,
            'password': password
        })
        if response.status_code == 200:
            data = response.json()
            self.token = data['data']['token']
        return response.json()
    
    def get_headers(self):
        return {'Authorization': f'Bearer {self.token}'} if self.token else {}
    
    def get_meetings(self):
        response = requests.get(f'{self.base_url}/meetings', 
                               headers=self.get_headers())
        return response.json()
```

## Support

For API support and questions:

- Email: api-support@nexus.com
- Documentation: https://docs.nexus.com
- Status Page: https://status.nexus.com
