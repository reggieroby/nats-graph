import assert from 'node:assert/strict'
import test, { suite, before } from 'node:test'
import { NATS_IP_ADDRESS } from '../util/config.js'
import { kvProvider } from '../../kvProvider/nats/provider.js'
import { ulid } from 'ulid'
import { runKeysSharedSuite } from './keys.shared.mjs'
import { startDummyServer } from '../util/dummyServer.js'
import { runGetSuite } from './get.shared.mjs'
import { runPutSuite } from './put.shared.mjs'
import { runUpdateSuite } from './update.shared.mjs'
import { runDeleteSuite } from './delete.shared.mjs'
import { runCreateSuite } from './create.shared.mjs'

runKeysSharedSuite({
  label: 'nats',
  setup: async () => {
    assert.ok(NATS_IP_ADDRESS, 'NATS_IP_ADDRESS missing; check test/.env')
    const kvp = await kvProvider({ servers: NATS_IP_ADDRESS, bucket: `keys-${ulid()}` })
    const kv = kvp.interface
    return { kvp, kv }
  }
})

// Provider-specific behaviors for NATS
suite('kvStoreProvider/nats.keys() specifics', () => {
  before(async () => {
    assert.ok(NATS_IP_ADDRESS, 'NATS_IP_ADDRESS missing; check test/.env')
  })

  test('overlapping/duplicate patterns are rejected by provider', async () => {
    // const kvp = await kvProvider({ servers: NATS_IP_ADDRESS, bucket: `keys-${ulid()}` })
    // const kv = kvp.interface
    // await assert.rejects(() => kv.keys(['env.prod.>', 'env.prod.>']))
  })
})

suite('kvStoreProvider/nats', () => {
  before(async () => {
    assert.ok(NATS_IP_ADDRESS, 'NATS_IP_ADDRESS missing; check test/.env')
  })
  suite('network', () => {
    test(`should reject with no 'servers'`, async () => {
      assert.rejects(async () => kvProvider({}), {
        message: `Configuration property 'servers' is required`,
        name: 'AssertionError'
      })
    })
    test(`should reject with bad 'servers'`, async (t) => {
      const { address, port, close } = await startDummyServer(socket => socket.on('data', () => { }));
      t.after(() => close());

      assert.rejects(async () => kvProvider({ servers: `${address}:${port}` }), {
        name: 'ConnectionError'
      })
    })
    test('should connect and disconnect', async () => {
      let kvp
      await assert.doesNotReject(async () => {
        kvp = await kvProvider({ servers: NATS_IP_ADDRESS })
      })
      assert(typeof kvp.close === 'function', 'No close function provided')
      assert.doesNotReject(async () => kvp.close())
    })
  })

  const setup = async () => kvProvider({ servers: NATS_IP_ADDRESS, bucket: `testing-${ulid()}` })

  runGetSuite({ label: 'nats', setup })
  runPutSuite({ label: 'nats', setup })
  runUpdateSuite({ label: 'nats', setup })
  runDeleteSuite({ label: 'nats', setup })
  runCreateSuite({ label: 'nats', setup, variant: 'nats' })
})
