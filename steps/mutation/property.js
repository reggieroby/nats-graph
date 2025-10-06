import { operationResultTypeKey, operationFactoryKey, operationResultType as sharedElementType, operationNameKey, operationName, operationStreamWrapperKey } from '../types.js'

export const vertexPropertyStep = {
  [operationNameKey]: operationName.property,
  [operationResultTypeKey]: sharedElementType.vertex,
  [operationStreamWrapperKey]({ ctx = {}, args = [] } = {}) {
    const { kvStore, assertAndLog } = ctx;
    const [k, v] = args;
    assertAndLog(kvStore, 'kvStore required in ctx for property()');
    assertAndLog(typeof k === 'string' && k.length > 0, 'property(key, value) requires string key');
    assertAndLog(!['id', 'label'].includes(k), `Reserved key. Property ${k} not allowed.`);
    const t = typeof v; assertAndLog(v !== undefined && (t === 'string' || t === 'number' || t === 'boolean' || t === 'object'), 'Invalid value type for property()');
    return (source) => (async function* () {
      for await (const vertexId of source) {
        await kvStore.update(`node.${vertexId}.property.${k}`, JSON.stringify(v));
        yield vertexId;
      }
    })()
  },
  [operationFactoryKey]({ parent: vertexId, ctx = {}, args = [] } = {}) {
    const { kvStore, assertAndLog } = ctx;
    const [k, v] = args;
    // Preconditions and validation
    assertAndLog(kvStore, 'kvStore required in ctx for property()');
    assertAndLog(args.length === 2, 'property(key, value) requires exactly 2 arguments');
    assertAndLog(typeof k === 'string', 'property(key, value) requires string key');
    assertAndLog(k.length > 0, 'property(key, value) requires non-empty key');
    assertAndLog(!['id', 'label'].includes(k), `Reserved key. Property ${k} not allowed.`);
    const t = typeof v;
    assertAndLog(v !== undefined && (t === 'string' || t === 'number' || t === 'boolean' || t === 'object'), 'Invalid value type for property()');
    async function* itr() {
      await kvStore.update(`node.${vertexId}.property.${k}`, JSON.stringify(v));
      yield vertexId;
    }

    return {
      [Symbol.asyncIterator]: itr,
    };
  }
};

export const edgePropertyStep = {
  [operationNameKey]: operationName.property,
  [operationResultTypeKey]: sharedElementType.edge,
  [operationStreamWrapperKey]({ ctx = {}, args = [] } = {}) {
    const { kvStore, assertAndLog } = ctx;
    const [k, v] = args;
    assertAndLog(kvStore, 'kvStore required in ctx for property()');
    assertAndLog(typeof k === 'string' && k.length > 0, 'property(key, value) requires string key');
    assertAndLog(!['id', 'label'].includes(k), `Reserved key. Property ${k} not allowed.`);
    const t = typeof v; assertAndLog(v !== undefined && (t === 'string' || t === 'number' || t === 'boolean' || t === 'object'), 'Invalid value type for property()');
    return (source) => (async function* () {
      for await (const edgeId of source) {
        await kvStore.update(`edge.${edgeId}.property.${k}`, JSON.stringify(v));
        yield edgeId;
      }
    })()
  },
  [operationFactoryKey]({ parent: edgeId, ctx = {}, args = [] } = {}) {
    const { kvStore, assertAndLog } = ctx;
    const [k, v] = args;
    // Preconditions and validation
    assertAndLog(kvStore, 'kvStore required in ctx for property()');
    assertAndLog(args.length === 2, 'property(key, value) requires exactly 2 arguments');
    assertAndLog(typeof k === 'string', 'property(key, value) requires string key');
    assertAndLog(k.length > 0, 'property(key, value) requires non-empty key');
    assertAndLog(!['id', 'label'].includes(k), `Reserved key. Property ${k} not allowed.`);
    const t = typeof v;
    assertAndLog(v !== undefined && (t === 'string' || t === 'number' || t === 'boolean' || t === 'object'), 'Invalid value type for property()');
    async function* iterator() {
      await kvStore.update(`edge.${edgeId}.property.${k}`, JSON.stringify(v));
      yield edgeId;
    }

    return {
      [Symbol.asyncIterator]: iterator,
    };
  }
}
