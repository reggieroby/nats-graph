import { ulid } from 'ulid'

const normalizeArgs = (args = []) => {
  const [a, b] = args;
  const payload = { info: {}, message: '' };

  if (typeof a === 'string' && b === undefined) {
    payload.message = a;
  } else if (a && typeof a === 'object' && b === undefined) {
    payload.info = a;
  } else if (a && typeof a === 'object' && typeof b === 'string') {
    payload.info = a;
    payload.message = b;
  } else {
    payload.message = String(a);
    if (b !== undefined) payload.info = b;
  }

  if (payload.info && typeof payload.info === 'object' && Error.prototype.isPrototypeOf(payload.info)) {
    payload.info = {
      message: payload.info.message,
      stack: payload.info.stack,
      name: payload.info.name,
    };
  }

  return payload;
};
const sinks = {
  console: (level, payload) => console.log(`logger.${level}:`, payload),
}

const publishLog = async (level, correlationId, args) => {
  const { message, info } = normalizeArgs(args);
  const payload = {
    info,
    message,
    ts: Date.now(),
    correlationID: correlationId,
  };

  for (const [name, sink] in sinks) {
    try {
      await sink(level, payload)
    } catch (err) {
      console.error(`logger(${name}) FAILED.`, { level, payload, err });
    }
  }
};

export function createLogger({ correlationId = ulid() } = {}) {
  return {
    debug: (...args) => publishLog('debug', correlationId, args),
    info: (...args) => publishLog('info', correlationId, args),
    warn: (...args) => publishLog('warn', correlationId, args),
    error: (...args) => publishLog('error', correlationId, args),
    fatal: (...args) => publishLog('fatal', correlationId, args),
    addSink: (name, fn) => { sinks[name] = fn },
    removeSink: (name) => { delete sinks[name] },
  };
}

export const logger = createLogger();
