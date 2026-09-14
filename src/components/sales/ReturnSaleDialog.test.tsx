import { describe, it, expect, vi } from 'vitest';
import { fireEvent } from '@testing-library/react';
import { render, screen } from '@/test/utils';
import {
  ReturnSaleDialog,
  returnableOf,
  clampReturnQty,
  computeReturnType,
} from './ReturnSaleDialog';
import type { GroupedSale } from '@/pages/Sales';
import type { Sale } from '@/types';

const makeSale = (over: Partial<Sale> = {}): Sale => ({
  id: 'sale-1',
  user_id: 'u1',
  product_id: 'p1',
  product_name: 'Conjuntos para niños y niñas',
  quantity: 2,
  unit_price_usd: 13,
  total_usd: 26,
  total_bs: 0,
  payment_method: 'fiado',
  client_name: 'Yusbelkis',
  client_dni: null,
  client_email: null,
  client_phone: null,
  client_address: null,
  is_credit: true,
  sale_modality: 'fiado',
  amount_paid: 0,
  payment_status: 'pending',
  sale_group_id: 'group-1',
  notes: null,
  status: 'confirmed',
  created_at: new Date().toISOString(),
  returned_quantity: 0,
  returned_at: null,
  ...over,
});

const makeGroup = (items: Sale[]): GroupedSale => ({
  id: 'group-1',
  client_name: 'Yusbelkis',
  payment_method: 'fiado',
  is_credit: true,
  created_at: new Date().toISOString(),
  total_usd: items.reduce((s, i) => s + i.total_usd, 0),
  items,
});

describe('ReturnSaleDialog — lógica pura', () => {
  it('returnableOf = quantity - returned_quantity (nunca negativo)', () => {
    expect(returnableOf(makeSale({ quantity: 2, returned_quantity: 0 }))).toBe(2);
    expect(returnableOf(makeSale({ quantity: 2, returned_quantity: 1 }))).toBe(1);
    expect(returnableOf(makeSale({ quantity: 2, returned_quantity: 2 }))).toBe(0);
    expect(returnableOf(makeSale({ quantity: 2, returned_quantity: 5 }))).toBe(0);
  });

  it('clampReturnQty: entero >=0, recortado al máximo, rechaza no numéricos', () => {
    expect(clampReturnQty('1', 2)).toBe(1);
    expect(clampReturnQty('9', 2)).toBe(2); // sobredevolución → recorta
    expect(clampReturnQty('0', 2)).toBe(0);
    expect(clampReturnQty('-1', 2)).toBe(1); // el signo se elimina → "1"
    expect(clampReturnQty('abc', 2)).toBe(0); // no numérico
    expect(clampReturnQty('', 2)).toBe(0);
    expect(clampReturnQty('1.5', 2)).toBe(2); // "15"→2 (sin decimales)
  });

  it('computeReturnType: total sólo si todas las líneas quedan completas', () => {
    const s = makeSale({ id: 'a', quantity: 2, returned_quantity: 0 });
    expect(computeReturnType([s], { a: 2 })).toBe('devolucion_total');
    expect(computeReturnType([s], { a: 1 })).toBe('devolucion_parcial');
    const s2 = makeSale({ id: 'b', quantity: 1, returned_quantity: 0 });
    expect(computeReturnType([s, s2], { a: 2, b: 1 })).toBe('devolucion_total');
    expect(computeReturnType([s, s2], { a: 2, b: 0 })).toBe('devolucion_parcial');
    // Con una devolución previa parcial, completar el resto = total
    const s3 = makeSale({ id: 'c', quantity: 2, returned_quantity: 1 });
    expect(computeReturnType([s3], { c: 1 })).toBe('devolucion_total');
  });
});

describe('ReturnSaleDialog — UI', () => {
  it('muestra vendidos/devueltos/disponibles y deshabilita Continuar sin datos', () => {
    render(<ReturnSaleDialog group={makeGroup([makeSale()])} onOpenChange={() => {}} onSubmit={vi.fn()} />);
    expect(screen.getByText('Vendidos: 2')).toBeInTheDocument();
    expect(screen.getByText('Devueltos: 0')).toBeInTheDocument();
    expect(screen.getByText('Disponibles: 2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /continuar/i })).toBeDisabled();
  });

  it('recorta la cantidad tecleada al máximo devolvible (sobredevolución)', () => {
    render(<ReturnSaleDialog group={makeGroup([makeSale()])} onOpenChange={() => {}} onSubmit={vi.fn()} />);
    const input = screen.getByLabelText(/a devolver/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: '9' } });
    expect(input.value).toBe('2');
    fireEvent.change(input, { target: { value: 'abc' } });
    expect(input.value).toBe('0');
  });

  it('Continuar sigue deshabilitado con cantidad pero sin motivo (motivo obligatorio)', () => {
    render(<ReturnSaleDialog group={makeGroup([makeSale()])} onOpenChange={() => {}} onSubmit={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/a devolver/i), { target: { value: '1' } });
    expect(screen.getByRole('button', { name: /continuar/i })).toBeDisabled();
    // importe estimado ya visible tras seleccionar cantidad
    expect(screen.getByText(/importe estimado a devolver/i)).toBeInTheDocument();
  });

  it('deshabilita la línea totalmente devuelta y no permite devolverla', () => {
    render(
      <ReturnSaleDialog
        group={makeGroup([makeSale({ returned_quantity: 2 })])}
        onOpenChange={() => {}}
        onSubmit={vi.fn()}
      />
    );
    expect(screen.getByText('Disponibles: 0')).toBeInTheDocument();
    expect(screen.getByLabelText(/a devolver/i)).toBeDisabled();
    expect(screen.getByText(/ya fue devuelta por completo/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /continuar/i })).toBeDisabled();
  });

  it('no renderiza contenido cuando group es null', () => {
    render(<ReturnSaleDialog group={null} onOpenChange={() => {}} onSubmit={vi.fn()} />);
    expect(screen.queryByText(/devolver venta/i)).not.toBeInTheDocument();
  });
});
