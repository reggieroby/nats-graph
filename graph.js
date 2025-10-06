import { assertAndLog } from './config.js'
import { optimizeOpsChain } from './optimizer/index.js'
import { operationFactoryKey, operationResultType, operationStreamWrapperKey } from './steps/types.js'
import { kvProviderFactory } from './kvProvider/factory.js'
import { nextAvailableOperationsMap } from './steps/outputTypeMappings.js'

const GRAPH_ROOT_OPERATIONS = new Set(
  nextAvailableOperationsMap.get(operationResultType.graph).keys()
);

export const Graph = (config) => {
  config ||= {}
  const { kv, kvConfig } = config
  let kvStore = kvProviderFactory(kv)
  const getKVStore = async () => {
    if (typeof kvStore === 'function') {
      kvStore = kvStore(kvConfig)
    }
    return kvStore
  }

  return {
    get g() {
      const cache = new Map();
      return new Proxy({}, {
        get(_target, prop) {
          if (prop === Symbol.for('nodejs.util.inspect.custom')) {
            return () => 'GraphTraversalEntry';
          }
          if (prop === Symbol.toStringTag) {
            return 'GraphTraversalEntry';
          }
          if (prop === 'then') {
            return undefined;
          }

          if (typeof prop !== 'string' || !GRAPH_ROOT_OPERATIONS.has(prop)) {
            return undefined;
          }

          if (!cache.has(prop)) {
            cache.set(prop, (...args) => {
              const traversal = graph({ getKVStore, assertAndLog });
              const next = traversal[prop];
              return typeof next === 'function' ? next(...args) : next;
            });
          }

          return cache.get(prop);
        },
      });
    },
    async close() {
      const kvStore = await getKVStore()
      await kvStore.close()
    }
  }
}

const graph = ({ getKVStore, assertAndLog }) => {
  const operationsChain = [];
  const handler = {
    get(_, prop) {
      if (prop === 'explain') {
        return () => operationsChain.map(({ prop, args }) => `${prop}(${args.map(a => JSON.stringify(a)).join(', ')})`).join(' -> ');
      }
      if (prop === 'then') {
        return (onFulfilled) => onFulfilled(Array.fromAsync((async function* () {
          yield* operationChainExecutor({
            opsChain: optimizeOpsChain(operationsChain),
            kvStore: await getKVStore(),
            assertAndLog,
          })
        })()))
      }
      if (['finally', 'catch'].includes(prop)) {
        assertAndLog(false, `${prop} implementation not available.`)
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

async function* operationChainExecutor({ opsChain, kvStore, assertAndLog }) {
  let pipeline = seedPipeline()

  for (const step of opsChain) {
    pipeline = attachStep({ pipeline, step, kvStore, assertAndLog })
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

function attachStep({ pipeline, step, kvStore, assertAndLog }) {
  const { args, operation } = step

  const streamWrap = operation[operationStreamWrapperKey]
  if (typeof streamWrap === 'function') {
    return streamWrap({ ctx: { kvStore, assertAndLog }, args })(pipeline)
  }

  const stepFactory = operation[operationFactoryKey]

  return (async function* () {
    for await (const parent of pipeline) {
      const itemIter = stepFactory({
        parent,
        ctx: {
          kvStore,
          assertAndLog,
        },
        args
      })

      for await (const item of itemIter) {
        yield item
      }
    }
  })()
}
