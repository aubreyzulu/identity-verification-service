import 'jest-extended';
import { setGlobalOptions } from '@golevelup/ts-jest';

// Configure global options for @golevelup/ts-jest
setGlobalOptions({
  tsJest: {
    isolatedModules: true,
  },
});

// Mock console methods to keep test output clean
global.console = {
  ...console,
  // log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
}; 