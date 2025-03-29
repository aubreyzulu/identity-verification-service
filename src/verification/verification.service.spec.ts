import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BadRequestException } from '@nestjs/common';
import { VerificationService } from './verification.service';
import { DocumentVerificationService } from './services/document-verification.service';
import { FaceVerificationService } from './services/face-verification.service';
import { Verification, DocumentType, VerificationStatus } from './entities/verification.entity';

describe('VerificationService', () => {
  let service: VerificationService;
  let verificationRepository: Repository<Verification>;
  let documentVerificationService: DocumentVerificationService;
  let faceVerificationService: FaceVerificationService;

  const mockVerificationRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
  };

  const mockDocumentVerificationService = {
    verifyDocument: jest.fn(),
  };

  const mockFaceVerificationService = {
    verifyFaceMatch: jest.fn(),
    detectLiveness: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VerificationService,
        {
          provide: getRepositoryToken(Verification),
          useValue: mockVerificationRepository,
        },
        {
          provide: DocumentVerificationService,
          useValue: mockDocumentVerificationService,
        },
        {
          provide: FaceVerificationService,
          useValue: mockFaceVerificationService,
        },
      ],
    }).compile();

    service = module.get<VerificationService>(VerificationService);
    verificationRepository = module.get<Repository<Verification>>(
      getRepositoryToken(Verification),
    );
    documentVerificationService = module.get<DocumentVerificationService>(
      DocumentVerificationService,
    );
    faceVerificationService = module.get<FaceVerificationService>(
      FaceVerificationService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('startVerification', () => {
    const mockUserId = 'user123';
    const mockDocumentType = DocumentType.PASSPORT;
    const mockDocumentBuffer = Buffer.from('test');

    it('should successfully start verification', async () => {
      const mockVerification = {
        id: 'verification123',
        userId: mockUserId,
        documentType: mockDocumentType,
        status: VerificationStatus.IN_PROGRESS,
      };

      const mockDocumentResult = {
        isValid: true,
        extractedData: { documentNumber: 'ABC123' },
        confidenceScore: 0.95,
      };

      mockVerificationRepository.create.mockReturnValue(mockVerification);
      mockVerificationRepository.save.mockResolvedValue(mockVerification);
      mockDocumentVerificationService.verifyDocument.mockResolvedValue(
        mockDocumentResult,
      );

      const result = await service.startVerification(
        mockUserId,
        mockDocumentType,
        mockDocumentBuffer,
      );

      expect(result).toBeDefined();
      expect(result.status).toBe(VerificationStatus.IN_PROGRESS);
      expect(mockVerificationRepository.create).toHaveBeenCalledWith({
        userId: mockUserId,
        documentType: mockDocumentType,
        status: VerificationStatus.IN_PROGRESS,
      });
    });

    it('should handle document verification failure', async () => {
      const mockVerification = {
        id: 'verification123',
        userId: mockUserId,
        documentType: mockDocumentType,
        status: VerificationStatus.IN_PROGRESS,
      };

      mockVerificationRepository.create.mockReturnValue(mockVerification);
      mockVerificationRepository.save.mockResolvedValue(mockVerification);
      mockDocumentVerificationService.verifyDocument.mockResolvedValue({
        isValid: false,
        extractedData: {},
        confidenceScore: 0,
      });

      await expect(
        service.startVerification(mockUserId, mockDocumentType, mockDocumentBuffer),
      ).rejects.toThrow(BadRequestException);

      expect(mockVerificationRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: VerificationStatus.FAILED,
          failureReason: 'Document verification failed',
        }),
      );
    });
  });

  describe('verifyFace', () => {
    const mockVerificationId = 'verification123';
    const mockSelfieBuffer = Buffer.from('test');

    it('should successfully verify face', async () => {
      const mockVerification = {
        id: mockVerificationId,
        status: VerificationStatus.IN_PROGRESS,
      };

      const mockLivenessResult = {
        isLive: true,
        confidence: 0.98,
        details: {},
      };

      const mockFaceMatchResult = {
        isMatch: true,
        confidence: 0.95,
        details: {},
      };

      mockVerificationRepository.findOne.mockResolvedValue(mockVerification);
      mockFaceVerificationService.detectLiveness.mockResolvedValue(
        mockLivenessResult,
      );
      mockFaceVerificationService.verifyFaceMatch.mockResolvedValue(
        mockFaceMatchResult,
      );

      const result = await service.verifyFace(mockVerificationId, mockSelfieBuffer);

      expect(result).toBeDefined();
      expect(result.status).toBe(VerificationStatus.COMPLETED);
    });

    it('should handle verification not found', async () => {
      mockVerificationRepository.findOne.mockResolvedValue(null);

      await expect(
        service.verifyFace(mockVerificationId, mockSelfieBuffer),
      ).rejects.toThrow(BadRequestException);
    });

    it('should handle liveness check failure', async () => {
      const mockVerification = {
        id: mockVerificationId,
        status: VerificationStatus.IN_PROGRESS,
      };

      mockVerificationRepository.findOne.mockResolvedValue(mockVerification);
      mockFaceVerificationService.detectLiveness.mockResolvedValue({
        isLive: false,
        confidence: 0,
        details: {},
      });

      await expect(
        service.verifyFace(mockVerificationId, mockSelfieBuffer),
      ).rejects.toThrow(BadRequestException);

      expect(mockVerificationRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: VerificationStatus.FAILED,
          failureReason: 'Liveness check failed',
        }),
      );
    });
  });
}); 