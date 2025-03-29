import { appConfig } from './app.config';

describe('AppConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('port configuration', () => {
    it('should use default port when not specified', () => {
      delete process.env.PORT;
      const config = appConfig();
      expect(config.port).toBe(3000);
    });

    it('should use specified port from environment', () => {
      process.env.PORT = '4000';
      const config = appConfig();
      expect(config.port).toBe(4000);
    });
  });

  describe('environment configuration', () => {
    it('should default to development environment', () => {
      delete process.env.NODE_ENV;
      const config = appConfig();
      expect(config.environment).toBe('development');
    });

    it('should use specified environment', () => {
      process.env.NODE_ENV = 'production';
      const config = appConfig();
      expect(config.environment).toBe('production');
    });
  });

  describe('allowed origins configuration', () => {
    it('should default to wildcard when not specified', () => {
      delete process.env.ALLOWED_ORIGINS;
      const config = appConfig();
      expect(config.allowedOrigins).toEqual(['*']);
    });

    it('should parse comma-separated origins', () => {
      process.env.ALLOWED_ORIGINS = 'http://localhost:3000,https://example.com';
      const config = appConfig();
      expect(config.allowedOrigins).toEqual(['http://localhost:3000', 'https://example.com']);
    });
  });

  describe('JWT configuration', () => {
    it('should use default JWT settings when not specified', () => {
      delete process.env.JWT_SECRET;
      delete process.env.JWT_EXPIRES_IN;
      const config = appConfig();
      expect(config.jwt.secret).toBe('default-secret-key');
      expect(config.jwt.expiresIn).toBe('1h');
    });

    it('should use specified JWT settings', () => {
      process.env.JWT_SECRET = 'test-secret';
      process.env.JWT_EXPIRES_IN = '2h';
      const config = appConfig();
      expect(config.jwt.secret).toBe('test-secret');
      expect(config.jwt.expiresIn).toBe('2h');
    });
  });

  describe('rate limit configuration', () => {
    it('should use default rate limit settings when not specified', () => {
      delete process.env.RATE_LIMIT_TTL;
      delete process.env.RATE_LIMIT_MAX;
      delete process.env.VERIFICATION_RATE_LIMIT;
      const config = appConfig();
      expect(config.rateLimit.ttl).toBe(60);
      expect(config.rateLimit.limit).toBe(10);
      expect(config.rateLimit.verificationLimit).toBe(5);
    });

    it('should use specified rate limit settings', () => {
      process.env.RATE_LIMIT_TTL = '120';
      process.env.RATE_LIMIT_MAX = '20';
      process.env.VERIFICATION_RATE_LIMIT = '10';
      const config = appConfig();
      expect(config.rateLimit.ttl).toBe(120);
      expect(config.rateLimit.limit).toBe(20);
      expect(config.rateLimit.verificationLimit).toBe(10);
    });
  });

  describe('upload configuration', () => {
    it('should use default upload settings when not specified', () => {
      delete process.env.MAX_FILE_SIZE;
      delete process.env.UPLOAD_DIR;
      const config = appConfig();
      expect(config.upload.maxFileSize).toBe(5242880); // 5MB
      expect(config.upload.uploadDir).toBe('uploads');
      expect(config.upload.allowedDocumentTypes).toEqual(['image/jpeg', 'image/png', 'application/pdf']);
      expect(config.upload.allowedSelfieTypes).toEqual(['image/jpeg', 'image/png']);
    });

    it('should use specified upload settings', () => {
      process.env.MAX_FILE_SIZE = '10485760'; // 10MB
      process.env.UPLOAD_DIR = 'custom-uploads';
      const config = appConfig();
      expect(config.upload.maxFileSize).toBe(10485760);
      expect(config.upload.uploadDir).toBe('custom-uploads');
    });
  });

  describe('security configuration', () => {
    it('should use default security settings when not specified', () => {
      delete process.env.CSRF_ENABLED;
      delete process.env.CSRF_COOKIE_NAME;
      delete process.env.CSRF_HEADER_NAME;
      const config = appConfig();
      expect(config.security.csrfEnabled).toBe(false);
      expect(config.security.csrfCookieName).toBe('XSRF-TOKEN');
      expect(config.security.csrfHeaderName).toBe('X-XSRF-TOKEN');
    });

    it('should use specified security settings', () => {
      process.env.CSRF_ENABLED = 'true';
      process.env.CSRF_COOKIE_NAME = 'CUSTOM-CSRF';
      process.env.CSRF_HEADER_NAME = 'X-CUSTOM-CSRF';
      const config = appConfig();
      expect(config.security.csrfEnabled).toBe(true);
      expect(config.security.csrfCookieName).toBe('CUSTOM-CSRF');
      expect(config.security.csrfHeaderName).toBe('X-CUSTOM-CSRF');
    });
  });

  describe('AWS configuration', () => {
    it('should use default AWS region when not specified', () => {
      delete process.env.AWS_REGION;
      const config = appConfig();
      expect(config.aws.region).toBe('us-east-1');
    });

    it('should use specified AWS settings', () => {
      process.env.AWS_REGION = 'eu-west-1';
      process.env.AWS_ACCESS_KEY_ID = 'test-key';
      process.env.AWS_SECRET_ACCESS_KEY = 'test-secret';
      process.env.AWS_S3_BUCKET = 'test-bucket';
      const config = appConfig();
      expect(config.aws.region).toBe('eu-west-1');
      expect(config.aws.accessKeyId).toBe('test-key');
      expect(config.aws.secretAccessKey).toBe('test-secret');
      expect(config.aws.s3Bucket).toBe('test-bucket');
    });
  });
}); 