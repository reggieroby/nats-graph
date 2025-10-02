import assert from 'node:assert'
import test, { suite } from 'node:test'
import { Graph } from '../index.js'
import { NATS_IP_ADDRESS } from './util/config.js'
import { kvProvider } from '../services/nats/provider.js'
import { startDummyServer } from './util/dummyServer.js'
import { ulid } from 'ulid'
import { QueuedIteratorImpl } from '@nats-io/transport-node'


{
  suite('kvStore providers', () => {
    suite('Nats', () => {
      const goodConfig = { servers: NATS_IP_ADDRESS, bucket: `testing-${ulid()}` }
      test.skip('should reject when no configuration provided', () => {
        assert.rejects(() => kvProvider(), {
          message: 'Configuration object is required',
          name: 'AssertionError'
        })
      })
      suite('configuration', () => {
        test.skip(`should reject with no 'servers'`, async () => {
          assert.rejects(async () => kvProvider({}), {
            message: `Configuration property 'servers' is required`,
            name: 'AssertionError'
          })
        })
        test.skip(`should reject with bad 'servers'`, async (t) => {
          const { address, port, close } = await startDummyServer(socket => socket.on('data', () => { }));
          t.after(() => close());

          assert.rejects(async () => kvProvider({ servers: `${address}:${port}`, timeout: 2000 }), {
            name: 'ConnectionError'
          })
        })
        test.skip('should connect and disconnect', async () => {
          let kvp
          await assert.doesNotReject(async () => {
            kvp = await kvProvider({ servers: NATS_IP_ADDRESS })
          })
          assert(typeof kvp.close === 'function', 'No close function provided')
          assert.doesNotReject(async () => kvp.close())
        })
        test('should provide interface operations', async (t) => {
          let kvp
          t.before(async () => {
            kvp = await kvProvider(goodConfig)
            assert(typeof kvp.interface === 'object', 'No interface operations provided')
          })
          t.after(async () => kvp.close())

          await Promise.all([
            t.test(`get`, async () => assert(typeof kvp.interface.get === 'function', 'Interface operation:get not provided')),
            t.test(`put`, async () => assert(typeof kvp.interface.put === 'function', 'Interface operation:put not provided')),
            t.test(`update`, async () => assert(typeof kvp.interface.update === 'function', 'Interface operation:update not provided')),
            t.test(`delete`, async () => assert(typeof kvp.interface.delete === 'function', 'Interface operation:delete not provided')),
            t.test(`keys`, async () => assert(typeof kvp.interface.keys === 'function', 'Interface operation:keys not provided')),
            t.test(`create`, async () => assert(typeof kvp.interface.create === 'function', 'Interface operation:create not provided')),
          ])

          await Promise.all([
            t.test('get returns promise', async () => {
              const p = kvp.interface.get('getPromise')
              assert(p instanceof Promise)
              await p
            }),
            t.test('get nonExistent key, returns null', async () => {
              const d = await kvp.interface.get('getNonExistent')
              assert(d === null)
            }),
            t.test('get existing key, returns helper functions', async () => {
              await kvp.interface.put('getHelpers')
              const d = await kvp.interface.get('getHelpers')
              assert(typeof d.string === 'function')
              assert(typeof d.json === 'function')
            }),



            t.test('put returns promise', async () => {
              const p = kvp.interface.put('putPromise')
              assert(p instanceof Promise)
              await p
            }),
            t.test('put empty payload. get returns empty string', async () => {
              await kvp.interface.put('putEmptyPayload')
              const d = await kvp.interface.get('putEmptyPayload')
              assert(d.string() === '', 'Empty payload should return empty string')
            }),
            t.test('put allows string,Uint8Array,Buffer payloads.', async () => assert.doesNotReject(async () => {
              await kvp.interface.put('putStringPayload', "xyz")
              await kvp.interface.put('putUint8ArrayPayload', new Uint8Array([1, 2, 3]))
              await kvp.interface.put('putStringPayload', Buffer.from('abc'))
            })),
            t.test('put returns monotonic revision numbers', async () => assert.doesNotReject(async () => {
              let lastRevNumber = 0
              for (let i = 1; i < 100; i++) {
                const revNumber = await kvp.interface.put('putCheckRevisionNumber')
                assert(lastRevNumber < revNumber)
                lastRevNumber = revNumber
              }
            })),



            t.test('update returns promise', async () => {
              const p = kvp.interface.update('updatePromise')
              assert(p instanceof Promise)
              await p
            }),
            t.test('update empty payload. get returns empty string', async () => {
              await kvp.interface.update('updateEmptyPayload')
              const d = await kvp.interface.get('updateEmptyPayload')
              assert(d.string() === '', 'Empty payload should return empty string')
            }),
            t.test('update allows string,Uint8Array,Buffer payloads.', async () => assert.doesNotReject(async () => {
              await kvp.interface.update('updateStringPayload', "xyz")
              await kvp.interface.update('updateUint8ArrayPayload', new Uint8Array([1, 2, 3]))
              await kvp.interface.update('updateStringPayload', Buffer.from('abc'))
            })),
            t.test('update returns monotonic revision numbers', async () => assert.doesNotReject(async () => {
              let lastRevNumber = 0
              for (let i = 1; i < 100; i++) {
                const revNumber = await kvp.interface.update('updateCheckRevisionNumber')
                assert(lastRevNumber < revNumber)
                lastRevNumber = revNumber
              }
            })),






            t.test('create returns promise', async () => {
              const p = kvp.interface.create('createPromise')
              assert(p instanceof Promise)
              await p
            }),
            t.test('create empty payload. get returns empty string', async () => {
              await kvp.interface.create('createEmptyPayload')
              const d = await kvp.interface.get('createEmptyPayload')
              assert(d.string() === '', 'Empty payload should return empty string')
            }),
            t.test('create allows string,Uint8Array,Buffer payloads.', async () => assert.doesNotReject(async () => {
              await kvp.interface.create('createStringPayload', "xyz")
              await kvp.interface.create('createUint8ArrayPayload', new Uint8Array([1, 2, 3]))
              await kvp.interface.create('createBufferPayload', Buffer.from('abc'))
            })),
            t.test('create the same existing key throws', async () => {
              const d = await kvp.interface.create('createSameKey')
              await assert.rejects(async () => kvp.interface.create('createSameKey'), (err) => {
                assert.strictEqual(err.name, 'JetStreamApiError');
                assert.strictEqual(err.code, 10071)
                return true;
              },)
            }),
            t.test('create returns monotonic revision numbers', async () => assert.doesNotReject(async () => {
              let lastRevNumber = 0
              for (let i = 1; i < 100; i++) {
                const revNumber = await kvp.interface.create('createCheckRevisionNumber' + i)
                assert(lastRevNumber < revNumber)
                lastRevNumber = revNumber
              }
            })),




            t.test('delete returns promise', async () => {
              const p = kvp.interface.delete('deletePromise')
              assert(p instanceof Promise)
              await p
            }),
            t.test('delete never existent key, returns helper functions', async () => {
              await kvp.interface.delete('deleteNeverExistent')
              const d = await kvp.interface.get('deleteNeverExistent')
              assert.strictEqual(d.string(), "")
            }),







            t.test('keys returns promise', async () => {
              const p = kvp.interface.keys()
              assert(p instanceof Promise)
              await p
            }),
            t.test('await keys returns asyncIterator', async () => {
              const itr = await kvp.interface.keys()
              assert.ok(itr && typeof itr[Symbol.asyncIterator] === 'function');
            }),
            t.test('empty OR ">" keys param, returns all keys', async () => {
              let kvp = await kvProvider({ ...goodConfig, bucket: ulid() })
              for (let i = 1; i < 100; i++) {
                await kvp.interface.create('keysAllKeysParam' + i)
              }
              const itr = await kvp.interface.keys()

              let i = 1
              for await (const a of itr) { i++ }
              assert.strictEqual(i, 100)

              const itr2 = await kvp.interface.keys(">")

              let i2 = 1
              for await (const a of itr2) { i2++ }
              assert.strictEqual(i2, 100)

              await kvp.close()
            }),
          ])
        })
      })
    })
  })
  suite('Graph configuration', () => {
    suite('incomplete', () => {
      test('should exit immediately when empty', () => {
        assert.throws(() => Graph())
      })
      let graphObj;
      test('should return immediately when kv is specified', () => {
        assert.doesNotThrow(() => {
          graphObj = Graph({ kv: 'nats' })
        })
        assert.ok(() => graphObj.g)
        assert.ok(() => typeof graphObj.g.V === 'function')
      })
      test('should throw when configuration fails', () => {
        assert.rejects(async () => {
          await graphObj.g.V()
        })
      })
    })
    suite('kv store', () => {
      suite('nats', () => {
        suite.skip('configuration', () => {
          test('should have NATS loaded from .env', () => {
            assert.ok(NATS_IP_ADDRESS)
            console.log({ NATS_IP_ADDRESS })
          })
          test('cant connect with bad ip address', async () => {
            let graphObj = Graph({ kv: 'nats', kvConfig: { NATS_IP_ADDRESS: "2" } })
            assert.ok(async () => {
              await graphObj.g.V()
            }, {
              name: 'ConnectionError',
            })
          })
          test('should connect successfully', () => {
            let graphObj = Graph({ kv: 'nats', kvConfig: { NATS_IP_ADDRESS } })
            console.log('aaaa')
            assert.doesNotThrow(async () => {
              console.log('bbbbb')
              await graphObj.g.V()
              console.log('ccccc')
            })
            console.log('dddd')
          })
        })
      })
    })

  })
  // {
  //   description.graphConfig('nats kv store')
  //   natsConfigText(`no config given`)

  //   {
  //     test(`${natsConfigText(`no config given`)}`, async (t) => {
  //       assert.doesNotThrow(() => Graph({ kv: 'nats' }))
  //     })
  //   }
  // }
}

// const { g } = Graph({ kv: 'nats' })

// {
//   const xyz = await g.V().id()
//   console.log({ xyz })
// }

