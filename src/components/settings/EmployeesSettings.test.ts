import { describe, expect, it, vi } from 'vitest';

vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));

import { isSuspended } from './EmployeesSettings';

describe('isSuspended', () => {
  const now = new Date('2026-10-16T12:00:00Z');
  it('activo sin bloqueo', () => expect(isSuspended({ banned_until: null }, now)).toBe(false));
  it('suspendido mientras dura el bloqueo', () => expect(isSuspended({ banned_until: '2126-01-01T00:00:00Z' }, now)).toBe(true));
  it('bloqueo vencido = activo', () => expect(isSuspended({ banned_until: '2026-01-01T00:00:00Z' }, now)).toBe(false));
});
