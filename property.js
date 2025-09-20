import { bucket } from './bucket.js'

export async function setVertexProperty(id, key, value) {
  return bucket().then(bkt => bkt.put(`node.${id}.property.${key}`, JSON.stringify(value)))
}

export async function setEdgeProperty(id, key, value) {
  return bucket().then(bkt => bkt.put(`edge.${id}.property.${key}`, JSON.stringify(value)))
}

export async function getEdgeProperty(id, key) {
  return bucket().then(bkt => bkt.get(`edge.${id}.property.${key}`)).then(d => d?.json())
}

export async function getVertexProperty(id, key) {
  return bucket().then(bkt => bkt.get(`node.${id}.property.${key}`)).then(d => d?.json())
}
