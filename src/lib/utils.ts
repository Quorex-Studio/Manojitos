import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

// Tasa de cambio aproximada para fines de visualización si no hay API
// En un entorno real, esto vendría de un contexto o API
export const ESTIMATED_RATE = 45.00;

export function convertToBS(amount: number, rate: number = ESTIMATED_RATE): number {
  return amount * rate;
}
