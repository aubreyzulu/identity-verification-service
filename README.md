# Identity Verification Service

A robust NestJS-based service for verifying identity documents and performing facial recognition with liveness detection.

## Table of Contents
- [Features](#features)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [API Documentation](#api-documentation)
- [Security Measures](#security-measures)
- [Data Retention](#data-retention)
- [Testing](#testing)
- [Monitoring](#monitoring)
- [Error Handling](#error-handling)

## Features

### Document Verification
- Support for multiple document types:
  - Passports
  - Driver's Licenses
  - ID Cards
- Document authenticity validation
- Data extraction with confidence scoring
- Format-specific validation rules

### Facial Verification
- Face matching between document and selfie
- Liveness detection to prevent spoofing
- Quality assessment of facial images
- Pose and attribute analysis

### Security
- Rate limiting protection
- JWT authentication
- Request tracking with X-Request-ID
- File type and size validation
- CORS protection
- Secure credential management

### Data Management
- Automated data retention policies
- Secure file storage
- Database cleanup jobs
- Audit logging

## Architecture

### Core Components

1. **VerificationModule**
   - Main module orchestrating all verification components
   - Handles dependency injection and configuration

2. **VerificationService**
   - Coordinates the verification workflow
   - Manages verification state and status

3. **DocumentVerificationService**
   - Integrates with AWS Textract
   - Handles document processing and validation
   - Implements document-specific validation rules

4. **FaceVerificationService**
   - Integrates with AWS Rekognition
   - Handles face matching and liveness detection
   - Implements quality and pose validation

5. **DataRetentionService**
   - Manages data lifecycle
   - Implements cleanup policies
   - Handles secure file deletion

## Prerequisites

- Node.js (v14 or later)
- PostgreSQL (v12 or later)
- AWS Account with access to:
  - AWS Textract
  - AWS Rekognition
- Docker (optional, for containerization)

## Installation

\`\`\`bash
# Clone the repository
git clone <repository-url>

# Install dependencies
npm install

# Create environment file
cp .env.example .env

# Update environment variables
nano .env

# Start the service
npm run start:dev
\`\`\`

## Configuration

### Environment Variables

\`\`\`env
# Application
PORT=3000
NODE_ENV=development

# Database
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USERNAME=postgres
DATABASE_PASSWORD=your_password
DATABASE_NAME=verification_db

# JWT
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRES_IN=1d

# AWS Configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key

# Rate Limiting
RATE_LIMIT_TTL=60
RATE_LIMIT_MAX=10

# Data Retention (in days)
DATA_RETENTION_DAYS=90
DOCUMENT_RETENTION_DAYS=1

# Monitoring
SENTRY_DSN=your_sentry_dsn
LOG_LEVEL=info

# Security
CORS_ORIGINS=http://localhost:3000,https://your-frontend-domain.com
ALLOWED_FILE_TYPES=jpg,jpeg,png,pdf
MAX_FILE_SIZE=5242880 # 5MB in bytes
\`\`\`

## API Documentation

### Endpoints

#### 1. Start Document Verification
\`\`\`http
POST /verification/document
Content-Type: multipart/form-data
Authorization: Bearer <jwt_token>
X-Request-ID: <unique_request_id>

Body:
- userId: string
- documentType: "passport" | "drivers_license" | "id_card"
- document: File
\`\`\`

#### 2. Verify Face
\`\`\`http
POST /verification/:verificationId/face
Content-Type: multipart/form-data
Authorization: Bearer <jwt_token>
X-Request-ID: <unique_request_id>

Body:
- selfie: File
\`\`\`

#### 3. Check Verification Status
\`\`\`http
GET /verification/:verificationId
Authorization: Bearer <jwt_token>
X-Request-ID: <unique_request_id>
\`\`\`

### Response Formats

#### Verification Status
\`\`\`json
{
  "id": "uuid",
  "userId": "string",
  "documentType": "passport",
  "status": "pending|in_progress|completed|failed",
  "documentData": {
    "documentNumber": "string",
    "expiryDate": "date",
    "fullName": "string",
    "dateOfBirth": "date"
  },
  "confidenceScore": 0.95,
  "faceMatchResult": {
    "isMatch": true,
    "confidence": 0.98,
    "details": {
      "boundingBox": {},
      "landmarks": [],
      "quality": {},
      "pose": {}
    }
  },
  "createdAt": "datetime",
  "updatedAt": "datetime"
}
\`\`\`

## Security Measures

### Authentication
- JWT-based authentication
- Token expiration and refresh mechanism
- Role-based access control

### Request Validation
- File type validation (jpg, jpeg, png, pdf)
- File size limits (5MB)
- Input sanitization
- Request tracking with X-Request-ID

### Rate Limiting
- 10 requests per minute per IP
- Configurable limits and windows
- Protection against brute force attacks

### Data Protection
- Encrypted storage
- Secure file handling
- Automatic cleanup of sensitive data
- CORS protection

## Data Retention

### Verification Records
- Default retention: 90 days
- Configurable retention period
- Automatic cleanup via scheduled jobs

### Document Images
- Default retention: 24 hours
- Secure storage in uploads directory
- Automatic cleanup via hourly jobs

### Cleanup Jobs
- Daily database record cleanup
- Hourly file system cleanup
- Immediate deletion capability

## Testing

### Unit Tests
\`\`\`bash
# Run unit tests
npm run test

# Run tests with coverage
npm run test:cov
\`\`\`

### Test Coverage
- Service logic
- Document validation
- Face verification
- Error handling
- Edge cases

## Monitoring

### Logging
- Request/Response logging
- Error tracking
- Performance metrics
- Audit trails

### Integration with Monitoring Services
- Sentry integration for error tracking
- Configurable log levels
- Structured logging format

## Error Handling

### Common Error Types
1. **ValidationError**
   - Invalid document type
   - Missing required fields
   - File format/size issues

2. **VerificationError**
   - Document verification failed
   - Face matching failed
   - Liveness check failed

3. **AuthenticationError**
   - Invalid token
   - Expired token
   - Missing permissions

### Error Response Format
\`\`\`json
{
  "statusCode": 400,
  "message": "Error description",
  "error": "Error type",
  "details": {
    "field": "Specific error details"
  }
}
\`\`\`

## Best Practices

### Document Verification
- Submit high-quality document images
- Ensure proper lighting and focus
- Avoid glare and reflections
- Submit complete document views

### Face Verification
- Use recent, clear selfie photos
- Ensure good lighting
- Maintain neutral expression
- Follow pose guidelines
- Remove sunglasses and face coverings

## Support and Maintenance

### Troubleshooting
- Check logs for detailed error messages
- Verify AWS credentials and permissions
- Ensure proper environment configuration
- Monitor rate limiting and quotas

### Updates and Maintenance
- Regular dependency updates
- Security patch management
- Performance optimization
- Feature enhancements

## License

[License Type] - See LICENSE file for details