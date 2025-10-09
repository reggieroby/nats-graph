import { optimizeOpsChain } from './optimizer/index.js'
import { operationFactoryKey, operationResultType, operationStreamWrapperKey, Errors } from './steps/types.js'
import { kvProviderFactory } from './kvProvider/factory.js'
import { diagnostics } from './diagnosticsProvider/index.js'


export const Graph = (config) => {
  config ||= {}
  const { kv, kvConfig } = config
  // Create a single diagnostics instance and pass it through everywhere
  const diags = diagnostics()
  let kvStore = kvProviderFactory(kv)
  const getKVStore = async () => {
    if (typeof kvStore === 'function') {
      kvStore = kvStore({
        config: kvConfig,
        ctx: { diagnostics: diags }
      })
    }
    return kvStore
  }
  const getDiagnostics = async () => {
    return diagnostics()
  }


  return graph({ getKVStore, getDiagnostics });
}

const graph = ({ getKVStore, getDiagnostics }) => ({
  get g() {
    return (function createProxy(operationsChain = []) {
      const handler = {
        get(_, prop) {
          if (prop === 'explain') {
            return () => operationsChain
              .map(({ prop, args }) => `${prop}(${args.map(a => JSON.stringify(a)).join(', ')})`)
              .join(' -> ');
          }
          if (prop === 'then') {
            return (onFulfilled) => onFulfilled(Array.fromAsync((async function* () {
              const { interface: kvStore } = await getKVStore()
              const diagnostics = await getDiagnostics()
              diagnostics.require(!!kvStore, Errors.KVSTORE_MISSING, 'kvStore does not have an interface.', { where: 'graph.then' })
              yield* operationChainExecutor({
                opsChain: optimizeOpsChain(operationsChain, { diagnostics }),
                kvStore,
                diagnostics,
              })
            })()))
          }
          return (...args) => createProxy([...operationsChain, { prop, args }])
        }
      }
      return new Proxy({}, handler)
    })()
  },
  async close() {
    const kvStore = await getKVStore()
    await kvStore.close()
  }
})

async function* operationChainExecutor({ opsChain, kvStore, diagnostics }) {
  let pipeline = seedPipeline()

  for (const step of opsChain) {
    pipeline = attachStep({ pipeline, step, kvStore, diagnostics })
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

function attachStep({ pipeline, step, kvStore, diagnostics }) {
  const { args, operation } = step

  const streamWrap = operation[operationStreamWrapperKey]
  if (typeof streamWrap === 'function') {
    return streamWrap({ ctx: { kvStore, diagnostics }, args })(pipeline)
  }

  const stepFactory = operation[operationFactoryKey]

  return (async function* () {
    for await (const parent of pipeline) {
      const itemIter = stepFactory({
        parent,
        ctx: {
          kvStore,
          diagnostics,
        },
        args
      })

      for await (const item of itemIter) {
        yield item
      }
    }
  })()
}
