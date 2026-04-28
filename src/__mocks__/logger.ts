const logger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
};

export const requestIdMiddleware = jest.fn((req, res, next) => next());
export const requestLogger = jest.fn((req, res, next) => next());

export { logger };
