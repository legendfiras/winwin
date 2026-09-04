export async function onRequestGet({ env, params }) {
  const parts = params.path;
  const file = Array.isArray(parts) ? parts.join('/') : String(parts || '');
  if (!file || file.includes('..') || file.includes('\\')) {
    return new Response('Not found', { status: 404 });
  }

  const object = await env.PRODUCT_IMAGES.get(`products/${file}`);
  if (!object) {
    return new Response('Not found', { status: 404 });
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  headers.set('Access-Control-Allow-Origin', '*');
  return new Response(object.body, { headers });
}
