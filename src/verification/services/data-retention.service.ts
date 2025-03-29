import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Verification } from '../entities/verification.entity';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class DataRetentionService {
  private readonly logger = new Logger(DataRetentionService.name);

  constructor(
    @InjectRepository(Verification)
    private readonly verificationRepository: Repository<Verification>,
    private readonly configService: ConfigService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async cleanupOldVerifications() {
    try {
      const retentionDays = this.configService.get<number>('dataRetention.verificationRecords');
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      const result = await this.verificationRepository.delete({
        createdAt: LessThan(cutoffDate),
      });

      this.logger.log(`Cleaned up ${result.affected} old verification records`);
    } catch (error) {
      this.logger.error(`Error cleaning up old verifications: ${error.message}`, error.stack);
    }
  }

  @Cron(CronExpression.EVERY_HOUR)
  async cleanupOldFiles() {
    try {
      const documentRetentionDays = this.configService.get<number>('dataRetention.documentImages');
      const uploadsDir = path.join(process.cwd(), 'uploads');

      // Ensure uploads directory exists
      if (!fs.existsSync(uploadsDir)) {
        return;
      }

      const files = fs.readdirSync(uploadsDir);
      const now = new Date().getTime();
      let deletedCount = 0;

      for (const file of files) {
        const filePath = path.join(uploadsDir, file);
        const stats = fs.statSync(filePath);
        const fileAge = (now - stats.mtime.getTime()) / (1000 * 60 * 60 * 24); // Age in days

        if (fileAge > documentRetentionDays) {
          fs.unlinkSync(filePath);
          deletedCount++;
        }
      }

      this.logger.log(`Cleaned up ${deletedCount} old files`);
    } catch (error) {
      this.logger.error(`Error cleaning up old files: ${error.message}`, error.stack);
    }
  }

  // Method to immediately delete a specific file
  async deleteFile(filePath: string) {
    try {
      const fullPath = path.join(process.cwd(), 'uploads', filePath);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
        this.logger.log(`Deleted file: ${filePath}`);
      }
    } catch (error) {
      this.logger.error(`Error deleting file ${filePath}: ${error.message}`, error.stack);
    }
  }
} 