import { assert } from './config.js'
import { bucket } from './bucket.js'
import { optimizeOpsChain } from './optimizer/index.js'
import { operationFactoryKey, operationStreamWrapperKey } from './steps/types.js'

// Make any object with async methods fluent with a single await at the end
export const graph = () => {
  const operationsChain = [];
  const handler = {
    get(_, prop) {
      if (prop === 'explain') {
        return () => operationsChain.map(({ prop, args }) => `${prop}(${args.map(a => JSON.stringify(a)).join(', ')})`).join(' -> ');
      }
      if (prop === 'then') {
        return (onFulfilled) => onFulfilled(Array.fromAsync((async function* () {
          const graphBucket = await bucket()

          const start = performance.now()

          yield* operationChainExecutor({
            opsChain: optimizeOpsChain(operationsChain),
            graphBucket,
          })
          console.log('time: ', performance.now() - start)
        })()))
      }
      if (['finally', 'catch'].includes(prop)) {
        assert(false, `${prop} implementation not available.`)
      }
      return (...args) => {
        operationsChain.push({ prop, args });
        return proxy;
      };
    }
  };

  const proxy = new Proxy({}, handler);
  return proxy;
};

async function* operationChainExecutor({ opsChain, graphBucket }) {
  let pipeline = seedPipeline()

  for (const step of opsChain) {
    pipeline = attachStep({ pipeline, step, graphBucket })
  }

  for await (const result of pipeline) {
    yield result
  }
}

function seedPipeline() {
  return (async function* () {
    yield null
  })()
}

function attachStep({ pipeline, step, graphBucket }) {
  const { args, operation } = step

  const streamWrap = operation[operationStreamWrapperKey]
  if (typeof streamWrap === 'function') {
    return streamWrap({ ctx: { graphBucket } }, ...args)(pipeline)
  }

  const stepFactory = operation[operationFactoryKey]

  return (async function* () {
    for await (const parent of pipeline) {
      const itemIter = stepFactory({
        parent,
        ctx: {
          graphBucket,
        },
        args
      })

      for await (const item of itemIter) {
        yield item
      }
    }
  })()
}
