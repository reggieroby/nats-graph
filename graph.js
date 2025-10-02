import { assert } from './config.js'
import { optimizeOpsChain } from './optimizer/index.js'
import { operationFactoryKey, operationResultType, operationStreamWrapperKey } from './steps/types.js'
import { kvProviderFactory } from './services/kvProviderFactory.js'
import { nextAvailableOperationsMap } from './steps/outputTypeMappings.js'

export const Graph = (config) => {
  config ||= {}
  const { kv, kvConfig } = config
  const kvStore = kvProviderFactory(kv)(kvConfig)

  return {
    get g() {
      const shouldveProxiedItIGuess = (k) => (...args) => graph({ kvStore })[k](...args);
      return nextAvailableOperationsMap.get(operationResultType.graph).keys()
        .reduce((prev, curr) => ({ ...prev, [curr]: shouldveProxiedItIGuess(curr) }), {});
    }
  }
}

const graph = ({ kvStore }) => {
  const operationsChain = [];
  const handler = {
    get(_, prop) {
      if (prop === 'explain') {
        return () => operationsChain.map(({ prop, args }) => `${prop}(${args.map(a => JSON.stringify(a)).join(', ')})`).join(' -> ');
      }
      if (prop === 'then') {
        return (onFulfilled) => onFulfilled(Array.fromAsync((async function* () {
          await kvStore
          yield* operationChainExecutor({
            opsChain: optimizeOpsChain(operationsChain),
            kvStore,
          })
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

async function* operationChainExecutor({ opsChain, kvStore }) {
  let pipeline = seedPipeline()

  for (const step of opsChain) {
    pipeline = attachStep({ pipeline, step, kvStore })
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

function attachStep({ pipeline, step, kvStore }) {
  const { args, operation } = step

  const streamWrap = operation[operationStreamWrapperKey]
  if (typeof streamWrap === 'function') {
    return streamWrap({ ctx: { kvStore } }, ...args)(pipeline)
  }

  const stepFactory = operation[operationFactoryKey]

  return (async function* () {
    for await (const parent of pipeline) {
      const itemIter = stepFactory({
        parent,
        ctx: {
          kvStore,
        },
        args
      })

      for await (const item of itemIter) {
        yield item
      }
    }
  })()
}
