import { registerAs } from '@nestjs/config';

export const appConfig = registerAs('app', () => ({
  port: parseInt(process.env.PORT || '3000', 10),
  environment: process.env.NODE_ENV || 'development',
  allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',') || ['*'],
  jwt: {
    secret: process.env.JWT_SECRET || 'default-secret-key',
    expiresIn: process.env.JWT_EXPIRES_IN || '1h',
  },
  rateLimit: {
    ttl: parseInt(process.env.RATE_LIMIT_TTL || '60', 10),
    limit: parseInt(process.env.RATE_LIMIT_MAX || '10', 10),
    verificationLimit: parseInt(process.env.VERIFICATION_RATE_LIMIT || '5', 10),
  },
  upload: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '5242880', 10), // 5MB
    allowedDocumentTypes: ['image/jpeg', 'image/png', 'application/pdf'],
    allowedSelfieTypes: ['image/jpeg', 'image/png'],
    uploadDir: process.env.UPLOAD_DIR || 'uploads',
  },
  security: {
    csrfEnabled: process.env.CSRF_ENABLED === 'true',
    csrfCookieName: process.env.CSRF_COOKIE_NAME || 'XSRF-TOKEN',
    csrfHeaderName: process.env.CSRF_HEADER_NAME || 'X-XSRF-TOKEN',
  },
  aws: {
    region: process.env.AWS_REGION || 'us-east-1',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    s3Bucket: process.env.AWS_S3_BUCKET,
  },
})); 