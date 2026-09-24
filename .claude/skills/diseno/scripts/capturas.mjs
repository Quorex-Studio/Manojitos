// Capturas de la tienda y el panel con datos simulados (sin tocar la base real).
//
// Uso (con `npx vite --port 8080 --host 127.0.0.1` corriendo en otra terminal):
//   node .claude/skills/diseno/scripts/capturas.mjs <carpeta> [rutas] [--tema=dark] [--solo=m|d]
//   rutas: lista separada por comas; por defecto todas. Ejemplos:
//     tienda: /,/tienda,/producto/p0,/carrito     panel: /dashboard,/products,/sales
//
// Variables opcionales:
//   PLAYWRIGHT_PATH  ruta a playwright/index.mjs (por defecto la global de este entorno)
//   CHROMIUM_PATH    ejecutable de Chromium (por defecto /opt/pw-browsers/…)
//   SUPABASE_REF     ref del proyecto (por defecto se lee de VITE_SUPABASE_URL en .env)
//   STORAGE_KEY      prefijo de localStorage (VITE_BRAND_STORAGE_KEY), para el tema
//
// Qué simula: 8 productos, tasa BCV y —en rutas del panel— una sesión admin
// (app_metadata.is_super_admin). Todo lo demás de /rest/v1 responde [] para ver estados vacíos.
import fs from 'node:fs';

const env = Object.fromEntries(
  (fs.existsSync('.env') ? fs.readFileSync('.env', 'utf8') : '')
    .split('\n').map(l => l.match(/^([A-Z_]+)="?([^"]*)"?$/)).filter(Boolean).map(m => [m[1], m[2]])
);
const { chromium } = await import(process.env.PLAYWRIGHT_PATH || '/opt/node22/lib/node_modules/playwright/index.mjs');
const executablePath = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const ref = process.env.SUPABASE_REF || (env.VITE_SUPABASE_URL || '').match(/https:\/\/([^.]+)/)?.[1] || 'local';
const storageKey = process.env.STORAGE_KEY || env.VITE_BRAND_STORAGE_KEY || 'eina';

const args = process.argv.slice(2);
const OUT = args.find(a => !a.startsWith('--')) || 'capturas';
const routesArg = args.filter(a => !a.startsWith('--'))[1];
const theme = args.find(a => a.startsWith('--tema='))?.split('=')[1] || '';
const solo = args.find(a => a.startsWith('--solo='))?.split('=')[1] || '';
const BASE = process.env.BASE_URL || 'http://127.0.0.1:8080';
fs.mkdirSync(OUT, { recursive: true });

const palette = ['#e1ae9d', '#f4e7d7', '#c98f7e', '#b76e79', '#e8d5c4', '#78293c', '#d9b8a8', '#a8716a'];
const img = (i) => 'data:image/svg+xml;utf8,' + encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000"><rect width="800" height="1000" fill="${palette[i % 8]}"/><ellipse cx="400" cy="560" rx="170" ry="300" fill="rgba(0,0,0,0.12)"/></svg>`);
const now = Date.now();
const products = [
  ['Base líquida matte 30ml', 22, 'Maquillaje'], ['Sérum vitamina C', 28, 'Skincare'],
  ['Paleta de sombras nude', 19, 'Maquillaje'], ['Labial líquido rosewood', 12, 'Maquillaje'],
  ['Protector solar FPS 50', 24, 'Skincare'], ['Bolso mini crema', 45, 'Bolsos'],
  ['Set de brochas x12', 26, 'Accesorios'], ['Tónico exfoliante', 18, 'Skincare'],
].map(([name, price_usd, category], i) => ({
  id: `00000000-0000-0000-0000-00000000000${i}`, name, price_usd, category, description: `${name}.`,
  stock: i === 2 ? 2 : 10 + i, image_url: img(i), sold_count: 40 - i * 4,
  created_at: new Date(now - i * 3 * 86400000).toISOString(),
}));

const user = { id: '00000000-0000-0000-0000-0000000000aa', aud: 'authenticated', role: 'authenticated', email: 'admin@ejemplo.com',
  app_metadata: { provider: 'email', is_super_admin: true }, user_metadata: { full_name: 'Administración' }, created_at: new Date().toISOString() };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const exp = Math.floor(now / 1000) + 86400;
const session = { access_token: `${b64({ alg: 'HS256' })}.${b64({ sub: user.id, exp, app_metadata: user.app_metadata })}.x`,
  refresh_token: 'r', token_type: 'bearer', expires_in: 86400, expires_at: exp, user };

const ADMIN = ['/dashboard', '/products', '/sales', '/credits', '/providers', '/reports', '/settings', '/import-products', '/reglas'];
const STORE = ['/', '/tienda', `/producto/${products[0].id}`, '/carrito', '/cliente/auth'];
const routes = routesArg
  ? routesArg.split(',').map(r => r.replace('/producto/p0', `/producto/${products[0].id}`))
  : [...STORE, ...ADMIN, '/dashboard/clientes'];
const isAdmin = (r) => ADMIN.some(a => r === a || r.startsWith(a + '/')) || r.startsWith('/dashboard');

const browser = await chromium.launch({ executablePath });
const errors = {};
for (const route of routes) {
  for (const [tag, viewport] of [['m', { width: 390, height: 844 }], ['d', { width: 1366, height: 900 }]]) {
    if (solo && solo !== tag) continue;
    const ctx = await browser.newContext({ viewport });
    const page = await ctx.newPage();
    const name = `${(route.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || 'inicio')}-${tag}${theme ? '-' + theme : ''}`;
    errors[name] = [];
    page.on('pageerror', e => errors[name].push(e.message.slice(0, 200)));
    await page.addInitScript(([s, t, sk, ref, admin]) => {
      if (admin) localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify(s));
      if (t) localStorage.setItem(`${sk}-theme`, t);
    }, [session, theme, storageKey, ref, isAdmin(route)]);
    if (isAdmin(route)) await page.route('**/auth/v1/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(user) }));
    await page.route('**/functions/v1/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
    await page.route('**/rest/v1/**', async (r) => {
      const url = r.request().url();
      const single = (r.request().headers()['accept'] || '').includes('vnd.pgrst.object');
      if (url.includes('/rest/v1/rpc/')) return r.fulfill({ status: 200, contentType: 'application/json', body: 'null' });
      let body = [];
      if (url.includes('/rest/v1/products')) {
        const id = url.match(/id=eq\.([0-9a-f-]+)/)?.[1];
        body = id ? products.filter(p => p.id === id) : products;
      } else if (url.includes('/rest/v1/exchange_rates')) {
        body = [{ id: 'x', rate: 854.46, currency: 'USD', source: 'BCV', created_at: new Date().toISOString() }];
      }
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(single ? (body[0] ?? null) : body) });
    });
    await page.goto(BASE + route, { waitUntil: 'networkidle' }).catch(() => {});
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
    await ctx.close();
  }
}
await browser.close();
const withErrors = Object.entries(errors).filter(([, v]) => v.length);
console.log(withErrors.length ? `Errores de página:\n${JSON.stringify(Object.fromEntries(withErrors), null, 1)}` : 'Sin errores de página.');
console.log(`Capturas en ${OUT}/`);
