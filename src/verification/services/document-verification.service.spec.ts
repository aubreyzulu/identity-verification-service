import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
import { DocumentVerificationService } from './document-verification.service';
import { DocumentType } from '../entities/verification.entity';
import { TextractClient } from '@aws-sdk/client-textract';

// Mock the AWS SDK
jest.mock('@aws-sdk/client-textract', () => {
  const originalModule = jest.requireActual('@aws-sdk/client-textract');
  return {
    ...originalModule,
    TextractClient: jest.fn().mockImplementation(() => ({
      send: jest.fn(),
    })),
    AnalyzeIDCommand: jest.fn(),
  };
});

describe('DocumentVerificationService', () => {
  let service: DocumentVerificationService;
  let configService: ConfigService;
  let textractClientMock: jest.Mocked<TextractClient>;

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config = {
        'aws.region': 'us-east-1',
        'aws.credentials.accessKeyId': 'test-access-key',
        'aws.credentials.secretAccessKey': 'test-secret-key',
      };
      return config[key];
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentVerificationService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<DocumentVerificationService>(DocumentVerificationService);
    configService = module.get<ConfigService>(ConfigService);
    
    // Cast the TextractClient constructor mock to access the mockImplementation
    const TextractClientMock = TextractClient as jest.MockedClass<typeof TextractClient>;
    textractClientMock = TextractClientMock.mock.results[0].value as jest.Mocked<TextractClient>;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('verifyDocument', () => {
    it('should successfully verify a valid passport', async () => {
      // Create mock document response
      const mockResponse = {
        IdentityDocuments: [
          {
            IdentityDocumentFields: [
              {
                Type: { Text: 'FIRST_NAME' },
                ValueDetection: { Text: 'John', Confidence: 99.5 },
              },
              {
                Type: { Text: 'LAST_NAME' },
                ValueDetection: { Text: 'Doe', Confidence: 99.2 },
              },
              {
                Type: { Text: 'DATE_OF_BIRTH' },
                ValueDetection: { Text: '1980-01-01', Confidence: 98.7 },
              },
              {
                Type: { Text: 'PASSPORT_NUMBER' },
                ValueDetection: { Text: 'AB123456', Confidence: 97.9 },
              },
              {
                Type: { Text: 'EXPIRATION_DATE' },
                ValueDetection: { Text: '2030-01-01', Confidence: 98.1 },
              },
              {
                Type: { Text: 'NATIONALITY' },
                ValueDetection: { Text: 'USA', Confidence: 98.5 },
              },
            ],
          },
        ],
      };
      
      textractClientMock.send.mockResolvedValueOnce(mockResponse);
      
      const result = await service.verifyDocument(
        DocumentType.PASSPORT,
        Buffer.from('dummy-image-data'),
      );
      
      expect(result).toBeDefined();
      expect(result.isValid).toBe(true);
      expect(result.confidenceScore).toBeGreaterThan(0);
      expect(result.extractedData).toBeDefined();
      expect(result.extractedData['first_name'].value).toBe('John');
      expect(result.extractedData['passport_number'].value).toBe('AB123456');
    });

    it('should fail verification for an expired document', async () => {
      const mockResponse = {
        IdentityDocuments: [
          {
            IdentityDocumentFields: [
              {
                Type: { Text: 'FIRST_NAME' },
                ValueDetection: { Text: 'John', Confidence: 99.5 },
              },
              {
                Type: { Text: 'LAST_NAME' },
                ValueDetection: { Text: 'Doe', Confidence: 99.2 },
              },
              {
                Type: { Text: 'DATE_OF_BIRTH' },
                ValueDetection: { Text: '1980-01-01', Confidence: 98.7 },
              },
              {
                Type: { Text: 'PASSPORT_NUMBER' },
                ValueDetection: { Text: 'AB123456', Confidence: 97.9 },
              },
              {
                Type: { Text: 'EXPIRATION_DATE' },
                ValueDetection: { Text: '2020-01-01', Confidence: 98.1 }, // Expired date
              },
              {
                Type: { Text: 'NATIONALITY' },
                ValueDetection: { Text: 'USA', Confidence: 98.5 },
              },
            ],
          },
        ],
      };
      
      textractClientMock.send.mockResolvedValueOnce(mockResponse);
      
      await expect(
        service.verifyDocument(DocumentType.PASSPORT, Buffer.from('dummy-image-data'))
      ).rejects.toThrow(BadRequestException);
    });

    it('should fail verification for missing required fields', async () => {
      const mockResponse = {
        IdentityDocuments: [
          {
            IdentityDocumentFields: [
              {
                Type: { Text: 'FIRST_NAME' },
                ValueDetection: { Text: 'John', Confidence: 99.5 },
              },
              {
                Type: { Text: 'LAST_NAME' },
                ValueDetection: { Text: 'Doe', Confidence: 99.2 },
              },
              // Missing DATE_OF_BIRTH and other required fields
            ],
          },
        ],
      };
      
      textractClientMock.send.mockResolvedValueOnce(mockResponse);
      
      await expect(
        service.verifyDocument(DocumentType.PASSPORT, Buffer.from('dummy-image-data'))
      ).rejects.toThrow(BadRequestException);
    });

    it('should fail when document analysis fails', async () => {
      // No identity documents returned
      const mockResponse = { IdentityDocuments: [] };
      
      textractClientMock.send.mockResolvedValueOnce(mockResponse);
      
      await expect(
        service.verifyDocument(DocumentType.PASSPORT, Buffer.from('dummy-image-data'))
      ).rejects.toThrow(BadRequestException);
    });

    it('should fail for invalid passport number format', async () => {
      const mockResponse = {
        IdentityDocuments: [
          {
            IdentityDocumentFields: [
              {
                Type: { Text: 'FIRST_NAME' },
                ValueDetection: { Text: 'John', Confidence: 99.5 },
              },
              {
                Type: { Text: 'LAST_NAME' },
                ValueDetection: { Text: 'Doe', Confidence: 99.2 },
              },
              {
                Type: { Text: 'DATE_OF_BIRTH' },
                ValueDetection: { Text: '1980-01-01', Confidence: 98.7 },
              },
              {
                Type: { Text: 'PASSPORT_NUMBER' },
                ValueDetection: { Text: '123', Confidence: 97.9 }, // Invalid passport number (too short)
              },
              {
                Type: { Text: 'EXPIRATION_DATE' },
                ValueDetection: { Text: '2030-01-01', Confidence: 98.1 },
              },
              {
                Type: { Text: 'NATIONALITY' },
                ValueDetection: { Text: 'USA', Confidence: 98.5 },
              },
            ],
          },
        ],
      };
      
      textractClientMock.send.mockResolvedValueOnce(mockResponse);
      
      await expect(
        service.verifyDocument(DocumentType.PASSPORT, Buffer.from('dummy-image-data'))
      ).rejects.toThrow(BadRequestException);
    });

    it('should handle errors from AWS service', async () => {
      textractClientMock.send.mockRejectedValueOnce(new Error('AWS Service Error'));
      
      await expect(
        service.verifyDocument(DocumentType.PASSPORT, Buffer.from('dummy-image-data'))
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('validateDocumentAuthenticity', () => {
    it('should correctly validate a driver\'s license', async () => {
      const validData = {
        'first_name': { value: 'John', confidence: 99.5 },
        'last_name': { value: 'Doe', confidence: 99.2 },
        'date_of_birth': { value: '1980-01-01', confidence: 98.7 },
        'license_number': { value: 'DL123456789', confidence: 97.9 },
        'expiration_date': { value: '2030-01-01', confidence: 98.1 },
        'state': { value: 'California', confidence: 98.5 },
      };
      
      // We need to access the private method for testing
      const validateResult = await (service as any).validateDocumentAuthenticity(
        DocumentType.DRIVERS_LICENSE,
        validData
      );
      
      expect(validateResult.isValid).toBe(true);
    });
    
    it('should correctly validate an ID card', async () => {
      const validData = {
        'first_name': { value: 'John', confidence: 99.5 },
        'last_name': { value: 'Doe', confidence: 99.2 },
        'date_of_birth': { value: '1980-01-01', confidence: 98.7 },
        'id_number': { value: 'ID12345', confidence: 97.9 },
        'expiration_date': { value: '2030-01-01', confidence: 98.1 },
      };
      
      const validateResult = await (service as any).validateDocumentAuthenticity(
        DocumentType.ID_CARD,
        validData
      );
      
      expect(validateResult.isValid).toBe(true);
    });
  });

  describe('getRequiredFields', () => {
    it('should return correct required fields for each document type', () => {
      const passportFields = (service as any).getRequiredFields(DocumentType.PASSPORT);
      const licenseFields = (service as any).getRequiredFields(DocumentType.DRIVERS_LICENSE);
      const idCardFields = (service as any).getRequiredFields(DocumentType.ID_CARD);
      
      expect(passportFields).toContain('PASSPORT_NUMBER');
      expect(passportFields).toContain('NATIONALITY');
      
      expect(licenseFields).toContain('LICENSE_NUMBER');
      expect(licenseFields).toContain('STATE');
      
      expect(idCardFields).toContain('ID_NUMBER');
      
      // All document types should require these common fields
      [passportFields, licenseFields, idCardFields].forEach(fields => {
        expect(fields).toContain('FIRST_NAME');
        expect(fields).toContain('LAST_NAME');
        expect(fields).toContain('DATE_OF_BIRTH');
        expect(fields).toContain('EXPIRATION_DATE');
      });
    });
  });
}); 