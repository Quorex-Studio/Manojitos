// Tras un despliegue nuevo, una pestaña abierta puede pedir archivos JS que ya no existen.
// En ese caso se recarga la página para traer la versión nueva (como mucho una vez cada 30 s,
// así nunca queda en bucle si el problema es otro).
const KEY = 'chunk_reload_at';

export function isChunkLoadError(error: unknown): boolean {
  const e = error as { message?: string; name?: string } | null;
  const msg = e?.message || '';
  return (
    e?.name === 'ChunkLoadError' ||
    /dynamically imported module|Importing a module script failed|valid JavaScript MIME type|Loading chunk .* failed|Unable to preload CSS/i.test(msg)
  );
}

/** Recarga si no se recargó en los últimos 30 s. Devuelve true si va a recargar. */
export function reloadForNewVersion(): boolean {
  try {
    const last = Number(sessionStorage.getItem(KEY) || 0);
    if (Date.now() - last < 30_000) return false;
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch { /* sin sessionStorage: recargar igual una vez */ }
  window.location.reload();
  return true;
}
