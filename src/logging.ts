import Pino from 'pino';

export type { Logger } from 'pino';

export function createDefaultLogger() {
  return Pino({
    serializers: Pino.stdSerializers,
    name: '@nostalgie/internal/server',
    prettyPrint:
      process.env.NODE_ENV !== 'production'
        ? {
            ignore: 'name,hostname,pid',
            translateTime: 'HH:MM:ss.l',
          }
        : false,
    redact: ['req.headers'],
    timestamp: Pino.stdTimeFunctions.isoTime,
  });
}
