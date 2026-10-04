import { describe, expect, it } from 'vitest';
import { normalizeImageUrl } from './imageUrl';

const ID = '1ABmkqOH_RRDUwmutz7aI0HXxWhyRfzBH';
const direct = `https://lh3.googleusercontent.com/d/${ID}=w1200`;

describe('normalizeImageUrl', () => {
  it('convierte los enlaces de Google Drive en imagen directa', () => {
    expect(normalizeImageUrl(`https://drive.google.com/file/d/${ID}/view?usp=drive_link`)).toBe(direct);
    expect(normalizeImageUrl(`https://drive.google.com/open?id=${ID}`)).toBe(direct);
    expect(normalizeImageUrl(`https://drive.google.com/uc?export=view&id=${ID}`)).toBe(direct);
    expect(normalizeImageUrl(`  https://drive.google.com/file/d/${ID}/view  `)).toBe(direct);
  });

  it('pide el archivo a Dropbox en vez de su página', () => {
    expect(normalizeImageUrl('https://www.dropbox.com/s/abc/foto.jpg?dl=0')).toBe('https://www.dropbox.com/s/abc/foto.jpg?raw=1');
  });

  it('deja igual los enlaces que ya son imágenes y vacía lo vacío', () => {
    expect(normalizeImageUrl('https://i.imgur.com/x.jpg')).toBe('https://i.imgur.com/x.jpg');
    expect(normalizeImageUrl('')).toBeNull();
    expect(normalizeImageUrl(null)).toBeNull();
  });
});
