import { assert } from '../../config.js';
import { operationResultTypeKey, operationFactoryKey, operationResultType as sharedElementType, operationNameKey, operationName } from '../types.js'

export const vertexPropertyStep = {
  [operationNameKey]: operationName.property,
  [operationResultTypeKey]: sharedElementType.vertex,
  [operationFactoryKey]({ parent: vertexId, ctx: { kvStore }, args: [k, v] } = {}) {
    assert(!['id', 'label'].includes(k), `Reserved key. Property ${k} not allowed.`)
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
  [operationFactoryKey]({ parent: edgeId, ctx: { kvStore }, args: [k, v] } = {}) {
    assert(!['id', 'label'].includes(k), `Reserved key. Property ${k} not allowed.`)
    async function* iterator() {
      await kvStore.update(`edge.${edgeId}.property.${k}`, JSON.stringify(v));
      yield edgeId;
    }

    return {
      [Symbol.asyncIterator]: iterator,
    };
  }
}

