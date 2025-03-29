import { Test, TestingModule } from '@nestjs/testing';
import { VerificationController } from './verification.controller';
import { VerificationService } from './verification.service';
import { DocumentType, VerificationStatus } from './entities/verification.entity';
import { BadRequestException } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { ThrottlerModule } from '@nestjs/throttler';

describe('VerificationController', () => {
  let controller: VerificationController;
  let verificationService: VerificationService;

  const mockVerificationService = {
    startVerification: jest.fn(),
    verifyFace: jest.fn(),
    getVerificationStatus: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        PassportModule.register({ defaultStrategy: 'jwt' }),
        ThrottlerModule.forRoot([{
          ttl: 60000,
          limit: 10,
        }]),
      ],
      controllers: [VerificationController],
      providers: [
        {
          provide: VerificationService,
          useValue: mockVerificationService,
        },
      ],
    })
    .overrideGuard('JwtAuthGuard')
    .useValue({ canActivate: () => true })
    .overrideGuard('ThrottlerGuard')
    .useValue({ canActivate: () => true })
    .compile();

    controller = module.get<VerificationController>(VerificationController);
    verificationService = module.get<VerificationService>(VerificationService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('verifyDocument', () => {
    it('should successfully start a document verification', async () => {
      // Mock data
      const userId = 'user123';
      const documentType = DocumentType.PASSPORT;
      const file = {
        buffer: Buffer.from('test-image-data'),
        originalname: 'passport.jpg',
      } as Express.Multer.File;
      const requestId = 'req-123';

      // Mock service response
      const expectedResponse = {
        id: 'verification-123',
        userId,
        documentType,
        status: VerificationStatus.IN_PROGRESS,
      };
      mockVerificationService.startVerification.mockResolvedValueOnce(expectedResponse);

      // Call the controller method
      const result = await controller.verifyDocument(
        userId,
        documentType,
        file,
        requestId,
      );

      // Assertions
      expect(mockVerificationService.startVerification).toHaveBeenCalledWith(
        userId,
        documentType,
        file.buffer,
        requestId,
      );
      expect(result).toEqual(expectedResponse);
    });

    it('should throw BadRequestException when file is missing', async () => {
      const userId = 'user123';
      const documentType = DocumentType.PASSPORT;
      const requestId = 'req-123';

      await expect(
        controller.verifyDocument(
          userId,
          documentType,
          null, // Missing file
          requestId,
        )
      ).rejects.toThrow(BadRequestException);
      
      expect(mockVerificationService.startVerification).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when document type is invalid', async () => {
      const userId = 'user123';
      const file = {
        buffer: Buffer.from('test-image-data'),
        originalname: 'passport.jpg',
      } as Express.Multer.File;
      const requestId = 'req-123';
      const invalidDocType = 'invalid_type' as DocumentType;

      await expect(
        controller.verifyDocument(
          userId,
          invalidDocType,
          file,
          requestId,
        )
      ).rejects.toThrow(BadRequestException);
      
      expect(mockVerificationService.startVerification).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when request ID is missing', async () => {
      const userId = 'user123';
      const documentType = DocumentType.PASSPORT;
      const file = {
        buffer: Buffer.from('test-image-data'),
        originalname: 'passport.jpg',
      } as Express.Multer.File;

      await expect(
        controller.verifyDocument(
          userId,
          documentType,
          file,
          null, // Missing request ID
        )
      ).rejects.toThrow(BadRequestException);
      
      expect(mockVerificationService.startVerification).not.toHaveBeenCalled();
    });
  });

  describe('verifyFace', () => {
    it('should successfully verify a face', async () => {
      // Mock data
      const verificationId = 'verification-123';
      const file = {
        buffer: Buffer.from('selfie-image-data'),
        originalname: 'selfie.jpg',
      } as Express.Multer.File;
      const requestId = 'req-123';

      // Mock service response
      const expectedResponse = {
        id: verificationId,
        status: VerificationStatus.COMPLETED,
        faceMatchResult: {
          isMatch: true,
          confidence: 0.95,
        },
      };
      mockVerificationService.verifyFace.mockResolvedValueOnce(expectedResponse);

      // Call the controller method
      const result = await controller.verifyFace(
        verificationId,
        file,
        requestId,
      );

      // Assertions
      expect(mockVerificationService.verifyFace).toHaveBeenCalledWith(
        verificationId,
        file.buffer,
        requestId,
      );
      expect(result).toEqual(expectedResponse);
    });

    it('should throw BadRequestException when file is missing', async () => {
      const verificationId = 'verification-123';
      const requestId = 'req-123';

      await expect(
        controller.verifyFace(
          verificationId,
          null, // Missing file
          requestId,
        )
      ).rejects.toThrow(BadRequestException);
      
      expect(mockVerificationService.verifyFace).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when request ID is missing', async () => {
      const verificationId = 'verification-123';
      const file = {
        buffer: Buffer.from('selfie-image-data'),
        originalname: 'selfie.jpg',
      } as Express.Multer.File;

      await expect(
        controller.verifyFace(
          verificationId,
          file,
          null, // Missing request ID
        )
      ).rejects.toThrow(BadRequestException);
      
      expect(mockVerificationService.verifyFace).not.toHaveBeenCalled();
    });

    it('should propagate service exceptions', async () => {
      const verificationId = 'verification-123';
      const file = {
        buffer: Buffer.from('selfie-image-data'),
        originalname: 'selfie.jpg',
      } as Express.Multer.File;
      const requestId = 'req-123';

      // Mock service to throw an exception
      mockVerificationService.verifyFace.mockRejectedValueOnce(
        new BadRequestException('Verification not found'),
      );

      await expect(
        controller.verifyFace(
          verificationId,
          file,
          requestId,
        )
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getVerificationStatus', () => {
    it('should successfully get verification status', async () => {
      // Mock data
      const verificationId = 'verification-123';
      const requestId = 'req-123';

      // Mock service response
      const expectedResponse = {
        id: verificationId,
        status: VerificationStatus.COMPLETED,
        documentData: { name: 'John Doe' },
        confidenceScore: 0.95,
      };
      mockVerificationService.getVerificationStatus.mockResolvedValueOnce(expectedResponse);

      // Call the controller method
      const result = await controller.getVerificationStatus(
        verificationId,
        requestId,
      );

      // Assertions
      expect(mockVerificationService.getVerificationStatus).toHaveBeenCalledWith(
        verificationId,
      );
      expect(result).toEqual(expectedResponse);
    });

    it('should throw BadRequestException when request ID is missing', async () => {
      const verificationId = 'verification-123';

      await expect(
        controller.getVerificationStatus(
          verificationId,
          null, // Missing request ID
        )
      ).rejects.toThrow(BadRequestException);
      
      expect(mockVerificationService.getVerificationStatus).not.toHaveBeenCalled();
    });

    it('should propagate service exceptions', async () => {
      const verificationId = 'verification-123';
      const requestId = 'req-123';

      // Mock service to throw an exception
      mockVerificationService.getVerificationStatus.mockRejectedValueOnce(
        new BadRequestException('Verification not found'),
      );

      await expect(
        controller.getVerificationStatus(
          verificationId,
          requestId,
        )
      ).rejects.toThrow(BadRequestException);
    });
  });
}); 