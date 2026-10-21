import { describe, it, expect, vi } from 'vitest';

vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
import { casheaPlan } from './NewSaleDialog';

describe('plan de Cashea', () => {
  it('Nivel 1: 50% de inicial y el resto en 3 cuotas', () => {
    expect(casheaPlan(120, 1, 3)).toEqual({ pct: 50, initial: 60, financed: 60, installment: 20 });
  });
  it('Nivel 3: 30% de inicial y 6 cuotas', () => {
    expect(casheaPlan(100, 3, 6)).toEqual({ pct: 30, initial: 30, financed: 70, installment: 11.67 });
  });
  it('Nivel 6: sin inicial, todo lo paga Cashea', () => {
    expect(casheaPlan(45.5, 6, 3)).toEqual({ pct: 0, initial: 0, financed: 45.5, installment: 15.17 });
  });
  it('la inicial exacta de Cashea manda sobre la del nivel', () => {
    expect(casheaPlan(100, 1, 3, '60')).toEqual({ pct: 50, initial: 60, financed: 40, installment: 13.33 });
    expect(casheaPlan(100, 1, 3, '150').initial).toBe(100);
  });
});
