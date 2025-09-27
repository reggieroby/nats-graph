import { assert } from '../../config.js';
import { operationResultTypeKey, operationFactoryKey, operationResultType as sharedElementType, operationNameKey, operationName } from '../types.js'

export const vertexPropertyStep = {
  [operationNameKey]: operationName.property,
  [operationResultTypeKey]: sharedElementType.vertex,
  [operationFactoryKey]({ parent: vertexId, ctx: { graphBucket }, args: [k, v] } = {}) {
    assert(!['id', 'label'].includes(k), `Reserved key. Property ${k} not allowed.`)
    async function* itr() {
      await graphBucket.update(`node.${vertexId}.property.${k}`, JSON.stringify(v));
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
  [operationFactoryKey]({ parent: edgeId, ctx: { graphBucket }, args: [k, v] } = {}) {
    assert(!['id', 'label'].includes(k), `Reserved key. Property ${k} not allowed.`)
    async function* iterator() {
      await graphBucket.update(`edge.${edgeId}.property.${k}`, JSON.stringify(v));
      yield edgeId;
    }

    return {
      [Symbol.asyncIterator]: iterator,
    };
  }
}

