import { vertexLabel, edgeLabel } from '../terminal/label.js'
import { operationResultTypeKey, operationFactoryKey, operationResultType, operationNameKey, operationName, operationStreamWrapperKey } from '../types.js'


export const vertexHas = {
  [operationNameKey]: operationName.has,
  [operationResultTypeKey]: operationResultType.vertex,
  [operationStreamWrapperKey]({ ctx: { kvStore, assertAndLog } = {}, args: [key, expected] } = {}) {
    return (source) => (async function* () {
      assertAndLog(kvStore, 'kvStore required in ctx for has()');
      assertAndLog(typeof key === 'string' && key.length > 0, 'has(key, value) requires string, non-empty key');
      const t = typeof expected; assertAndLog(t === 'string' || t === 'number' || t === 'boolean', 'has(key, value) requires scalar value (string|number|boolean)');

      for await (const vertexId of source) {
        let getValue;
        if (key === 'label') {
          const [value] = await Array.fromAsync(vertexLabel[operationStreamWrapperKey]({ ctx: { kvStore } })(
            (async function* () { yield vertexId })()
          ))
          getValue = value
        } else if (key === 'id') {
          getValue = vertexId
        } else {
          getValue = await kvStore.get(`node.${vertexId}.property.${key}`).then(kvValue => kvValue?.json())
        }
        if (getValue === expected) yield vertexId
      }
    })()
  },
  [operationFactoryKey]({ parent: vertexId, ctx: { kvStore, assertAndLog } = {}, args: [key, expected] } = {}) {
    // Validate inputs early so invalid usage surfaces as TypeError via assertAndLog
    assertAndLog(kvStore, 'kvStore required in ctx for has()');
    assertAndLog(args.length === 2, 'has(key, value) requires exactly 2 arguments');
    assertAndLog(typeof key === 'string', 'has(key, value) requires string key');
    assertAndLog(key.length > 0, 'has(key, value) requires non-empty key');
    const expectedType = typeof expected;
    assertAndLog(expectedType === 'string' || expectedType === 'number' || expectedType === 'boolean', 'has(key, value) requires scalar value (string|number|boolean)');
    async function* iterator() {
      let getValue;
      if (key === 'label') {
        getValue = Array.fromAsync(vertexLabel[operationStreamWrapperKey]({ ctx: { kvStore } })(
          (async function* () { yield vertexId })()
        )).then(([value]) => value)
      } else if (key === 'id') {
        getValue = vertexId
      } else {
        getValue = kvStore.get(`node.${vertexId}.property.${key}`)
          .then(kvValue => kvValue?.json())
      }
      const isSame = (await getValue) === expected

      if (isSame) yield vertexId
    }

    return {
      [Symbol.asyncIterator]: iterator,
    }
  }
}

export const edgeHas = {
  [operationNameKey]: operationName.has,
  [operationResultTypeKey]: operationResultType.edge,
  [operationStreamWrapperKey]({ ctx: { kvStore, assertAndLog } = {}, args = [] } = {}) {
    return (source) => (async function* () {
      const [key, expected] = args;
      assertAndLog(kvStore, 'kvStore required in ctx for has()');
      assertAndLog(typeof key === 'string' && key.length > 0, 'has(key, value) requires string, non-empty key');
      const t = typeof expected; assertAndLog(t === 'string' || t === 'number' || t === 'boolean', 'has(key, value) requires scalar value (string|number|boolean)');

      for await (const edgeId of source) {
        let getValue;
        if (key === 'label') {
          const [value] = await Array.fromAsync(edgeLabel[operationStreamWrapperKey]({ ctx: { kvStore } })(
            (async function* () { yield edgeId })()
          ))
          getValue = value
        } else if (key === 'id') {
          getValue = edgeId
        } else {
          getValue = await kvStore.get(`edge.${edgeId}.property.${key}`).then(kvValue => kvValue?.json())
        }
        if (getValue === expected) yield edgeId
      }
    })()
  },
  [operationFactoryKey]({ parent: edgeId, ctx: { kvStore, assertAndLog } = {}, args = [] } = {}) {
    const [key, expected] = args;
    // Validate inputs early so invalid usage surfaces as TypeError via assertAndLog
    assertAndLog(kvStore, 'kvStore required in ctx for has()');
    assertAndLog(args.length === 2, 'has(key, value) requires exactly 2 arguments');
    assertAndLog(typeof key === 'string', 'has(key, value) requires string key');
    assertAndLog(key.length > 0, 'has(key, value) requires non-empty key');
    const expectedType = typeof expected;
    assertAndLog(expectedType === 'string' || expectedType === 'number' || expectedType === 'boolean', 'has(key, value) requires scalar value (string|number|boolean)');
    async function* iterator() {
      let getValue;
      if (key === 'label') {
        getValue = Array.fromAsync(edgeLabel[operationStreamWrapperKey]({ ctx: { kvStore } })(
          (async function* () { yield edgeId })()
        )).then(([value]) => value)
      } else if (key === 'id') {
        getValue = edgeId
      } else {
        getValue = kvStore.get(`edge.${edgeId}.property.${key}`)
          .then(kvValue => kvValue?.json())
      }
      const isSame = (await getValue) === expected

      if (isSame) yield edgeId
    }

    return {
      [Symbol.asyncIterator]: iterator,
    }
  }
}
