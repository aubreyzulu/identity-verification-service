import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
import { FaceVerificationService } from './face-verification.service';
import { RekognitionClient } from '@aws-sdk/client-rekognition';

// Mock the AWS SDK
jest.mock('@aws-sdk/client-rekognition', () => {
  const originalModule = jest.requireActual('@aws-sdk/client-rekognition');
  return {
    ...originalModule,
    RekognitionClient: jest.fn().mockImplementation(() => ({
      send: jest.fn(),
    })),
    CompareFacesCommand: jest.fn(),
    DetectFacesCommand: jest.fn(),
  };
});

describe('FaceVerificationService', () => {
  let service: FaceVerificationService;
  let configService: ConfigService;
  let rekognitionClientMock: jest.Mocked<RekognitionClient>;

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config = {
        'aws.region': 'us-east-1',
        'aws.credentials.accessKeyId': 'test-access-key',
        'aws.credentials.secretAccessKey': 'test-secret-key',
      };
      return config[key];
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FaceVerificationService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<FaceVerificationService>(FaceVerificationService);
    configService = module.get<ConfigService>(ConfigService);
    
    // Cast the RekognitionClient constructor mock to access the mockImplementation
    const RekognitionClientMock = RekognitionClient as jest.MockedClass<typeof RekognitionClient>;
    rekognitionClientMock = RekognitionClientMock.mock.results[0].value as jest.Mocked<RekognitionClient>;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('verifyFaceMatch', () => {
    it('should successfully match two faces with high similarity', async () => {
      // Mock face quality detection to return valid for both images
      rekognitionClientMock.send
        .mockResolvedValueOnce({
          FaceDetails: [
            {
              Quality: { Brightness: 90, Sharpness: 85 },
              Pose: { Pitch: 0, Roll: 0, Yaw: 0 },
            },
          ],
        })
        .mockResolvedValueOnce({
          FaceDetails: [
            {
              Quality: { Brightness: 95, Sharpness: 90 },
              Pose: { Pitch: 5, Roll: 3, Yaw: 2 },
            },
          ],
        });

      // Mock successful face comparison
      rekognitionClientMock.send.mockResolvedValueOnce({
        FaceMatches: [
          {
            Similarity: 95.5,
            Face: {
              BoundingBox: { Width: 0.5, Height: 0.5, Left: 0.25, Top: 0.25 },
              Confidence: 99.9,
              Landmarks: [{ Type: 'eyeLeft', X: 0.3, Y: 0.3 }],
              Quality: { Brightness: 93, Sharpness: 92 },
              Pose: { Pitch: 2, Roll: 1, Yaw: 1 },
            },
          },
        ],
      });

      const result = await service.verifyFaceMatch(
        Buffer.from('document-face-data'),
        Buffer.from('selfie-face-data')
      );

      expect(result).toBeDefined();
      expect(result.isMatch).toBe(true);
      expect(result.confidence).toBe(95.5);
      expect(result.details).toBeDefined();
      expect(result.details.boundingBox).toBeDefined();
    });

    it('should return no match when similarity is below threshold', async () => {
      // Mock face quality detection to return valid for both images
      rekognitionClientMock.send
        .mockResolvedValueOnce({
          FaceDetails: [
            {
              Quality: { Brightness: 90, Sharpness: 85 },
              Pose: { Pitch: 0, Roll: 0, Yaw: 0 },
            },
          ],
        })
        .mockResolvedValueOnce({
          FaceDetails: [
            {
              Quality: { Brightness: 95, Sharpness: 90 },
              Pose: { Pitch: 5, Roll: 3, Yaw: 2 },
            },
          ],
        });

      // Mock face comparison with low similarity
      rekognitionClientMock.send.mockResolvedValueOnce({
        FaceMatches: [
          {
            Similarity: 85.0,
            Face: {
              BoundingBox: { Width: 0.5, Height: 0.5, Left: 0.25, Top: 0.25 },
              Confidence: 99.9,
            },
          },
        ],
      });

      const result = await service.verifyFaceMatch(
        Buffer.from('document-face-data'),
        Buffer.from('selfie-face-data')
      );

      expect(result).toBeDefined();
      expect(result.isMatch).toBe(false); // Below the 90.0 threshold
      expect(result.confidence).toBe(85.0);
    });

    it('should return no match when no faces match', async () => {
      // Mock face quality detection to return valid for both images
      rekognitionClientMock.send
        .mockResolvedValueOnce({
          FaceDetails: [
            {
              Quality: { Brightness: 90, Sharpness: 85 },
              Pose: { Pitch: 0, Roll: 0, Yaw: 0 },
            },
          ],
        })
        .mockResolvedValueOnce({
          FaceDetails: [
            {
              Quality: { Brightness: 95, Sharpness: 90 },
              Pose: { Pitch: 5, Roll: 3, Yaw: 2 },
            },
          ],
        });

      // Mock face comparison with no matches
      rekognitionClientMock.send.mockResolvedValueOnce({
        FaceMatches: [],
        UnmatchedFaces: [{}],
      });

      const result = await service.verifyFaceMatch(
        Buffer.from('document-face-data'),
        Buffer.from('selfie-face-data')
      );

      expect(result).toBeDefined();
      expect(result.isMatch).toBe(false);
      expect(result.confidence).toBe(0);
      expect(result.details.reason).toBe('No matching faces found');
      expect(result.details.unmatched).toBe(1);
    });

    it('should throw exception when document face image has poor quality', async () => {
      // Mock face quality detection to return invalid document image
      rekognitionClientMock.send
        .mockResolvedValueOnce({
          FaceDetails: [
            {
              Quality: { Brightness: 30, Sharpness: 25 }, // poor quality
              Pose: { Pitch: 0, Roll: 0, Yaw: 0 },
            },
          ],
        });

      await expect(
        service.verifyFaceMatch(
          Buffer.from('document-face-data'),
          Buffer.from('selfie-face-data')
        )
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw exception when selfie image has poor quality', async () => {
      // Mock face quality detection: document is good, selfie is poor
      rekognitionClientMock.send
        .mockResolvedValueOnce({
          FaceDetails: [
            {
              Quality: { Brightness: 90, Sharpness: 85 }, // good quality
              Pose: { Pitch: 0, Roll: 0, Yaw: 0 },
            },
          ],
        })
        .mockResolvedValueOnce({
          FaceDetails: [
            {
              Quality: { Brightness: 30, Sharpness: 25 }, // poor quality
              Pose: { Pitch: 0, Roll: 0, Yaw: 0 },
            },
          ],
        });

      await expect(
        service.verifyFaceMatch(
          Buffer.from('document-face-data'),
          Buffer.from('selfie-face-data')
        )
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw exception when AWS service fails', async () => {
      rekognitionClientMock.send.mockRejectedValueOnce(new Error('AWS Service Error'));

      await expect(
        service.verifyFaceMatch(
          Buffer.from('document-face-data'),
          Buffer.from('selfie-face-data')
        )
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('detectLiveness', () => {
    it('should successfully detect a live face', async () => {
      // Mock face detection with high quality live face
      rekognitionClientMock.send.mockResolvedValueOnce({
        FaceDetails: [
          {
            EyesOpen: { Value: true, Confidence: 99.9 },
            MouthOpen: { Value: false, Confidence: 95.5 },
            Eyeglasses: { Value: false, Confidence: 99.0 },
            Sunglasses: { Value: false, Confidence: 99.5 },
            Beard: { Value: false, Confidence: 98.0 },
            Emotions: [{ Type: 'CALM', Confidence: 97.0 }],
            Quality: { Brightness: 95, Sharpness: 93 },
            Pose: { Pitch: 2, Roll: 1, Yaw: 3 },
          },
        ],
      });

      const result = await service.detectLiveness(Buffer.from('selfie-data'));

      expect(result).toBeDefined();
      expect(result.isLive).toBe(true);
      expect(result.confidence).toBeGreaterThan(80); // Above threshold
      expect(result.details).toBeDefined();
      expect(result.details.eyesOpen).toBeDefined();
      expect(result.details.quality).toBeDefined();
    });

    it('should reject when no face is detected', async () => {
      // Mock no faces detected
      rekognitionClientMock.send.mockResolvedValueOnce({
        FaceDetails: [],
      });

      await expect(
        service.detectLiveness(Buffer.from('selfie-data'))
      ).rejects.toThrow('No face detected in the image');
    });

    it('should reject when multiple faces are detected', async () => {
      // Mock multiple faces detected
      rekognitionClientMock.send.mockResolvedValueOnce({
        FaceDetails: [{}, {}],
      });

      await expect(
        service.detectLiveness(Buffer.from('selfie-data'))
      ).rejects.toThrow('Multiple faces detected in the image');
    });

    it('should return non-live result for poor quality image', async () => {
      // Mock low quality face
      rekognitionClientMock.send.mockResolvedValueOnce({
        FaceDetails: [
          {
            EyesOpen: { Value: false, Confidence: 95.0 },
            Sunglasses: { Value: true, Confidence: 98.0 },
            Quality: { Brightness: 30, Sharpness: 25 }, // poor quality
            Pose: { Pitch: 30, Roll: 25, Yaw: 35 }, // bad pose
          },
        ],
      });

      const result = await service.detectLiveness(Buffer.from('selfie-data'));

      expect(result).toBeDefined();
      expect(result.isLive).toBe(false); // Below threshold
    });
  });

  describe('Private methods', () => {
    describe('isQualityAcceptable', () => {
      it('should correctly evaluate face quality', () => {
        const goodQuality = {
          Quality: { Brightness: 90, Sharpness: 85 },
        };
        const poorQuality = {
          Quality: { Brightness: 30, Sharpness: 25 },
        };
        const missingQuality = {};

        expect((service as any).isQualityAcceptable(goodQuality)).toBe(true);
        expect((service as any).isQualityAcceptable(poorQuality)).toBe(false);
        expect((service as any).isQualityAcceptable(missingQuality)).toBe(false);
      });
    });

    describe('isPoseAcceptable', () => {
      it('should correctly evaluate face pose', () => {
        const goodPose = {
          Pose: { Pitch: 5, Roll: 3, Yaw: 10 },
        };
        const badPose = {
          Pose: { Pitch: 30, Roll: 25, Yaw: 35 },
        };
        const missingPose = {};

        expect((service as any).isPoseAcceptable(goodPose)).toBe(true);
        expect((service as any).isPoseAcceptable(badPose)).toBe(false);
        expect((service as any).isPoseAcceptable(missingPose)).toBe(false);
      });
    });

    describe('calculateLivenessScore', () => {
      it('should calculate appropriate liveness score', () => {
        const highLivenessFace = {
          EyesOpen: { Value: true, Confidence: 99.0 },
          Quality: { Brightness: 95, Sharpness: 90 },
          Pose: { Pitch: 5, Roll: 3, Yaw: 10 },
          Sunglasses: { Value: false, Confidence: 99.0 },
        };

        const lowLivenessFace = {
          EyesOpen: { Value: false, Confidence: 90.0 },
          Quality: { Brightness: 40, Sharpness: 30 },
          Pose: { Pitch: 30, Roll: 25, Yaw: 35 },
          Sunglasses: { Value: true, Confidence: 98.0 },
        };

        const highScore = (service as any).calculateLivenessScore(highLivenessFace);
        const lowScore = (service as any).calculateLivenessScore(lowLivenessFace);

        expect(highScore).toBeGreaterThan(80); // Above threshold
        expect(lowScore).toBeLessThan(80); // Below threshold
      });
    });
  });
}); 