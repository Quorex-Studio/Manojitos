import { describe, it, expect } from 'vitest';
import { isChunkLoadError } from './chunkReload';

describe('isChunkLoadError', () => {
  it.each([
    "'text/html' is not a valid JavaScript MIME type for module script 'https://manojitos.vercel.app/assets/StoreCatalog-DC6dcEw1.js'.",
    'Failed to fetch dynamically imported module: https://x/assets/a.js',
    'Importing a module script failed.',
    'error loading dynamically imported module',
  ])('detecta: %s', (message) => {
    expect(isChunkLoadError(new Error(message))).toBe(true);
  });

  it('no confunde otros errores', () => {
    expect(isChunkLoadError(new Error('Cannot read properties of undefined'))).toBe(false);
    expect(isChunkLoadError(null)).toBe(false);
  });
});
