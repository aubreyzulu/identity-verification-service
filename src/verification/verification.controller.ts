import {
  Controller,
  Post,
  Get,
  Param,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Body,
  UseGuards,
  Headers,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiConsumes, ApiBody, ApiBearerAuth, ApiHeader, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AuthGuard } from '@nestjs/passport';
import { VerificationService } from './verification.service';
import { DocumentType } from './entities/verification.entity';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { StartVerificationDto, VerifyFaceDto, VerificationResponseDto } from './dto/verification.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RateLimit } from '../common/decorators/rate-limit.decorator';

@ApiTags('verification')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), ThrottlerGuard)
@Controller('verification')
export class VerificationController {
  constructor(private readonly verificationService: VerificationService) {}

  @Post('document')
  @ApiOperation({ summary: 'Start document verification process' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Document verification request',
    type: StartVerificationDto,
  })
  @ApiResponse({
    status: 201,
    description: 'Document verification started successfully',
    type: VerificationResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid request data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  @RateLimit({ points: 5, duration: 60 })
  @UseInterceptors(
    FileInterceptor('document', {
      storage: diskStorage({
        destination: './uploads',
        filename: (req, file, cb) => {
          const randomName = uuidv4();
          return cb(null, `${randomName}${extname(file.originalname)}`);
        },
      }),
      fileFilter: (req, file, cb) => {
        if (!file.originalname.match(/\.(jpg|jpeg|png|pdf)$/)) {
          return cb(new BadRequestException('Only image and PDF files are allowed'), false);
        }
        if (file.size > 5 * 1024 * 1024) { // 5MB limit
          return cb(new BadRequestException('File size too large'), false);
        }
        cb(null, true);
      },
    }),
  )
  @ApiHeader({
    name: 'X-Request-ID',
    description: 'Unique request identifier for tracking',
  })
  async verifyDocument(
    @Body('userId') userId: string,
    @Body('documentType') documentType: DocumentType,
    @UploadedFile() file: Express.Multer.File,
    @Headers('x-request-id') requestId: string,
  ) {
    if (!file) {
      throw new BadRequestException('Document file is required');
    }

    if (!Object.values(DocumentType).includes(documentType)) {
      throw new BadRequestException('Invalid document type');
    }

    if (!requestId) {
      throw new BadRequestException('X-Request-ID header is required');
    }

    return this.verificationService.startVerification(
      userId,
      documentType,
      file.buffer,
      requestId,
    );
  }

  @Post(':verificationId/face')
  @ApiOperation({ summary: 'Verify face with selfie' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Face verification request',
    type: VerifyFaceDto,
  })
  @ApiResponse({
    status: 200,
    description: 'Face verification completed successfully',
    type: VerificationResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid request data or verification not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  @RateLimit({ points: 5, duration: 60 })
  @UseInterceptors(
    FileInterceptor('selfie', {
      storage: diskStorage({
        destination: './uploads',
        filename: (req, file, cb) => {
          const randomName = uuidv4();
          return cb(null, `${randomName}${extname(file.originalname)}`);
        },
      }),
      fileFilter: (req, file, cb) => {
        if (!file.originalname.match(/\.(jpg|jpeg|png)$/)) {
          return cb(new BadRequestException('Only image files are allowed'), false);
        }
        if (file.size > 5 * 1024 * 1024) { // 5MB limit
          return cb(new BadRequestException('File size too large'), false);
        }
        cb(null, true);
      },
    }),
  )
  @ApiHeader({
    name: 'X-Request-ID',
    description: 'Unique request identifier for tracking',
  })
  async verifyFace(
    @Param('verificationId') verificationId: string,
    @UploadedFile() file: Express.Multer.File,
    @Headers('x-request-id') requestId: string,
  ) {
    if (!file) {
      throw new BadRequestException('Selfie file is required');
    }

    if (!requestId) {
      throw new BadRequestException('X-Request-ID header is required');
    }

    return this.verificationService.verifyFace(
      verificationId,
      file.buffer,
      requestId,
    );
  }

  @Get(':verificationId')
  @ApiOperation({ summary: 'Get verification status' })
  @ApiResponse({
    status: 200,
    description: 'Verification details retrieved successfully',
    type: VerificationResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid verification ID' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Verification not found' })
  @ApiHeader({
    name: 'X-Request-ID',
    description: 'Unique request identifier for tracking',
  })
  async getVerificationStatus(
    @Param('verificationId') verificationId: string,
    @Headers('x-request-id') requestId: string,
  ) {
    if (!requestId) {
      throw new BadRequestException('X-Request-ID header is required');
    }

    return this.verificationService.getVerificationStatus(verificationId);
  }
} 