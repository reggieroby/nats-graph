import { jetstream, jetstreamManager } from '@nats-io/jetstream'
import { Kvm } from '@nats-io/kv'
import { connect } from '@nats-io/transport-node'
import assert from 'node:assert'

const allConnections = []

export const connectionFactory = (config) => {
  const connectionTemplateObject = {
    client: null,
    jetstream: null,
    jetstreamManager: null,
    Kvm: null,
    bucket: [],
  }
  return new Proxy(connectionTemplateObject, {
    get(_target, prop, thisProxy) {
      switch (prop) {
        case "client":
          return async () => {
            if (_target.client)
              return _target.client
            _target.client = await connect(config)
            allConnections.push({ client: _target.client })
            return _target.client;
          };
        case "jetstream":
          return async () => {
            _target.jetstream ||= jetstream(await thisProxy.client());
            return _target.jetstream;
          };
        case "jetstreamManager":
          return async () => {
            _target.jetstreamManager ||= await jetstreamManager(await thisProxy.client());
            return _target.jetstreamManager;
          };
        case "Kvm":
          return async () => {
            _target.Kvm ||= new Kvm(await thisProxy.client());
            return _target.Kvm;
          };
        case 'bucket':
          return async (name) => {
            assert(typeof name === 'string' && name.length > 0, 'name must be a non-empty string');
            const kvm = await thisProxy.Kvm();
            _target.bucket[name] ||= await kvm.create(name);
            return _target.bucket[name]
          }
        case 'close':
          return async () => _target.client.close()
        case "publish":
          return async (k, v) => thisProxy.jetstream().then(js => js.publish(k, v))
            .catch(err => console.error('publish uh oh', { err }));
        default:
          return undefined;
      }
    },
  })
}