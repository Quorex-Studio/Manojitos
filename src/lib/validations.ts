import { z } from 'zod';
import type { SaleStatus } from '@/types';

// Sanitize text to prevent XSS - removes potential HTML tags
export const sanitizeText = (text: string): string => {
  return text
    .trim()
    .replace(/[<>]/g, '')
    .slice(0, 2000);
};

// Product validation schema
export const productSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido').max(200, 'Máximo 200 caracteres').transform(sanitizeText),
  price_usd: z.number().nonnegative('El precio no puede ser negativo').max(1000000, 'Precio máximo excedido'),
  price_bs_usd: z.number().nonnegative('El precio en Bs no puede ser negativo').max(1000000).optional().nullable(),
  cost_usd: z.number().nonnegative('El costo no puede ser negativo').max(1000000).default(0),
  price_wholesale_eur: z.number().nonnegative('El precio mayorista no puede ser negativo').max(1000000).default(0),
  price_retail_eur: z.number().nonnegative('El precio detal no puede ser negativo').max(1000000).default(0),
  stock: z.number().int('El stock debe ser entero').nonnegative('El stock no puede ser negativo'),
  description: z.string().max(2000, 'Máximo 2000 caracteres').optional().nullable().transform(val => val ? sanitizeText(val) : val),
  category: z.string().max(100, 'Máximo 100 caracteres').optional().nullable().transform(val => val ? sanitizeText(val) : val),
  image_url: z.string().url('URL inválida').max(500).optional().nullable(),
  sizes: z.array(z.enum(['Única', 'S', 'M', 'L', 'XL'])).optional().nullable(),
});

export type ProductInput = z.infer<typeof productSchema>;

// Debt validation schema
export const debtSchema = z.object({
  client_name: z.string().min(1, 'El nombre del cliente es requerido').max(200).transform(sanitizeText),
  client_dni: z.string().max(20).optional().nullable().or(z.literal('')).transform(val => val ? sanitizeText(val) : val),
  client_email: z.string().email('Email inválido').max(255).optional().nullable().or(z.literal('')),
  client_phone: z.string().regex(/^\+58(?:412|414|422|424|416|426|2\d{2})\d{7}$/, 'Formato inválido. Ej: +584121234567').optional().nullable().or(z.literal('')).transform(val => val ? sanitizeText(val) : val),
  client_address: z.string().max(200).optional().nullable().transform(val => val ? sanitizeText(val) : val),
  amount_usd: z.number().positive('El monto debe ser mayor a 0').max(1000000),
  amount_bs: z.number().nonnegative().max(100000000).optional().nullable(),
  status: z.enum(['pending', 'paid']).default('pending'),
  notes: z.string().max(1000).optional().nullable().transform(val => val ? sanitizeText(val) : val),
  sale_id: z.string().uuid().optional().nullable(),
});

export type DebtInput = z.infer<typeof debtSchema>;

// Credit validation schema
export const creditSchema = z.object({
  client_name: z.string().min(1, 'El nombre del cliente es requerido').max(200).transform(sanitizeText),
  client_email: z.string().email('Email inválido').optional().nullable().or(z.literal('')),
  client_phone: z.string().regex(/^\+58(?:412|414|422|424|416|426|2\d{2})\d{7}$/, 'Formato inválido. Ej: +584121234567').optional().nullable().or(z.literal('')).transform(val => val ? sanitizeText(val) : val),
  client_user_id: z.string().uuid().optional().nullable(),
  credit_limit: z.number().nonnegative('El límite no puede ser negativo').max(1000000),
  current_balance: z.number().nonnegative().default(0),
  cut_off_day: z.number().int().min(1).max(31).default(15),
  grace_days: z.number().int().min(0).max(30).default(3),
  notes: z.string().max(2000).optional().nullable().transform(val => val ? sanitizeText(val) : val),
});

// We keep this as the internal validation type, but index.ts CreditInput is the canonical one for API/Props
export type CreditValidationInput = z.infer<typeof creditSchema>;

// Payment promise validation schema
export const paymentPromiseSchema = z.object({
  credit_id: z.string().uuid('ID de crédito inválido'),
  promised_amount: z.number().positive('El monto debe ser mayor a 0').max(1000000),
  promised_date: z.string().refine(date => {
    const promisedDate = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return promisedDate >= today;
  }, 'La fecha debe ser hoy o en el futuro'),
  notes: z.string().max(1000).optional().nullable().transform(val => val ? sanitizeText(val) : val),
});

export type PaymentPromiseInput = z.infer<typeof paymentPromiseSchema>;

// Sale status enum
export const SALE_STATUSES = ['pending', 'confirmed', 'cancelled'] as const;

// Sale validation schema
export const saleSchema = z.object({
  product_id: z.string().uuid().optional().nullable(),
  product_name: z.string().min(1).max(200).transform(sanitizeText),
  quantity: z.number().int().positive('La cantidad debe ser mayor a 0'),
  unit_price_usd: z.number().nonnegative('El precio no puede ser negativo'),
  total_usd: z.number().nonnegative(),
  total_bs: z.number().nonnegative().optional().nullable(),
  payment_method: z.string().min(1).max(50),
  client_name: z.string().max(200).optional().nullable().transform(val => val ? sanitizeText(val) : val),
  client_dni: z.string().max(20).optional().nullable().or(z.literal('')).transform(val => val ? sanitizeText(val) : val),
  client_email: z.string().email('Email inválido').max(255).optional().nullable().or(z.literal('')),
  client_phone: z.string().regex(/^\+58(?:412|414|422|424|416|426|2\d{2})\d{7}$/, 'Formato inválido. Ej: +584121234567').optional().nullable().or(z.literal('')).transform(val => val ? sanitizeText(val) : val),
  client_address: z.string().max(200).optional().nullable().transform(val => val ? sanitizeText(val) : val),
  is_credit: z.boolean().default(false),
  sale_modality: z.string().optional().nullable().default('contado'),
  amount_paid: z.number().nonnegative().default(0),
  payment_status: z.enum(['pending', 'partial', 'paid']).default('paid'),
  notes: z.string().max(1000).optional().nullable().transform(val => val ? sanitizeText(val) : val),
  status: z.enum(SALE_STATUSES).default('pending'),
});

export type SaleInput = z.infer<typeof saleSchema>;

// Provider validation schema
export const providerSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido').max(200).transform(sanitizeText),
  phone: z.string().regex(/^\+58(?:412|414|422|424|416|426|2\d{2})\d{7}$/, 'Formato inválido. Ej: +584121234567').optional().nullable().or(z.literal('')).transform(val => val ? sanitizeText(val) : val),
  email: z.string().email('Email inválido').max(255).optional().nullable().or(z.literal('')),
  notes: z.string().max(2000).optional().nullable().transform(val => val ? sanitizeText(val) : val),
});

export type ProviderInput = z.infer<typeof providerSchema>;

// Purchase validation schema
export const purchaseSchema = z.object({
  provider_id: z.string().uuid().optional().nullable(),
  provider_name: z.string().min(1).max(200).transform(sanitizeText),
  amount_usd: z.number().positive('El monto debe ser mayor a 0').max(1000000),
  amount_bs: z.number().nonnegative().max(100000000).optional().nullable(),
  purchase_date: z.string(),
  status: z.enum(['pending', 'paid']).default('pending'),
  notes: z.string().max(1000).optional().nullable().transform(val => val ? sanitizeText(val) : val),
});

export type PurchaseInput = z.infer<typeof purchaseSchema>;

// Validate and return parsed data or throw with user-friendly error
export function validateInput<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const firstError = result.error.errors[0];
    throw new Error(firstError?.message || 'Datos inválidos');
  }
  return result.data;
}

