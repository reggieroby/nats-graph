import { operationResultTypeKey, operationFactoryKey, operationResultType, operationNameKey, operationName } from '../types.js'

const meta = {
  'id': () => '',
  'label': id => `.${id}.label`,
}

export const vertexProperties = {
  [operationNameKey]: operationName.properties,
  [operationResultTypeKey]: operationResultType.value,
  [operationFactoryKey]({ parent: vertexId, ctx: { graphBucket }, args = [] } = {}) {
    async function* iterator() {
      const xyz = args.map(k => [k, `node.${vertexId}${meta[k]?.(vertexId) || `.${vertexId}.property.${k}`}`])
      console.log({ xyz })
      yield await Promise.all(
        xyz.map(([k, key]) => graphBucket
          .get(key)
          .then(d => d.json())
          .then(v => [k, v])
          .catch((err) => {
            console.log({ err })
            return [k, undefined]
          })
        )
      )
        .then(kvEntriesArray => Object.fromEntries(kvEntriesArray));

    }

    return {
      [Symbol.asyncIterator]: iterator
    };
  }
}

export const edgeProperties = {
  [operationNameKey]: operationName.properties,
  [operationResultTypeKey]: operationResultType.value,
  [operationFactoryKey]({ parent: edgeId, ctx: { graphBucket }, args = [] } = {}) {
    async function* iterator() {
      yield await Promise.all(
        args.map(k => graphBucket
          .get(`edge.${edgeId}${meta[k]?.(edgeId) || `.${edgeId}.property.${k}`}`)
          .then(d => d.json())
          .then(v => [k, v])
          .catch(() => [k, undefined])
        )
      )
        .then(kvEntriesArray => Object.fromEntries(kvEntriesArray));
    }

    return {
      [Symbol.asyncIterator]: iterator
    };
  }
}
