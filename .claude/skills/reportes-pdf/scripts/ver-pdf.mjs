// Genera un PDF de reporte con datos de ejemplo y lo convierte en imágenes para revisarlo.
//
// Uso (desde la raíz del repo):
//   node .claude/skills/reportes-pdf/scripts/ver-pdf.mjs <carpeta-salida> [cxc|cxc-categoria|cxc-clienta|ventas]
//
// Escribe <carpeta>/<tipo>.pdf y <tipo>_<página>.png (necesita `pip install pymupdf`).
// Funciona corriendo un test temporal de Vitest, así usa los alias (@/…) del proyecto.
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const out = path.resolve(process.argv[2] || 'pdf-preview');
const kind = process.argv[3] || 'cxc';
fs.mkdirSync(out, { recursive: true });
const tmp = path.resolve('src/lib/__ver_pdf.test.ts');

fs.writeFileSync(tmp, `
import { it } from 'vitest';
import { writeFileSync } from 'fs';
import { buildReceivablesPdf, buildReceivablesReport } from './receivablesReport';
import { buildSalesPdf, filterSales } from './salesReport';
const now = new Date();
const ago = (d: number) => new Date(now.getTime() - d * 86400000).toISOString();
const names = ['María Pérez', 'Ana Rodríguez', 'Luisa Gómez', 'Carla Marcano', 'Yelitza Salazar'];
const prods = ['Vestido largo floral', 'Suéter tejido talla M', 'Jean tiro alto', 'Perfume 50 ml'];
const cats = ['Ropa', 'Pantalones', 'Ropa', 'Perfumes'];
const methods = ['pago_movil', 'zelle', 'efectivo_usd', 'binance'];
const sales: any[] = [];
for (let i = 0; i < 40; i++) {
  const g = 'g' + String(i).padStart(7, '0') + '-0000';
  const credit = i % 3 === 0;
  for (let j = 0; j < 1 + (i % 3); j++) {
    const t = 12 + ((i * 13 + j * 7) % 35);
    sales.push({ id: g + j, sale_group_id: g, client_name: names[i % 5], client_phone: '0414' + (1000000 + (i % 5) * 1111),
      product_name: prods[(i + j) % 4], category: cats[(i + j) % 4], quantity: 1 + (j % 2), unit_price_usd: t, total_usd: t, payment_method: credit ? 'fiado' : methods[i % 4],
      is_credit: credit, sale_modality: credit ? 'fiado' : 'contado', amount_paid: credit ? (j === 0 && i % 2 === 0 ? 5 : 0) : t, status: 'confirmed', created_at: ago((i * 7) % 80) });
  }
}
const payments = sales.filter(s => s.is_credit && s.amount_paid > 0).map(s => ({ sale_id: s.id, sale_group_id: s.sale_group_id, amount_usd: 5, amount_bs: 1800, payment_method: 'pago_movil', created_at: ago(1) }));
it('pdf', () => {
  const kind = ${JSON.stringify(kind)};
  const doc = kind === 'ventas'
    ? buildSalesPdf(filterSales(sales, { from: ago(29).slice(0, 10), to: ago(0).slice(0, 10) }), { from: ago(29).slice(0, 10), to: ago(0).slice(0, 10) }, { rate: 360, previousTotal: 900 })
    : buildReceivablesPdf(buildReceivablesReport(sales, payments, { rate: 360, clientName: kind === 'cxc-clienta' ? 'María Pérez' : null, groupBy: kind === 'cxc-categoria' ? 'categoria' : 'clienta' }));
  writeFileSync(${JSON.stringify(path.join(out, kind + '.pdf'))}, Buffer.from(doc.output('arraybuffer')));
});
`);
try {
  execSync(`npx vitest run ${tmp}`, { stdio: 'inherit' });
} finally {
  fs.rmSync(tmp, { force: true });
}
try {
  execSync(`python3 -c "import pymupdf,sys; d=pymupdf.open(sys.argv[1]); [p.get_pixmap(dpi=80).save(sys.argv[2]+'_'+str(i+1)+'.png') for i,p in enumerate(d)]; print(d.page_count,'páginas')" ${JSON.stringify(path.join(out, kind + '.pdf'))} ${JSON.stringify(path.join(out, kind))}`, { stdio: 'inherit' });
} catch {
  console.log('Sin pymupdf: abre el PDF a mano o instala con `pip install pymupdf`.');
}
console.log(`Listo: ${out}`);
