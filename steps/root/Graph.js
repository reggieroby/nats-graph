import { operationResultType, operationResultTypeKey, operationFactoryKey, operationNameKey, operationName, operationStreamWrapperKey } from '../types.js';

export const Graph = {
  [operationNameKey]: operationName.Graph,
  [operationResultTypeKey]: operationResultType.graph,
  [operationStreamWrapperKey]() {
    return (_source) => (async function* () { yield })()
  },
  [operationFactoryKey]() {
    async function* itr() {
      yield
    }

    return {
      [Symbol.asyncIterator]: itr,
    };
  }
}
