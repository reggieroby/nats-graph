import assert from 'node:assert/strict'
import test, { suite } from 'node:test'

import { Graph as GraphStep } from '../../steps/root/Graph.js'
import { operationFactoryKey } from '../../steps/types.js'

suite('Graph() interface', () => {
  test('Graph() returns async-iterable and yields a single seed value', async () => {
    const itr = GraphStep[operationFactoryKey]()
    assert.equal(typeof itr?.[Symbol.asyncIterator], 'function')

    const out = await Array.fromAsync(itr)
    assert.equal(out.length, 1)
    assert.equal(out[0], undefined)
  })
})

