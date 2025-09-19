import { V } from './V.js'
import { addV } from './addV.js'
import { E } from './E.js'
import { addE } from './addE.js'
import { drop } from './drop.js'
import { assert } from './config.js'

const graphEntryPointsIter = () => (async function* () {
  yield { V, addV, E, addE, drop }
})()

// Make any object with async methods fluent with a single await at the end
export const graph = () => {
  const opsChain = [];

  const handler = {
    get(_, prop) {
      if (prop === 'explain') {
        return () => opsChain.map(({ prop, args }) => `${prop}(${args.map(a => JSON.stringify(a)).join(', ')})`).join(' -> ');
      }
      if (prop === 'then') {
        return (onFulfilled) => onFulfilled(Array.fromAsync((async function* () {
          assert(opsChain.length > 0, 'No Operations available.')

          yield* abc({
            itemIter: graphEntryPointsIter(),
            opsChain
          })
        })()))
      }
      if (['finally', 'catch'].includes(prop)) {
        assert(false, `${prop} implementation not available.`)
      }
      return (...args) => {
        opsChain.push({ prop, args });
        return proxy;
      };
    }
  };

  const proxy = new Proxy({}, handler);
  return proxy;
};

async function* abc({
  itemIter, opsChain, opsChainIndex = 0
}) {
  if (opsChainIndex === opsChain.length) {
    yield* itemIter
    return
  }
  const nextOpsChainIndex = opsChainIndex + 1
  const { prop, args } = opsChain[opsChainIndex]

  for await (const item of itemIter) {
    const items = await item[prop](...args)
    if (items[Symbol.asyncIterator]) {
      for await (const i of abc({ itemIter: items, opsChain, opsChainIndex: nextOpsChainIndex })) {
        yield i
      }
    } else {
      yield items
    }
  }
}
