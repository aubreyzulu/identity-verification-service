import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { DataRetentionService } from './data-retention.service';
import { Verification } from '../entities/verification.entity';
import * as fs from 'fs';
import * as path from 'path';

// Mock external dependencies
jest.mock('fs', () => ({
  existsSync: jest.fn(),
  readdirSync: jest.fn(),
  statSync: jest.fn(),
  unlinkSync: jest.fn(),
}));

jest.mock('path', () => ({
  join: jest.fn().mockImplementation((...args) => args.join('/')),
}));

describe('DataRetentionService', () => {
  let service: DataRetentionService;
  let configService: ConfigService;
  let verificationRepository: Repository<Verification>;

  const mockRepository = {
    delete: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config = {
        'dataRetention.verificationRecords': 90, // 90 days
        'dataRetention.documentImages': 30, // 30 days
      };
      return config[key];
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DataRetentionService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: getRepositoryToken(Verification),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<DataRetentionService>(DataRetentionService);
    configService = module.get<ConfigService>(ConfigService);
    verificationRepository = module.get<Repository<Verification>>(
      getRepositoryToken(Verification),
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('cleanupOldVerifications', () => {
    it('should delete verification records older than the retention period', async () => {
      // Mock current date
      const mockDate = new Date('2023-01-01T00:00:00Z');
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate as unknown as string);

      // Mock database deletion
      mockRepository.delete.mockResolvedValueOnce({ affected: 5 });

      await service.cleanupOldVerifications();

      // Calculate expected cutoff date (90 days before mock date)
      const cutoffDate = new Date('2023-01-01T00:00:00Z');
      cutoffDate.setDate(cutoffDate.getDate() - 90);

      // Verify repository was called with correct parameters
      expect(verificationRepository.delete).toHaveBeenCalledWith({
        createdAt: LessThan(cutoffDate),
      });
      
      // Verify config service was called
      expect(configService.get).toHaveBeenCalledWith('dataRetention.verificationRecords');
    });

    it('should handle errors during verification cleanup', async () => {
      // Mock error
      mockRepository.delete.mockRejectedValueOnce(new Error('Database connection error'));
      
      // Create spy on logger
      const loggerErrorSpy = jest.spyOn(service['logger'], 'error');
      
      await service.cleanupOldVerifications();
      
      // Verify error was logged
      expect(loggerErrorSpy).toHaveBeenCalled();
      expect(loggerErrorSpy.mock.calls[0][0]).toContain('Error cleaning up old verifications');
    });
  });

  describe('cleanupOldFiles', () => {
    it('should delete files older than the retention period', async () => {
      // Mock current time
      const mockNow = new Date('2023-01-01T00:00:00Z').getTime();
      jest.spyOn(Date.prototype, 'getTime').mockReturnValue(mockNow);

      // Mock that uploads directory exists and contains files
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readdirSync as jest.Mock).mockReturnValue(['file1.jpg', 'file2.pdf', 'file3.png']);
      
      // Set up file stats with different modification times
      (fs.statSync as jest.Mock).mockImplementation((filePath) => {
        const fileMap = {
          'cwd/uploads/file1.jpg': { mtime: new Date(mockNow - 40 * 24 * 60 * 60 * 1000) }, // 40 days old (should be deleted)
          'cwd/uploads/file2.pdf': { mtime: new Date(mockNow - 10 * 24 * 60 * 60 * 1000) }, // 10 days old (should be kept)
          'cwd/uploads/file3.png': { mtime: new Date(mockNow - 35 * 24 * 60 * 60 * 1000) }, // 35 days old (should be deleted)
        };
        return fileMap[filePath];
      });

      (path.join as jest.Mock).mockImplementation((...args) => 
        args.join('/').replace('process.cwd()', 'cwd')
      );
      
      jest.spyOn(process, 'cwd').mockReturnValue('cwd');
      
      await service.cleanupOldFiles();
      
      // Verify unlinkSync was called for files older than 30 days
      expect(fs.unlinkSync).toHaveBeenCalledTimes(2);
      expect(fs.unlinkSync).toHaveBeenCalledWith('cwd/uploads/file1.jpg');
      expect(fs.unlinkSync).toHaveBeenCalledWith('cwd/uploads/file3.png');
      
      // Verify config service was called
      expect(configService.get).toHaveBeenCalledWith('dataRetention.documentImages');
    });

    it('should do nothing if uploads directory does not exist', async () => {
      // Mock that uploads directory doesn't exist
      (fs.existsSync as jest.Mock).mockReturnValue(false);
      
      await service.cleanupOldFiles();
      
      // Verify no further operations were attempted
      expect(fs.readdirSync).not.toHaveBeenCalled();
      expect(fs.statSync).not.toHaveBeenCalled();
      expect(fs.unlinkSync).not.toHaveBeenCalled();
    });

    it('should handle errors during file cleanup', async () => {
      // Mock error when reading directory
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readdirSync as jest.Mock).mockImplementation(() => {
        throw new Error('Permission denied');
      });
      
      // Create spy on logger
      const loggerErrorSpy = jest.spyOn(service['logger'], 'error');
      
      await service.cleanupOldFiles();
      
      // Verify error was logged
      expect(loggerErrorSpy).toHaveBeenCalled();
      expect(loggerErrorSpy.mock.calls[0][0]).toContain('Error cleaning up old files');
    });
  });

  describe('deleteFile', () => {
    it('should delete a specific file when it exists', async () => {
      // Mock file existence
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (path.join as jest.Mock).mockReturnValue('cwd/uploads/file-to-delete.jpg');
      
      await service.deleteFile('file-to-delete.jpg');
      
      // Verify file was deleted
      expect(fs.unlinkSync).toHaveBeenCalledWith('cwd/uploads/file-to-delete.jpg');
    });

    it('should do nothing when file does not exist', async () => {
      // Mock file does not exist
      (fs.existsSync as jest.Mock).mockReturnValue(false);
      
      await service.deleteFile('non-existent-file.jpg');
      
      // Verify file deletion was not attempted
      expect(fs.unlinkSync).not.toHaveBeenCalled();
    });

    it('should handle errors during file deletion', async () => {
      // Mock error when deleting file
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.unlinkSync as jest.Mock).mockImplementation(() => {
        throw new Error('Permission denied');
      });
      
      // Create spy on logger
      const loggerErrorSpy = jest.spyOn(service['logger'], 'error');
      
      await service.deleteFile('file-to-delete.jpg');
      
      // Verify error was logged
      expect(loggerErrorSpy).toHaveBeenCalled();
      expect(loggerErrorSpy.mock.calls[0][0]).toContain('Error deleting file');
    });
  });
}); 