import assert from "node:assert";
import { connectionFactory } from "./natsConnection.js";

export async function kvProvider({ bucket, ...config } = {}) {
  assert(config && typeof config === 'object', 'Configuration object is required');
  const { servers } = config
  assert(servers, "Configuration property 'servers' is required");
  bucket ||= 'graph'

  const connection = connectionFactory(config)
  const connBucket = await connection.bucket(bucket)
  return {
    close: connection.close,
    interface: {
      get get() { return connBucket.get.bind(connBucket) },
      get update() { return connBucket.update.bind(connBucket) },
      get put() { return connBucket.put.bind(connBucket) },
      get delete() { return connBucket.delete.bind(connBucket) },
      get keys() { return connBucket.keys.bind(connBucket) },
      get create() { return connBucket.create.bind(connBucket) },
    }
  }
}
