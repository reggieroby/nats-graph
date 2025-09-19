import { bucket } from './bucket.js'

export async function vertexLabel(id) {
  const b = await bucket();
  return b.get(`node.${id}.label`).then(data => data.string());
}

export async function edgeLabel(id) {
  const b = await bucket();
  return b.get(`edge.${id}.label`).then(data => data.string());
}

