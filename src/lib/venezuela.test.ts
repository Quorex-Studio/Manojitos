import { describe, it, expect } from 'vitest';
import { splitPhone, joinPhone, isCompletePhone, formatPhone, splitDoc, joinDoc } from './venezuela';

describe('teléfonos', () => {
  it.each([
    ['+584141234567', '0414', '1234567'],
    ['04241234567', '0424', '1234567'],
    ['4161234567', '0416', '1234567'],
    ['0295 2601234', '0295', '2601234'],
    ['', '0414', ''],
  ])('%s -> %s %s', (input, prefix, number) => {
    expect(splitPhone(input)).toEqual({ prefix, number });
  });

  it('une y valida', () => {
    expect(joinPhone('0414', '1234567')).toBe('+584141234567');
    expect(joinPhone('0295', '260 1234')).toBe('+582952601234');
    expect(joinPhone('0412', '')).toBe('');
    expect(isCompletePhone('+584141234567')).toBe(true);
    expect(isCompletePhone('+58414123')).toBe(false);
    expect(formatPhone('+584141234567')).toBe('0414 123 4567');
  });
});

describe('documentos', () => {
  it.each([
    ['V-12345678', 'V', '12345678'],
    ['e 81234567', 'E', '81234567'],
    ['J-412345679', 'J', '412345679'],
    ['12345678', 'V', '12345678'],
  ])('%s -> %s %s', (input, type, number) => {
    expect(splitDoc(input)).toEqual({ type, number });
  });

  it('une', () => {
    expect(joinDoc('E', '81.234.567')).toBe('E-81234567');
    expect(joinDoc('V', '')).toBe('');
  });
});
