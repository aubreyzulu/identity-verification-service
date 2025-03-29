import { ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RateLimitGuard } from './rate-limit.guard';
import { createMock } from '@golevelup/ts-jest';

describe('RateLimitGuard', () => {
  let guard: RateLimitGuard;
  let configService: ConfigService;

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config = {
        'app.rateLimit.verificationLimit': 5,
        'app.rateLimit.limit': 10,
      };
      return config[key];
    }),
  };

  beforeEach(() => {
    configService = mockConfigService as unknown as ConfigService;
    guard = new RateLimitGuard(configService, {}, 'Rate limit exceeded');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getTracker', () => {
    it('should return first IP from ips array if available', async () => {
      const req = {
        ips: ['1.1.1.1', '2.2.2.2'],
        ip: '3.3.3.3',
      };

      const result = await guard.getTracker(req);
      expect(result).toBe('1.1.1.1');
    });

    it('should return ip if ips array is empty', async () => {
      const req = {
        ips: [],
        ip: '3.3.3.3',
      };

      const result = await guard.getTracker(req);
      expect(result).toBe('3.3.3.3');
    });
  });

  describe('getLimit', () => {
    it('should return verification limit for verification endpoints', () => {
      const context = createMock<ExecutionContext>({
        switchToHttp: () => ({
          getRequest: () => ({
            path: '/verification/document',
          }),
        }),
      });

      const limit = guard.getLimit(context);
      expect(limit).toBe(5);
      expect(configService.get).toHaveBeenCalledWith('app.rateLimit.verificationLimit');
    });

    it('should return default limit for non-verification endpoints', () => {
      const context = createMock<ExecutionContext>({
        switchToHttp: () => ({
          getRequest: () => ({
            path: '/api/other',
          }),
        }),
      });

      const limit = guard.getLimit(context);
      expect(limit).toBe(10);
      expect(configService.get).toHaveBeenCalledWith('app.rateLimit.limit');
    });

    it('should return fallback values if config values are undefined', () => {
      const mockConfigServiceWithUndefined = {
        get: jest.fn().mockReturnValue(undefined),
      };
      const guardWithUndefinedConfig = new RateLimitGuard(
        mockConfigServiceWithUndefined as unknown as ConfigService,
        {},
        'Rate limit exceeded'
      );

      const context = createMock<ExecutionContext>({
        switchToHttp: () => ({
          getRequest: () => ({
            path: '/verification/document',
          }),
        }),
      });

      const limit = guardWithUndefinedConfig.getLimit(context);
      expect(limit).toBe(5); // Fallback value
    });
  });
}); 