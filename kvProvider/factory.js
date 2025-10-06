import { kvProvider as natsKVProvider } from "./nats/provider.js";

export function kvProviderFactory(kvName) {
  switch (kvName) {
    case 'nats':
      return natsKVProvider
    default:
      throw new Error(`Unsupported kv provider: ${kvName}`)
  }
}
