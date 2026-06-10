// ─── AUTH & PROFILE ──────────────────────────────────────────

// Perfil básico del usuario admin (tabla: profiles)
export interface Profile {
  id: string;
  user_id: string;
  full_name: string | null;
  created_at: string;
  updated_at: string;
}

// Perfil completo de cliente (tabla: customer_profiles)
export interface CustomerProfile {
  id: string;
  user_id: string;
  full_name: string | null;
  phone: string;
  phone_verified: boolean;
  email: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  notes: string | null;
  notification_preferences: {
    email: boolean;
    sms: boolean;
    internal: boolean;
  };
  created_at: string;
  updated_at: string;
}

// ─── PRODUCTS ────────────────────────────────────────────────

export interface Product {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  price_usd: number;
  stock: number;
  minimum_stock: number | null;
  category: string | null;
  image_url: string | null;
  sold_count: number;
  created_at: string;
  updated_at: string;
}

export interface PublicProduct {
  id: string;
  name: string;
  description: string | null;
  price_usd: number;
  stock: number;
  category: string | null;
  image_url: string | null;
  sold_count: number;
  created_at: string;
}

// ─── SALES & ORDERS ──────────────────────────────────────────

export type SaleStatus = 'pending' | 'confirmed' | 'cancelled';

export interface Sale {
  id: string;
  user_id: string;
  product_id: string | null;
  product_name: string;
  quantity: number;
  unit_price_usd: number;
  total_usd: number;
  total_bs: number | null;
  payment_method: string;
  client_name: string | null;
  client_phone: string | null;
  is_credit: boolean;
  notes: string | null;
  status: SaleStatus;
  created_at: string;
}

export interface OrderItem {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total: number;
  image_url?: string;
}

export interface Order {
  id: string;
  user_id: string;
  customer_user_id: string | null;
  customer_name: string;
  customer_phone: string | null;
  customer_email: string | null;
  items: OrderItem[];
  subtotal: number;
  discount: number;
  total_usd: number;
  total_bs: number | null;
  status: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  payment_method: string | null;
  payment_status: 'pending' | 'paid' | 'failed' | 'refunded';
  shipping_address: string | null;
  shipping_city: string | null;
  shipping_state: string | null;
  tracking_number: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CheckoutItem {
  id: string;
  name: string;
  quantity: number;
  price_usd: number;
}

export interface CheckoutData {
  payment_method: string;
  client_name: string;
  client_phone: string;
  notes?: string;
  total_bs_rate?: number;
}

export interface CheckoutResponse {
  success: boolean;
  sale_ids: string[];
  total_usd: number;
  exchange_rate_used: number;
}

export interface StockValidationError {
  productId: string;
  productName: string;
  requested: number;
  available: number;
}

// ─── CREDITS & FINANCIAL ─────────────────────────────────────

export interface Credit {
  id: string;
  user_id: string;
  client_user_id: string | null;
  client_name: string;
  client_phone: string | null;
  client_email: string | null;
  credit_limit: number;
  current_balance: number;
  cut_off_day: number;
  grace_days: number;
  status: string;
  is_blocked: boolean;
  blocked_at: string | null;
  blocked_reason: string | null;
  next_due_date: string | null;
  last_payment_date: string | null;
  last_reminder_sent_at: string | null;
  reminders_sent: any; // Using any for Json compatible with older types if needed, or we can use generic Json
  notes: string | null;
  created_at: string;
  updated_at: string;
  trust_score: number;
  trust_level: 'CONFIABLE' | 'RIESGO' | 'CRITICO';
  avg_payment_days: number;
  total_purchases: number;
  total_paid_on_time: number;
  total_paid_late: number;
  last_late_date: string | null;
  consecutive_late_payments: number;
  restriction_level: number;
  early_payment_discount: number;
  auto_limit_adjustment: boolean;
  calculatedStatus?: string;
  daysUntilDue?: number;
  daysOverdue?: number;
}

export interface CreditInput {
  client_name: string;
  client_phone?: string | null;
  client_email?: string | null;
  client_user_id?: string | null;
  credit_limit?: number;
  cut_off_day?: number;
  grace_days?: number;
  notes?: string | null;
  next_due_date?: string | null;
  early_payment_discount?: number;
  auto_limit_adjustment?: boolean;
}

export interface CreditTransaction {
  id: string;
  credit_id: string;
  user_id: string;
  type: 'CARGO' | 'ABONO';
  amount: number;
  previous_balance: number;
  new_balance: number;
  sale_id: string | null;
  description: string | null;
  created_at: string;
}

export interface CreditReminder {
  id: string;
  credit_id: string;
  reminder_type: string;
  channel: string;
  message: string;
  sent_at: string | null;
  delivered: boolean;
  created_at: string;
}

export interface PaymentPromise {
  id: string;
  credit_id: string;
  user_id: string;
  promised_amount: number;
  promised_date: string;
  actual_payment_date: string | null;
  actual_amount_paid: number | null;
  status: 'PENDIENTE' | 'CUMPLIDA' | 'INCUMPLIDA' | 'PARCIAL';
  client_accepted: boolean;
  accepted_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// ─── PROVIDERS & PURCHASES ───────────────────────────────────

export interface Provider {
  id: string;
  user_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  created_at: string;
}

export interface Purchase {
  id: string;
  user_id: string;
  provider_id: string | null;
  provider_name: string;
  amount_usd: number;
  amount_bs: number | null;
  status: string;
  notes: string | null;
  purchase_date: string;
  created_at: string;
  paid_at: string | null;
}

// ─── LEDGER (FINANCIAL INTEGRITY) ────────────────────────────

export interface LedgerEntry {
  id: string;
  user_id: string;
  entry_type: 'debit' | 'credit';
  amount_usd: number;
  amount_bs: number | null;
  reference_type: string;
  reference_id: string | null;
  description: string | null;
  balance_after_usd: number;
  balance_after_bs: number | null;
  metadata: Record<string, unknown>;
  is_reversal: boolean;
  reversal_of_id: string | null;
  reversed_by_id: string | null;
  created_at: string;
}

export interface LedgerEntryInput {
  entry_type: 'debit' | 'credit';
  amount_usd: number;
  amount_bs?: number | null;
  reference_type: string;
  reference_id?: string | null;
  description?: string | null;
  metadata?: Record<string, unknown>;
}

// ─── BUSINESS RULES ─────────────────────────────────────────

export type RuleType = 'credit_block' | 'limit_adjustment' | 'notification' | 'restriction';

export interface RuleConditions {
  min_trust_score?: number;
  max_trust_score?: number;
  max_overdue_days?: number;
  min_overdue_days?: number;
  min_balance?: number;
  max_balance?: number;
  credit_status?: string[];
}

export interface RuleActions {
  block_credit?: boolean;
  reduce_limit_percentage?: number;
  send_notification?: boolean;
  notification_channel?: string[];
  restriction_level?: number;
  custom_message?: string;
}

export interface BusinessRule {
  id: string;
  user_id: string;
  rule_key: string;
  rule_name: string;
  description: string | null;
  rule_type: RuleType;
  conditions: RuleConditions;
  actions: RuleActions;
  is_active: boolean;
  priority: number;
  created_at: string;
  updated_at: string;
}

export interface BusinessRuleInput {
  rule_key: string;
  rule_name: string;
  description?: string;
  rule_type: RuleType;
  conditions: RuleConditions;
  actions: RuleActions;
  is_active?: boolean;
  priority?: number;
}



