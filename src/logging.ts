import Pino from 'pino';

export type { Logger } from 'pino';

export function createDefaultLogger() {
  return Pino({
    serializers: Pino.stdSerializers,
    name: '@nostalgie/server',
    prettyPrint: process.env.NODE_ENV !== 'production',
    redact: ['req.headers'],
    timestamp: Pino.stdTimeFunctions.isoTime,
  });
}
