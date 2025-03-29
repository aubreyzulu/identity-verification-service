import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class SecurityService {
  constructor(private readonly configService: ConfigService) {}

  generateRequestId(): string {
    return crypto.randomUUID();
  }

  validateFileType(file: Express.Multer.File, type: 'document' | 'selfie'): boolean {
    const allowedTypes = type === 'document'
      ? this.configService.get('app.upload.allowedDocumentTypes')
      : this.configService.get('app.upload.allowedSelfieTypes');
    
    return allowedTypes.includes(file.mimetype);
  }

  validateFileSize(file: Express.Multer.File): boolean {
    const maxSize = this.configService.get('app.upload.maxFileSize');
    return file.size <= maxSize;
  }

  generateSecureFilename(originalName: string): string {
    const ext = originalName.split('.').pop();
    return `${crypto.randomUUID()}.${ext}`;
  }

  sanitizeOutput(data: any): any {
    // Remove sensitive fields before sending response
    const sensitiveFields = ['password', 'secret', 'token'];
    if (typeof data === 'object' && data !== null) {
      Object.keys(data).forEach(key => {
        if (sensitiveFields.includes(key.toLowerCase())) {
          delete data[key];
        } else if (typeof data[key] === 'object') {
          data[key] = this.sanitizeOutput(data[key]);
        }
      });
    }
    return data;
  }
} 