import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  RekognitionClient,
  CompareFacesCommand,
  DetectFacesCommand,
  CompareFacesResponse,
  FaceDetail,
  Attribute,
} from '@aws-sdk/client-rekognition';

@Injectable()
export class FaceVerificationService {
  private readonly logger = new Logger(FaceVerificationService.name);
  private readonly rekognitionClient: RekognitionClient;
  private readonly SIMILARITY_THRESHOLD = 90.0; // Minimum similarity score for face match
  private readonly QUALITY_THRESHOLD = 80.0; // Minimum quality score for face detection

  constructor(private readonly configService: ConfigService) {
    this.rekognitionClient = new RekognitionClient({
      region: this.configService.get<string>('aws.region'),
      credentials: {
        accessKeyId: this.configService.get<string>('aws.credentials.accessKeyId'),
        secretAccessKey: this.configService.get<string>('aws.credentials.secretAccessKey'),
      },
    });
  }

  async verifyFaceMatch(
    documentFaceBuffer: Buffer,
    selfieFaceBuffer: Buffer,
  ): Promise<{
    isMatch: boolean;
    confidence: number;
    details: Record<string, any>;
  }> {
    try {
      // First, verify the quality of both images
      const [documentFaceQuality, selfieFaceQuality] = await Promise.all([
        this.detectFaceQuality(documentFaceBuffer),
        this.detectFaceQuality(selfieFaceBuffer),
      ]);

      if (!documentFaceQuality.isValid) {
        throw new BadRequestException(`Document face image issue: ${documentFaceQuality.reason}`);
      }

      if (!selfieFaceQuality.isValid) {
        throw new BadRequestException(`Selfie image issue: ${selfieFaceQuality.reason}`);
      }

      // Compare faces
      const compareFacesCommand = new CompareFacesCommand({
        SourceImage: { Bytes: documentFaceBuffer },
        TargetImage: { Bytes: selfieFaceBuffer },
        SimilarityThreshold: this.SIMILARITY_THRESHOLD,
        QualityFilter: 'HIGH',
      });

      const comparison = await this.rekognitionClient.send(compareFacesCommand);

      if (!comparison.FaceMatches || comparison.FaceMatches.length === 0) {
        return {
          isMatch: false,
          confidence: 0,
          details: {
            reason: 'No matching faces found',
            unmatched: comparison.UnmatchedFaces?.length || 0,
          },
        };
      }

      const bestMatch = comparison.FaceMatches[0];
      const confidence = bestMatch.Similarity || 0;

      return {
        isMatch: confidence >= this.SIMILARITY_THRESHOLD,
        confidence,
        details: {
          boundingBox: bestMatch.Face?.BoundingBox,
          landmarks: bestMatch.Face?.Landmarks,
          quality: bestMatch.Face?.Quality,
          pose: bestMatch.Face?.Pose,
        },
      };
    } catch (error) {
      this.logger.error(`Error in face comparison: ${error.message}`, error.stack);
      throw new BadRequestException(error.message);
    }
  }

  async detectLiveness(
    selfieBuffer: Buffer,
  ): Promise<{
    isLive: boolean;
    confidence: number;
    details: Record<string, any>;
  }> {
    try {
      const command = new DetectFacesCommand({
        Image: { Bytes: selfieBuffer },
        Attributes: ['ALL'] as Attribute[],
      });

      const response = await this.rekognitionClient.send(command);

      if (!response.FaceDetails || response.FaceDetails.length === 0) {
        throw new BadRequestException('No face detected in the image');
      }

      if (response.FaceDetails.length > 1) {
        throw new BadRequestException('Multiple faces detected in the image');
      }

      const faceDetails = response.FaceDetails[0];
      const livenessScore = this.calculateLivenessScore(faceDetails);

      return {
        isLive: livenessScore >= this.QUALITY_THRESHOLD,
        confidence: livenessScore,
        details: {
          eyesOpen: faceDetails.EyesOpen,
          mouthOpen: faceDetails.MouthOpen,
          eyeglasses: faceDetails.Eyeglasses,
          sunglasses: faceDetails.Sunglasses,
          beard: faceDetails.Beard,
          emotions: faceDetails.Emotions,
          quality: faceDetails.Quality,
          pose: faceDetails.Pose,
        },
      };
    } catch (error) {
      this.logger.error(`Error in liveness detection: ${error.message}`, error.stack);
      throw new BadRequestException(error.message);
    }
  }

  private async detectFaceQuality(
    imageBuffer: Buffer,
  ): Promise<{ isValid: boolean; reason?: string }> {
    try {
      const command = new DetectFacesCommand({
        Image: { Bytes: imageBuffer },
        Attributes: ['QUALITY', 'POSE'] as Attribute[],
      });

      const response = await this.rekognitionClient.send(command);

      if (!response.FaceDetails || response.FaceDetails.length === 0) {
        return { isValid: false, reason: 'No face detected in the image' };
      }

      if (response.FaceDetails.length > 1) {
        return { isValid: false, reason: 'Multiple faces detected in the image' };
      }

      const faceDetails = response.FaceDetails[0];

      // Check face quality
      if (!this.isQualityAcceptable(faceDetails)) {
        return { isValid: false, reason: 'Image quality is too low' };
      }

      // Check face pose
      if (!this.isPoseAcceptable(faceDetails)) {
        return { isValid: false, reason: 'Face pose is not acceptable' };
      }

      return { isValid: true };
    } catch (error) {
      this.logger.error(`Error in face quality detection: ${error.message}`, error.stack);
      return { isValid: false, reason: error.message };
    }
  }

  private calculateLivenessScore(faceDetails: FaceDetail): number {
    let score = 0;
    let factors = 0;

    // Check if eyes are open
    if (faceDetails.EyesOpen?.Confidence) {
      score += faceDetails.EyesOpen.Confidence;
      factors++;
    }

    // Check image quality
    if (faceDetails.Quality?.Brightness) {
      score += faceDetails.Quality.Brightness;
      factors++;
    }

    if (faceDetails.Quality?.Sharpness) {
      score += faceDetails.Quality.Sharpness;
      factors++;
    }

    // Check face pose
    if (this.isPoseAcceptable(faceDetails)) {
      score += 100;
      factors++;
    }

    // Check for suspicious attributes
    if (faceDetails.Sunglasses?.Value === false) {
      score += 100;
      factors++;
    }

    return factors > 0 ? score / factors : 0;
  }

  private isQualityAcceptable(faceDetails: FaceDetail): boolean {
    const quality = faceDetails.Quality;
    if (!quality) return false;

    const minBrightness = 50;
    const minSharpness = 50;

    return (
      (quality.Brightness || 0) >= minBrightness &&
      (quality.Sharpness || 0) >= minSharpness
    );
  }

  private isPoseAcceptable(faceDetails: FaceDetail): boolean {
    const pose = faceDetails.Pose;
    if (!pose) return false;

    // Maximum allowed angles for pose
    const maxAngle = 20;

    return (
      Math.abs(pose.Pitch || 0) <= maxAngle &&
      Math.abs(pose.Roll || 0) <= maxAngle &&
      Math.abs(pose.Yaw || 0) <= maxAngle
    );
  }
} 