import assert from 'node:assert'
import test, { suite } from 'node:test'
import { Graph } from '../index.js'
import { NATS_IP_ADDRESS } from './util/config.js'


suite('Graph configuration', () => {
  suite('incomplete', () => {
    test('should exit immediately when when kv incorrect', () => {
      assert.throws(() => Graph())
      assert.throws(() => Graph({ kv: 'idk' }))
    })
    //   test('should return immediately when kv is specified', async (t) => {
    //     let graph;
    //     assert.doesNotThrow(() => {
    //       graph = Graph({ kv: 'nats', kvConfig: { servers: NATS_IP_ADDRESS } })
    //     })
    //     const { g } = graph
    //     assert.ok(g)
    //     assert.ok(typeof g.V === 'function')
    //     await g.addE()
    //   })
  })

})
