import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { IncomeByMonth } from './IncomeByMonth';

// recharts usa `new ResizeObserver`
globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;

const y = new Date().getFullYear();
const rows = [
  { amount_usd: 10, amount_bs: null, payment_method: 'zelle', status: 'valid', created_at: new Date(y, 0, 10, 12).toISOString() },
  { amount_usd: 5, amount_bs: 1800, payment_method: 'pago_movil', status: 'valid', created_at: new Date(y, 0, 11, 12).toISOString() },
];
vi.mock('@/integrations/supabase/client', () => {
  const q: Record<string, unknown> = {};
  ['select', 'gte', 'lt', 'order'].forEach(k => { q[k] = () => q; });
  q.range = () => Promise.resolve({ data: rows, error: null });
  return { supabase: { from: () => q } };
});

describe('IncomeByMonth', () => {
  it('muestra el total del año y cada método', async () => {
    render(<QueryClientProvider client={new QueryClient()}><IncomeByMonth /></QueryClientProvider>);
    expect((await screen.findAllByText(`Total ${y}`)).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Zelle').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Pago Móvil').length).toBeGreaterThan(0);
    expect(screen.getAllByText('$15,00').length).toBeGreaterThan(0);
  });
});
