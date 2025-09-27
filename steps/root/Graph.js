import { operationResultType, operationResultTypeKey, operationFactoryKey, operationNameKey, operationName } from '../types.js';

export const Graph = {
  [operationNameKey]: operationName.Graph,
  [operationResultTypeKey]: operationResultType.graph,
  [operationFactoryKey]() {
    async function* itr() {
      yield
    }

    return {
      [Symbol.asyncIterator]: itr,
    };
  }
}