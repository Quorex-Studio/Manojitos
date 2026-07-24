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

export function formatBS(amount: number): string {
  const formatted = new Intl.NumberFormat('de-DE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
  return `${formatted}bs`;
}

// Tasa de cambio aproximada para fines de visualización si no hay API
// En un entorno real, esto vendría de un contexto o API
export const ESTIMATED_RATE = 45.00;

export function convertToBS(amount: number, rate: number = ESTIMATED_RATE): number {
  return amount * rate;
}

export const getAvailableSizes = (name: string, category: string): string[] => {
  const normName = name.toLowerCase();
  const normCategory = (category || '').toLowerCase();
  
  const isJeans = normName.includes('jean') || normCategory.includes('jean') || normCategory.includes('pantalones');
  const isShorts = normName.includes('short') || normCategory.includes('short');
  const isTrajeBano = normName.includes('baño') || normName.includes('bano') || normCategory.includes('baño') || normCategory.includes('bano') || normCategory.includes('playa');
  
  if (isJeans || isShorts || isTrajeBano) {
    return ['S', 'M', 'L', 'XL'];
  }
  
  const isSetPlayero = normName.includes('set playero') || normName.includes('sets playeros') || normName.includes('playero') || normCategory.includes('set playero') || normCategory.includes('playero');
  const isBody = normName.includes('body') || normName.includes('bodys') || normCategory.includes('body') || normCategory.includes('bodys');
  const isCaballero = normName.includes('caballero') || normCategory.includes('caballero');
  
  if (isSetPlayero || isBody || isCaballero) {
    return ['Única'];
  }
  
  return ['Única'];
};
