
export function diagnostics(logger = console) {
  return {
    invariant(cond, code, msg, meta) {
      if (cond) return;
      logger?.error?.({ code, msg, ...meta });
      const err = new Error(msg);
      err.code = code;        // e.g. 'KV_INVARIANT_V_MISSING'
      err.type = 'Invariant';
      throw err;
    },

    // For caller-preconditions you want to surface as "bad input"
    require(cond, code, msg, meta) {
      if (cond) return;
      const err = new Error(msg);
      err.code = code;        // e.g. 'KV_REQUIRE_BAD_ARG'
      err.type = 'Precondition';
      throw err;
    },

    // For recoverable issues you still want visibility on
    warn(cond, code, msg, meta) {
      if (cond) return;
      logger?.warn?.({ code, msg, ...meta });
      // optionally collect stats, but do not throw
    },
  }
}