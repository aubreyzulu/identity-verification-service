export default () => ({
  port: parseInt(process.env.PORT!, 10) || 3000,
  database: {
    host: process.env.DATABASE_HOST,
    port: parseInt(process.env.DATABASE_PORT!, 10) || 5432,
    username: process.env.DATABASE_USERNAME,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME,
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'your-secret-key',
    expiresIn: process.env.JWT_EXPIRES_IN || '1d',
  },
  aws: {
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  },
  rateLimit: {
    ttl: 60, // 1 minute
    limit: 10, // 10 requests per minute
  },
  dataRetention: {
    // Time in days to keep verification data
    verificationRecords: parseInt(process.env.DATA_RETENTION_DAYS!, 10) || 90,
    documentImages: parseInt(process.env.DOCUMENT_RETENTION_DAYS!, 10) || 1, // Store document images for 24 hours only
  },
  monitoring: {
    sentryDsn: process.env.SENTRY_DSN,
    logLevel: process.env.LOG_LEVEL || 'info',
  },
  // Add your verification service API keys here
  verificationServices: {
    documentAi: {
      apiKey: process.env.DOCUMENT_AI_API_KEY,
    },
    faceRecognition: {
      apiKey: process.env.FACE_RECOGNITION_API_KEY,
    },
  },
}); 