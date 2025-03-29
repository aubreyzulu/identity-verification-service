import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Verification, VerificationStatus, DocumentType } from './entities/verification.entity';
import { DocumentVerificationService } from './services/document-verification.service';
import { FaceVerificationService } from './services/face-verification.service';

@Injectable()
export class VerificationService {
  private readonly logger = new Logger(VerificationService.name);

  constructor(
    @InjectRepository(Verification)
    private readonly verificationRepository: Repository<Verification>,
    private readonly documentVerificationService: DocumentVerificationService,
    private readonly faceVerificationService: FaceVerificationService,
  ) {}

  async startVerification(
    userId: string,
    documentType: DocumentType,
    documentBuffer: Buffer,
  ): Promise<Verification> {
    const verification = this.verificationRepository.create({
      userId,
      documentType,
      status: VerificationStatus.IN_PROGRESS,
    });

    await this.verificationRepository.save(verification);

    try {
      // Verify document
      const documentResult = await this.documentVerificationService.verifyDocument(
        documentType,
        documentBuffer,
      );

      verification.documentData = documentResult.extractedData;
      verification.confidenceScore = documentResult.confidenceScore;

      if (!documentResult.isValid) {
        verification.status = VerificationStatus.FAILED;
        verification.failureReason = 'Document verification failed';
        await this.verificationRepository.save(verification);
        throw new BadRequestException('Document verification failed');
      }

      await this.verificationRepository.save(verification);
      return verification;
    } catch (error) {
      this.logger.error(`Error in document verification: ${error.message}`, error.stack);
      verification.status = VerificationStatus.FAILED;
      verification.failureReason = error.message;
      await this.verificationRepository.save(verification);
      throw error;
    }
  }

  async verifyFace(
    verificationId: string,
    selfieBuffer: Buffer,
  ): Promise<Verification> {
    const verification = await this.verificationRepository.findOne({
      where: { id: verificationId },
    });

    if (!verification) {
      throw new BadRequestException('Verification not found');
    }

    try {
      // First check liveness
      const livenessResult = await this.faceVerificationService.detectLiveness(
        selfieBuffer,
      );

      if (!livenessResult.isLive) {
        verification.status = VerificationStatus.FAILED;
        verification.failureReason = 'Liveness check failed';
        await this.verificationRepository.save(verification);
        throw new BadRequestException('Liveness check failed');
      }

      // Then verify face match
      const faceMatchResult = await this.faceVerificationService.verifyFaceMatch(
        Buffer.from(''), // You would get this from the document image
        selfieBuffer,
      );

      verification.faceMatchResult = faceMatchResult;

      if (!faceMatchResult.isMatch) {
        verification.status = VerificationStatus.FAILED;
        verification.failureReason = 'Face match failed';
        await this.verificationRepository.save(verification);
        throw new BadRequestException('Face match failed');
      }

      verification.status = VerificationStatus.COMPLETED;
      await this.verificationRepository.save(verification);

      return verification;
    } catch (error) {
      this.logger.error(`Error in face verification: ${error.message}`, error.stack);
      verification.status = VerificationStatus.FAILED;
      verification.failureReason = error.message;
      await this.verificationRepository.save(verification);
      throw error;
    }
  }

  async getVerificationStatus(verificationId: string): Promise<Verification> {
    const verification = await this.verificationRepository.findOne({
      where: { id: verificationId },
    });

    if (!verification) {
      throw new BadRequestException('Verification not found');
    }

    return verification;
  }
} 