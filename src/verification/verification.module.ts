import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { VerificationController } from './verification.controller';
import { VerificationService } from './verification.service';
import { Verification } from './entities/verification.entity';
import { DocumentVerificationService } from './services/document-verification.service';
import { FaceVerificationService } from './services/face-verification.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Verification]),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        ttl: config.get('rateLimit.ttl'),
        limit: config.get('rateLimit.limit'),
      }),
    }),
  ],
  controllers: [VerificationController],
  providers: [
    VerificationService,
    DocumentVerificationService,
    FaceVerificationService,
  ],
  exports: [VerificationService],
})
export class VerificationModule {} 