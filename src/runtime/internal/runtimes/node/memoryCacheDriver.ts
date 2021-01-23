import Boom from '@hapi/boom';
import * as Hoek from '@hapi/hoek';

const internals = {
  maxTimer: 2147483647, // 2 ^ 31 - 1
  entrySize: 144, // Approximate cache entry size without value: 144 bytes
  defaults: {
    maxSize: 1000,
    minCleanupIntervalMsec: 1000,
  },
};

export interface MemoryCacheDriverOptions {
  maxSize?: number;
  minCleanupIntervalMsec?: number;
}

export class MemoryCacheDriver {
  private readonly settings: Required<MemoryCacheDriverOptions>;
  private cache: Map<string, Map<string, { stored: number; ttl: number }>> | null = null;
  private size = 0;
  private _timer: NodeJS.Timeout | null = null;
  private _timerDue: number | null = null;

  constructor(options: MemoryCacheDriverOptions = {}) {
    Hoek.assert(
      options.maxSize === undefined || options.maxSize >= 0,
      'Invalid cache maxSize value'
    );
    Hoek.assert(
      options.minCleanupIntervalMsec === undefined ||
        options.minCleanupIntervalMsec < internals.maxTimer,
      'Invalid cache minCleanupIntervalMsec value'
    );

    this.settings = Hoek.applyToDefaults(
      internals.defaults,
      options
    ) as Required<MemoryCacheDriverOptions>;
    this.cache = null;

    this._timer = null;
    this._timerDue = null;
  }

  start() {
    if (!this.cache) {
      this.cache = new Map();
      this.size = 0;
    }
  }

  _scheduleCleanup(msec: number) {
    const cleanup = () => {
      this._timer = null;
      this._timerDue = null;

      const now = Date.now();
      let next = Infinity;
      for (const [, segment] of this.cache!) {
        for (const [id, envelope] of segment) {
          const ttl = envelope.stored + envelope.ttl - now;
          if (ttl <= 0) {
            segment.delete(id);
            --this.size;
          } else {
            next = Math.min(next, ttl);
          }
        }
      }

      if (next !== Infinity) {
        this._scheduleCleanup(next);
      }
    };

    const now = Date.now();
    const timeout = Math.min(
      Math.max(this.settings.minCleanupIntervalMsec, msec),
      internals.maxTimer
    );
    if (this._timer) {
      if (this._timerDue! - now < msec) {
        return;
      }

      clearTimeout(this._timer!);
    }

    this._timerDue = now + timeout;
    this._timer = setTimeout(cleanup, timeout);
  }

  stop() {
    clearTimeout(this._timer!);
    this._timer = null;
    this._timerDue = null;

    this.cache = null;
    this.size = 0;
  }

  isReady() {
    return !!this.cache;
  }

  validateSegmentName(name: string) {
    if (!name) {
      throw new Boom.Boom('Empty string');
    }

    if (name.indexOf('\u0000') !== -1) {
      throw new Boom.Boom('Includes null character');
    }

    return null;
  }

  get(key: { segment: string; id: string }) {
    if (!this.cache) {
      throw new Boom.Boom('Connection not started');
    }

    const segment = this.cache.get(key.segment);
    if (!segment) {
      return null;
    }

    const envelope = segment.get(key.id);
    if (!envelope) {
      return null;
    }

    if (envelope.stored + envelope.ttl < Date.now()) {
      this.drop(key);
      return null;
    }

    return envelope;
  }

  set(key: { segment: string; id: string }, item: unknown, ttl: number) {
    if (!this.cache) {
      throw new Boom.Boom('Connection not started');
    }

    const envelope = {
      item,
      ttl,
      stored: Date.now(),
    };

    let segment = this.cache.get(key.segment);
    if (!segment) {
      segment = new Map();
      this.cache.set(key.segment, segment);
    }

    const cachedItem = segment.get(key.id);
    if (cachedItem) {
      --this.size;
    }

    if (this.settings.maxSize && this.size >= this.settings.maxSize) {
      throw new Boom.Boom('Cache size limit reached');
    }

    this._scheduleCleanup(ttl);
    segment.set(key.id, envelope);
    ++this.size;
  }

  drop(key: { segment: string; id: string }) {
    if (!this.cache) {
      throw new Boom.Boom('Connection not started');
    }

    const segment = this.cache.get(key.segment);
    if (segment) {
      const item = segment.get(key.id);
      if (item) {
        --this.size;
        segment.delete(key.id);
      }
    }
  }
}
