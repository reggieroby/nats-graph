import { vertexLabel, edgeLabel } from './label.js'
import { operationFactoryKey, operationStreamWrapperKey } from '../types.js'
import { operationResultTypeKey, operationResultType, operationNameKey, operationName } from '../types.js'

export const vertexValueMap = {
  [operationNameKey]: operationName.valueMap,
  [operationResultTypeKey]: operationResultType.value,
  [operationStreamWrapperKey]({ ctx: { kvStore }, args = [] } = {}) {
    return (source) => (async function* () {
      for await (const vertexId of source) {
        if (!args || args.length === 0) {
          const keys = await kvStore.keys(`node.${vertexId}.property.*`).then(Array.fromAsync)
          const entries = await Promise.all(
            keys.map(async (key) => {
              const name = key.split('.').pop()
              try {
                const d = await kvStore.get(key)
                const v = await d.json()
                return [name, v]
              } catch {
                return [name, undefined]
              }
            })
          )
          yield Object.fromEntries(entries)
          continue
        }

        const reqKeys = args.map(String)
        const promises = reqKeys.map(async (k) => {
          if (k === 'label') {
            const values = await Array.fromAsync(vertexLabel[operationStreamWrapperKey]({ ctx: { kvStore } })(
              (async function* () { yield vertexId })()
            ))
            return ['label', values[0]]
          }
          if (k === 'id') {
            return ['id', vertexId]
          }
          try {
            const d = await kvStore.get(`node.${vertexId}.property.${k}`)
            const v = await d.json()
            return [k, v]
          } catch {
            return [k, undefined]
          }
        })
        const entries = await Promise.all(promises)
        yield Object.fromEntries(entries)
      }
    })()
  },
  [operationFactoryKey]({ parent: vertexId, ctx: { kvStore }, args = [] } = {}) {
    async function* iterator() {
      // if no args, return all property keys and values
      if (!args || args.length === 0) {
        const keys = await kvStore.keys(`node.${vertexId}.property.*`).then(Array.fromAsync)

        const entries = await Promise.all(
          keys.map(async (key) => {
            const name = key.split('.').pop()
            try {
              const d = await kvStore.get(key)
              const v = await d.json()
              return [name, v]
            } catch {
              return [name, undefined]
            }
          })
        )

        yield Object.fromEntries(entries)
        return
      }

      // otherwise, only return requested keys (support 'id' and 'label')
      const reqKeys = args.map(String)
      const promises = reqKeys.map(async (k) => {
        if (k === 'label') {
          const values = await Array.fromAsync(vertexLabel[operationStreamWrapperKey]({ ctx: { kvStore } })(
            (async function* () { yield vertexId })()
          ))
          return ['label', values[0]]
        }
        if (k === 'id') {
          return ['id', vertexId]
        }

        try {
          const d = await kvStore.get(`node.${vertexId}.property.${k}`)
          const v = await d.json()
          return [k, v]
        } catch {
          return [k, undefined]
        }
      })

      const entries = await Promise.all(promises)
      yield Object.fromEntries(entries)
    }

    return {
      [Symbol.asyncIterator]: iterator
    };
  }
}

export const edgeValueMap = {
  [operationNameKey]: operationName.valueMap,
  [operationResultTypeKey]: operationResultType.value,
  [operationStreamWrapperKey]({ ctx: { kvStore }, args = [] } = {}) {
    return (source) => (async function* () {
      for await (const edgeId of source) {
        if (!args || args.length === 0) {
          const keys = await kvStore.keys(`edge.${edgeId}.property.*`).then(Array.fromAsync)
          const entries = await Promise.all(
            keys.map(async (key) => {
              const name = key.split('.').pop()
              try {
                const d = await kvStore.get(key)
                const v = await d.json()
                return [name, v]
              } catch {
                return [name, undefined]
              }
            })
          )
          yield Object.fromEntries(entries)
          continue
        }

        const reqKeys = args.map(String)
        const promises = reqKeys.map(async (k) => {
          if (k === 'label') {
            const values = await Array.fromAsync(edgeLabel[operationStreamWrapperKey]({ ctx: { kvStore } })(
              (async function* () { yield edgeId })()
            ))
            return ['label', values[0]]
          }
          if (k === 'id') {
            return ['id', edgeId]
          }
          try {
            const d = await kvStore.get(`edge.${edgeId}.property.${k}`)
            const v = await d.json()
            return [k, v]
          } catch {
            return [k, undefined]
          }
        })
        const entries = await Promise.all(promises)
        yield Object.fromEntries(entries)
      }
    })()
  },
  [operationFactoryKey]({ parent: edgeId, ctx: { kvStore }, args = [] } = {}) {
    async function* iterator() {
      if (!args || args.length === 0) {
        const keys = await kvStore.keys(`edge.${edgeId}.property.*`).then(Array.fromAsync)

        const entries = await Promise.all(
          keys.map(async (key) => {
            const name = key.split('.').pop()
            try {
              const d = await kvStore.get(key)
              const v = await d.json()
              return [name, v]
            } catch {
              return [name, undefined]
            }
          })
        )

        yield Object.fromEntries(entries)
        return
      }

      const reqKeys = args.map(String)
      const promises = reqKeys.map(async (k) => {
        if (k === 'label') {
          const values = await Array.fromAsync(edgeLabel[operationStreamWrapperKey]({ ctx: { kvStore } })(
            (async function* () { yield edgeId })()
          ))
          return ['label', values[0]]
        }
        if (k === 'id') {
          return ['id', edgeId]
        }

        try {
          const d = await kvStore.get(`edge.${edgeId}.property.${k}`)
          const v = await d.json()
          return [k, v]
        } catch {
          return [k, undefined]
        }
      })

      const entries = await Promise.all(promises)
      yield Object.fromEntries(entries)
    }

    return {
      [Symbol.asyncIterator]: iterator
    };
  }
}
