import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/** Cliente que aparece en ventas (con o sin cuenta), con lo que compró y lo que debe. */
export interface SaleClient {
  key: string;
  name: string;
  dni: string;
  phone: string;
  email: string;
  address: string;
  /** Cuenta vinculada (si la venta ya está en la ficha de una cuenta) */
  userId: string | null;
  /** Sin cédula ni teléfono: agrupado solo por el nombre (puede juntar a dos personas) */
  nameOnly?: boolean;
  /** Ids de las líneas de venta de este cliente sin cuenta (para vincularlas) */
  saleIds: string[];
  purchases: number;
  totalUsd: number;
  balanceUsd: number;
  lastAt: string;
}

const digits = (s?: string | null) => (s || '').replace(/\D/g, '');
/** Teléfono comparable: últimos 10 dígitos (412… sin el 0 ni el 58) */
export const phoneKey = (s?: string | null) => digits(s).slice(-10);
const nameKey = (s?: string | null) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase().replace(/\s+/g, ' ');

/**
 * Clientes de las ventas (no anuladas). Los que no tienen cuenta se agrupan por cédula,
 * teléfono o nombre; así quien compra fiado o a crédito siempre aparece en la cartera.
 */
export function useSaleClients(enabled = true) {
  return useQuery({
    queryKey: ['sale-clients'],
    enabled,
    staleTime: 60_000,
    queryFn: async () => {
      const rows: {
        id: string; sale_group_id: string | null; client_name: string | null; client_dni: string | null; client_phone: string | null;
        client_email: string | null; client_address: string | null; customer_user_id: string | null; total_usd: number; amount_paid: number | null; created_at: string;
      }[] = [];
      for (let from = 0; from < 20000; from += 1000) {
        const { data, error } = await supabase.from('sales')
          .select('id, sale_group_id, client_name, client_dni, client_phone, client_email, client_address, customer_user_id, total_usd, amount_paid, created_at')
          .neq('status', 'cancelled')
          .or('client_name.not.is.null,customer_user_id.not.is.null')
          .order('created_at', { ascending: false })
          .range(from, from + 999);
        if (error) throw error;
        rows.push(...((data || []) as typeof rows));
        if (!data || data.length < 1000) break;
      }

      const byAccount = new Map<string, SaleClient>();
      const noAccount = new Map<string, SaleClient & { groups: Set<string> }>();
      const accountGroups = new Map<string, Set<string>>();
      // Para unir cédula/teléfono/nombre del mismo cliente sin cuenta
      const alias = new Map<string, string>();

      for (const r of rows) {
        const total = Number(r.total_usd) || 0;
        const balance = Math.max(0, total - (Number(r.amount_paid) || 0));
        const group = r.sale_group_id || r.id;
        if (r.customer_user_id) {
          const c = byAccount.get(r.customer_user_id) ?? {
            key: r.customer_user_id, name: r.client_name || '', dni: r.client_dni || '', phone: r.client_phone || '', email: r.client_email || '',
            address: r.client_address || '', userId: r.customer_user_id, saleIds: [], purchases: 0, totalUsd: 0, balanceUsd: 0, lastAt: r.created_at,
          };
          c.totalUsd += total;
          c.balanceUsd += balance;
          const g = accountGroups.get(r.customer_user_id) ?? new Set<string>();
          g.add(group);
          accountGroups.set(r.customer_user_id, g);
          c.purchases = g.size;
          byAccount.set(r.customer_user_id, c);
          continue;
        }
        const keys = [r.client_dni ? `d:${digits(r.client_dni)}` : '', phoneKey(r.client_phone).length === 10 ? `p:${phoneKey(r.client_phone)}` : '', r.client_name ? `n:${nameKey(r.client_name)}` : '']
          .filter(k => k && k.length > 2);
        if (!keys.length) continue;
        const key = keys.map(k => alias.get(k)).find(Boolean) ?? keys[0];
        keys.forEach(k => alias.set(k, key));
        const c = noAccount.get(key) ?? {
          key, name: r.client_name || '', dni: r.client_dni || '', phone: r.client_phone || '', email: r.client_email || '', address: r.client_address || '',
          userId: null, saleIds: [], purchases: 0, totalUsd: 0, balanceUsd: 0, lastAt: r.created_at, groups: new Set<string>(),
        };
        // Completa los datos que falten con ventas más viejas
        c.dni ||= r.client_dni || '';
        c.phone ||= r.client_phone || '';
        c.email ||= r.client_email || '';
        c.address ||= r.client_address || '';
        c.nameOnly = !c.dni && phoneKey(c.phone).length !== 10;
        c.saleIds.push(r.id);
        c.groups.add(group);
        c.purchases = c.groups.size;
        c.totalUsd += total;
        c.balanceUsd += balance;
        noAccount.set(key, c);
      }

      const round = (n: number) => Math.round(n * 100) / 100;
      const clean = (c: SaleClient) => ({ ...c, totalUsd: round(c.totalUsd), balanceUsd: round(c.balanceUsd) });
      return {
        /** Por cuenta (user_id): compras y saldo de quienes tienen cuenta */
        accounts: new Map([...byAccount].map(([k, c]) => [k, clean(c)])),
        /** Clientes de ventas que aún no tienen cuenta */
        withoutAccount: [...noAccount.values()].map(({ groups: _g, ...c }) => clean(c)),
      };
    },
  });
}
