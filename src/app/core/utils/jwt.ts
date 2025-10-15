/** Decodifica un JWT sin verificar firma. Devuelve el payload o null. */
export function decodeJwt<T = any>(token: string | null): T | null {
  if (!token) return null;
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    // base64url → base64
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    // padding
    const pad = b64.length % 4 ? '='.repeat(4 - (b64.length % 4)) : '';
    const json = typeof atob === 'function'
      ? atob(b64 + pad)
      : Buffer.from(b64 + pad, 'base64').toString('binary');
    // decode UTF-8
    const utf8 = decodeURIComponent(
      Array.prototype.map
        .call(json, (c: string) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(utf8) as T;
  } catch {
    return null;
  }
}

