import { User, Session } from '@supabase/supabase-js';

// ─── AUTH & PROFILE ──────────────────────────────────────────

export type AppRole = 'admin' | 'moderator' | 'user';

export interface Profile {
  id: string;
  user_id: string;
  username: string | null;
  email: string | null;
  wallet_address: string | null;
  balance: number;
  trading_balance: number;
  profit_balance: number;
  staking_balance: number;
  vip_level: number;
  referral_code: string | null;
  referrer_id: string | null;
  withdraw_password: string | null;
  is_address_bound: boolean;
  withdrawal_address: string | null;
  is_admin: boolean;
  is_banned: boolean;
  last_quantified_at: string | null;
  total_deposited: number;
  total_withdrawn: number;
  referral_count: number;
  registration_ip: string | null;
  device_fingerprint: string | null;
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

// ─── TRANSACTIONS & INVESTMENTS ─────────────────────────────

export type TransactionStatus = 'pending' | 'completed' | 'failed' | 'processing';
export type TransactionType = 'deposit' | 'withdrawal' | 'quantification' | 'commission' | 'investment';
export type InvestmentStatus = 'active' | 'completed' | 'canceled';
export type DepositType = 'quantification' | 'staking';

export interface Transaction {
  id: string;
  user_id: string;
  type: TransactionType;
  amount: number;
  status: TransactionStatus;
  wallet_address: string | null;
  tx_hash: string | null;
  network: string | null;
  created_at: string;
  updated_at: string;
  description: string | null;
  oxapay_track_id: string | null;
  oxapay_pay_link: string | null;
  oxapay_address: string | null;
  oxapay_tx_hash: string | null;
  webhook_verified: boolean;
  deposit_type: string | null;
}

export interface Investment {
  id: string;
  user_id: string;
  plan_id: number | null;
  plan_name: string;
  amount: number;
  daily_rate: number;
  cycle_days: number;
  status: InvestmentStatus;
  started_at: string;
  ends_at: string | null;
  total_earned: number;
  created_at: string;
}
