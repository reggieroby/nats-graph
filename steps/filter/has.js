import { vertexLabel, edgeLabel } from '../terminal/label.js'
import { operationResultTypeKey, operationFactoryKey, operationResultType, operationNameKey, operationName } from '../types.js'


export const vertexHas = {
  [operationNameKey]: operationName.has,
  [operationResultTypeKey]: operationResultType.vertex,
  [operationFactoryKey]({ parent: vertexId, ctx: { graphBucket }, args: [key, expected] } = {}) {
    async function* iterator() {
      let getValue;
      console.log({ vertexId, key, expected })
      if (key === 'label') {
        getValue = Array.fromAsync(vertexLabel[operationFactoryKey]({ parent: vertexId, ctx: { graphBucket } }))
          .then(([value]) => value)
      } else if (key === 'id') {
        getValue = vertexId
      } else {
        getValue = graphBucket.get(`node.${vertexId}.property.${key}`)
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
  [operationFactoryKey]({ parent: edgeId, ctx: { graphBucket }, args: [key, expected] } = {}) {
    async function* iterator() {
      let getValue;
      if (key === 'label') {
        getValue = Array.fromAsync(edgeLabel[operationFactoryKey]({ parent: edgeId, ctx: { graphBucket } }))
          .then(([value]) => value)
      } else if (key === 'id') {
        getValue = edgeId
      } else {
        getValue = graphBucket.get(`edge.${edgeId}.property.${key}`)
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
