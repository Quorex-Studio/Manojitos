// ─── AUTH & PROFILE ──────────────────────────────────────────

// Perfil básico del usuario admin (tabla: profiles)
export interface Profile {
  id: string;
  user_id: string;
  full_name: string | null;
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


