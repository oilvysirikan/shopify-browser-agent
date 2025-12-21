import { Logger } from 'winston';

declare module 'winston' {
  interface Logger {
    error: (message: string, meta?: any) => Logger;
    warn: (message: string, meta?: any) => Logger;
    info: (message: string, meta?: any) => Logger;
    debug: (message: string, meta?: any) => Logger;
    verbose: (message: string, meta?: any) => Logger;
    silly: (message: string, meta?: any) => Logger;
  }
}

export declare const logger: Logger;
export declare const requestIdMiddleware: (req: any, res: any, next: () => void) => void;
export declare const requestLogger: (req: any, res: any, next: () => void) => void;
export declare const stream: {
  write: (message: string) => void;
};
