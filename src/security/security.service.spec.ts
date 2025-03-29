import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SecurityService } from './security.service';

describe('SecurityService', () => {
  let service: SecurityService;
  let configService: ConfigService;

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config = {
        'app.upload.allowedDocumentTypes': ['image/jpeg', 'image/png', 'application/pdf'],
        'app.upload.allowedSelfieTypes': ['image/jpeg', 'image/png'],
        'app.upload.maxFileSize': 5242880, // 5MB
      };
      return config[key];
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SecurityService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<SecurityService>(SecurityService);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateRequestId', () => {
    it('should generate a valid UUID', () => {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      const requestId = service.generateRequestId();
      expect(requestId).toMatch(uuidRegex);
    });
  });

  describe('validateFileType', () => {
    it('should validate document file types correctly', () => {
      const validDocumentFile = { mimetype: 'image/jpeg' } as Express.Multer.File;
      const invalidDocumentFile = { mimetype: 'text/plain' } as Express.Multer.File;

      expect(service.validateFileType(validDocumentFile, 'document')).toBe(true);
      expect(service.validateFileType(invalidDocumentFile, 'document')).toBe(false);
      expect(configService.get).toHaveBeenCalledWith('app.upload.allowedDocumentTypes');
    });

    it('should validate selfie file types correctly', () => {
      const validSelfieFile = { mimetype: 'image/png' } as Express.Multer.File;
      const invalidSelfieFile = { mimetype: 'application/pdf' } as Express.Multer.File;

      expect(service.validateFileType(validSelfieFile, 'selfie')).toBe(true);
      expect(service.validateFileType(invalidSelfieFile, 'selfie')).toBe(false);
      expect(configService.get).toHaveBeenCalledWith('app.upload.allowedSelfieTypes');
    });
  });

  describe('validateFileSize', () => {
    it('should validate file size correctly', () => {
      const validFile = { size: 1024 * 1024 } as Express.Multer.File; // 1MB
      const invalidFile = { size: 10 * 1024 * 1024 } as Express.Multer.File; // 10MB

      expect(service.validateFileSize(validFile)).toBe(true);
      expect(service.validateFileSize(invalidFile)).toBe(false);
      expect(configService.get).toHaveBeenCalledWith('app.upload.maxFileSize');
    });
  });

  describe('generateSecureFilename', () => {
    it('should generate a secure filename with correct extension', () => {
      const originalName = 'test.jpg';
      const secureFilename = service.generateSecureFilename(originalName);
      
      expect(secureFilename).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.jpg$/i);
    });
  });

  describe('sanitizeOutput', () => {
    it('should remove sensitive fields from response data', () => {
      const inputData = {
        id: 1,
        username: 'test',
        password: 'secret123',
        token: 'jwt-token',
        nested: {
          secret: 'hidden',
          visible: 'shown',
        },
      };

      const sanitizedData = service.sanitizeOutput(inputData);

      expect(sanitizedData).toEqual({
        id: 1,
        username: 'test',
        nested: {
          visible: 'shown',
        },
      });
    });

    it('should handle null and undefined values', () => {
      expect(service.sanitizeOutput(null)).toBeNull();
      expect(service.sanitizeOutput(undefined)).toBeUndefined();
    });

    it('should handle arrays of objects', () => {
      const inputData = [
        { id: 1, secret: 'hidden1' },
        { id: 2, secret: 'hidden2' },
      ];

      const sanitizedData = service.sanitizeOutput(inputData);

      expect(sanitizedData).toEqual([
        { id: 1 },
        { id: 2 },
      ]);
    });
  });
}); 