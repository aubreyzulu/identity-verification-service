import { Test, TestingModule } from '@nestjs/testing';
import { Request, Response } from 'express';
import { RequestIdMiddleware } from './request-id.middleware';
import { SecurityService } from '../security.service';

describe('RequestIdMiddleware', () => {
  let middleware: RequestIdMiddleware;
  let securityService: SecurityService;

  const mockSecurityService = {
    generateRequestId: jest.fn().mockReturnValue('test-uuid'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RequestIdMiddleware,
        {
          provide: SecurityService,
          useValue: mockSecurityService,
        },
      ],
    }).compile();

    middleware = module.get<RequestIdMiddleware>(RequestIdMiddleware);
    securityService = module.get<SecurityService>(SecurityService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(middleware).toBeDefined();
  });

  describe('use', () => {
    it('should use existing request ID if present', () => {
      const req = {
        headers: {
          'x-request-id': 'existing-id',
        },
      } as Request;
      const res = {
        setHeader: jest.fn(),
      } as unknown as Response;
      const next = jest.fn();

      middleware.use(req, res, next);

      expect(req.headers['x-request-id']).toBe('existing-id');
      expect(res.setHeader).toHaveBeenCalledWith('X-Request-ID', 'existing-id');
      expect(next).toHaveBeenCalled();
      expect(securityService.generateRequestId).not.toHaveBeenCalled();
    });

    it('should generate new request ID if not present', () => {
      const req = {
        headers: {},
      } as Request;
      const res = {
        setHeader: jest.fn(),
      } as unknown as Response;
      const next = jest.fn();

      middleware.use(req, res, next);

      expect(req.headers['x-request-id']).toBe('test-uuid');
      expect(res.setHeader).toHaveBeenCalledWith('X-Request-ID', 'test-uuid');
      expect(next).toHaveBeenCalled();
      expect(securityService.generateRequestId).toHaveBeenCalled();
    });

    it('should handle case-insensitive header names', () => {
      const req = {
        headers: {
          'X-REQUEST-ID': 'existing-id',
        },
      } as Request;
      const res = {
        setHeader: jest.fn(),
      } as unknown as Response;
      const next = jest.fn();

      middleware.use(req, res, next);

      expect(req.headers['x-request-id']).toBe('existing-id');
      expect(res.setHeader).toHaveBeenCalledWith('X-Request-ID', 'existing-id');
      expect(next).toHaveBeenCalled();
      expect(securityService.generateRequestId).not.toHaveBeenCalled();
    });
  });
}); 