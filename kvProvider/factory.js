import { kvProvider as natsKVProvider } from "./nats/provider.js";
import { kvProvider as memoryKVProvider } from "./memory/provider.js";

export function kvProviderFactory(kvName) {
  switch (kvName) {
    case 'nats':
      return natsKVProvider
    case 'memory':
      return memoryKVProvider
    default:
      throw new Error(`Unsupported kv provider: ${kvName}`)
  }
}
