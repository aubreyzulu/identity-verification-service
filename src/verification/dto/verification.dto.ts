import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsEnum, IsNotEmpty, IsUUID, Matches, MaxLength, MinLength, IsOptional } from 'class-validator';
import { DocumentType } from '../entities/verification.entity';

export class StartVerificationDto {
  @ApiProperty({
    description: 'User ID for whom the verification is being performed',
    example: 'user123',
    minLength: 3,
    maxLength: 50,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(3, { message: 'User ID must be at least 3 characters long' })
  @MaxLength(50, { message: 'User ID cannot exceed 50 characters' })
  @Matches(/^[a-zA-Z0-9_-]+$/, { message: 'User ID can only contain letters, numbers, underscores, and hyphens' })
  userId: string;

  @ApiProperty({
    description: 'Type of document being verified',
    enum: DocumentType,
    example: DocumentType.PASSPORT,
  })
  @IsEnum(DocumentType, { message: 'Invalid document type. Must be one of: passport, drivers_license, id_card' })
  @IsNotEmpty()
  documentType: DocumentType;

  @ApiProperty({
    description: 'Document file (image or PDF)',
    type: 'string',
    format: 'binary',
  })
  document: Express.Multer.File;
}

export class VerifyFaceDto {
  @ApiProperty({
    description: 'Verification ID from the document verification step',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID(4, { message: 'Invalid verification ID format' })
  @IsNotEmpty()
  verificationId: string;

  @ApiProperty({
    description: 'Selfie image file',
    type: 'string',
    format: 'binary',
  })
  selfie: Express.Multer.File;
}

export class VerificationResponseDto {
  @ApiProperty({
    description: 'Unique identifier for the verification',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({
    description: 'User ID associated with the verification',
    example: 'user123',
  })
  userId: string;

  @ApiProperty({
    description: 'Type of document being verified',
    enum: DocumentType,
    example: DocumentType.PASSPORT,
  })
  documentType: DocumentType;

  @ApiProperty({
    description: 'Extracted data from the document',
    example: {
      documentNumber: 'ABC123456',
      expiryDate: '2025-12-31',
      fullName: 'John Doe',
      dateOfBirth: '1990-01-01',
    },
  })
  documentData: Record<string, any>;

  @ApiProperty({
    description: 'URL of the stored document image',
    example: 'uploads/document-123.jpg',
  })
  documentImageUrl: string;

  @ApiProperty({
    description: 'URL of the stored selfie image',
    example: 'uploads/selfie-123.jpg',
  })
  selfieImageUrl: string;

  @ApiProperty({
    description: 'Results of face matching verification',
    example: {
      isMatch: true,
      confidence: 0.98,
      details: {
        boundingBox: {},
        landmarks: [],
        quality: {},
        pose: {},
      },
    },
  })
  faceMatchResult: Record<string, any>;

  @ApiProperty({
    description: 'Overall confidence score of the verification',
    example: 0.95,
    minimum: 0,
    maximum: 1,
  })
  confidenceScore: number;

  @ApiProperty({
    description: 'Reason for verification failure, if any',
    example: 'Document has expired',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Failure reason cannot exceed 500 characters' })
  failureReason?: string;

  @ApiProperty({
    description: 'Timestamp when the verification was created',
    example: '2024-03-29T10:00:00Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Timestamp when the verification was last updated',
    example: '2024-03-29T10:05:00Z',
  })
  updatedAt: Date;
} 