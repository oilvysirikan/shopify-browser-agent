import { createLogger, format, transports } from 'winston';

const logFormat = format.combine(
  format.timestamp(),
  format.json()
);

export const errorMonitor = createLogger({
  level: 'info',
  format: logFormat,
  transports: [
    new transports.Console({
      format: format.combine(
        format.colorize(),
        format.simple()
      )
    })
  ]
});

export default errorMonitor;
