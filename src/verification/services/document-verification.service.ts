import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  TextractClient,
  AnalyzeIDCommand,
  GetDocumentAnalysisCommand,
  DocumentType as AwsDocumentType,
} from '@aws-sdk/client-textract';
import { DocumentType } from '../entities/verification.entity';

@Injectable()
export class DocumentVerificationService {
  private readonly logger = new Logger(DocumentVerificationService.name);
  private readonly textractClient: TextractClient;

  constructor(private readonly configService: ConfigService) {
    this.textractClient = new TextractClient({
      region: this.configService.get<string>('aws.region'),
      credentials: {
        accessKeyId: this.configService.get<string>('aws.credentials.accessKeyId'),
        secretAccessKey: this.configService.get<string>('aws.credentials.secretAccessKey'),
      },
    });
  }

  async verifyDocument(
    documentType: DocumentType,
    documentBuffer: Buffer,
  ): Promise<{
    isValid: boolean;
    extractedData: Record<string, any>;
    confidenceScore: number;
  }> {
    try {
      const command = new AnalyzeIDCommand({
        DocumentPages: [{ Bytes: documentBuffer }],
      });

      const response = await this.textractClient.send(command);
      
      if (!response.IdentityDocuments?.[0]) {
        throw new BadRequestException('Failed to analyze document');
      }

      const document = response.IdentityDocuments[0];
      const fields = this.parseDocumentFields(document);
      
      // Validate document based on type
      const validationResult = await this.validateDocumentAuthenticity(documentType, fields);
      
      if (!validationResult.isValid) {
        throw new BadRequestException(validationResult.reason);
      }

      return {
        isValid: true,
        extractedData: fields,
        confidenceScore: this.calculateConfidenceScore(document),
      };
    } catch (error) {
      this.logger.error(`Error verifying document: ${error.message}`, error.stack);
      throw new BadRequestException(error.message);
    }
  }

  private parseDocumentFields(document: any): Record<string, any> {
    const fields: Record<string, any> = {};
    
    document.IdentityDocumentFields?.forEach((field: any) => {
      if (field.Type?.Text && field.ValueDetection?.Text) {
        fields[field.Type.Text.toLowerCase()] = {
          value: field.ValueDetection.Text,
          confidence: field.ValueDetection.Confidence,
        };
      }
    });

    return fields;
  }

  private calculateConfidenceScore(document: any): number {
    let totalConfidence = 0;
    let fieldCount = 0;

    document.IdentityDocumentFields?.forEach((field: any) => {
      if (field.ValueDetection?.Confidence) {
        totalConfidence += field.ValueDetection.Confidence;
        fieldCount++;
      }
    });

    return fieldCount > 0 ? totalConfidence / fieldCount : 0;
  }

  private async validateDocumentAuthenticity(
    documentType: DocumentType,
    extractedData: Record<string, any>,
  ): Promise<{ isValid: boolean; reason?: string }> {
    try {
      // Check if required fields are present based on document type
      const requiredFields = this.getRequiredFields(documentType);
      const missingFields = requiredFields.filter(
        field => !extractedData[field.toLowerCase()]?.value,
      );

      if (missingFields.length > 0) {
        return {
          isValid: false,
          reason: `Missing required fields: ${missingFields.join(', ')}`,
        };
      }

      // Check document expiration
      if (extractedData['expiration_date']?.value) {
        const expirationDate = new Date(extractedData['expiration_date'].value);
        if (expirationDate < new Date()) {
          return {
            isValid: false,
            reason: 'Document has expired',
          };
        }
      }

      // Add more validation rules based on document type
      switch (documentType) {
        case DocumentType.PASSPORT:
          return this.validatePassport(extractedData);
        case DocumentType.DRIVERS_LICENSE:
          return this.validateDriversLicense(extractedData);
        case DocumentType.ID_CARD:
          return this.validateIdCard(extractedData);
        default:
          return { isValid: true };
      }
    } catch (error) {
      this.logger.error(`Validation error: ${error.message}`, error.stack);
      return { isValid: false, reason: 'Document validation failed' };
    }
  }

  private getRequiredFields(documentType: DocumentType): string[] {
    const commonFields = ['FIRST_NAME', 'LAST_NAME', 'DATE_OF_BIRTH'];
    
    switch (documentType) {
      case DocumentType.PASSPORT:
        return [...commonFields, 'PASSPORT_NUMBER', 'EXPIRATION_DATE', 'NATIONALITY'];
      case DocumentType.DRIVERS_LICENSE:
        return [...commonFields, 'LICENSE_NUMBER', 'EXPIRATION_DATE', 'STATE'];
      case DocumentType.ID_CARD:
        return [...commonFields, 'ID_NUMBER', 'EXPIRATION_DATE'];
      default:
        return commonFields;
    }
  }

  private validatePassport(data: Record<string, any>): { isValid: boolean; reason?: string } {
    // Implement passport-specific validation rules
    const passportNumber = data['passport_number']?.value;
    if (!passportNumber || !/^[A-Z0-9]{6,9}$/.test(passportNumber)) {
      return {
        isValid: false,
        reason: 'Invalid passport number format',
      };
    }
    return { isValid: true };
  }

  private validateDriversLicense(data: Record<string, any>): { isValid: boolean; reason?: string } {
    // Implement driver's license-specific validation rules
    const licenseNumber = data['license_number']?.value;
    if (!licenseNumber || licenseNumber.length < 5) {
      return {
        isValid: false,
        reason: 'Invalid license number format',
      };
    }
    return { isValid: true };
  }

  private validateIdCard(data: Record<string, any>): { isValid: boolean; reason?: string } {
    // Implement ID card-specific validation rules
    const idNumber = data['id_number']?.value;
    if (!idNumber || idNumber.length < 5) {
      return {
        isValid: false,
        reason: 'Invalid ID number format',
      };
    }
    return { isValid: true };
  }
} 