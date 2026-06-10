import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Load .env file manually
const envPath = './.env';
const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    const key = match[1];
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
});

const supabaseUrl = env['VITE_SUPABASE_URL'];
const supabaseKey = env['VITE_SUPABASE_PUBLISHABLE_KEY'];

console.log('Supabase URL:', supabaseUrl);
console.log('Key length:', supabaseKey?.length);

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDatabase() {
  try {
    // 1. Query customer_profiles
    const { data: profiles, error: errProfiles } = await supabase
      .from('customer_profiles')
      .select('*');

    if (errProfiles) {
      console.error('Error fetching customer_profiles:', errProfiles);
    } else {
      console.log('Customer profiles count:', profiles?.length);
      console.log('Profiles list:', profiles);
    }

    // 2. Query products (public table, should be visible)
    const { data: products, error: errProducts } = await supabase
      .from('products')
      .select('id, name, stock')
      .limit(5);

    if (errProducts) {
      console.error('Error fetching products:', errProducts);
    } else {
      console.log('Products count fetched:', products?.length);
    }

    // 3. Query orders
    const { data: orders, error: errOrders } = await supabase
      .from('orders')
      .select('*')
      .limit(5);

    if (errOrders) {
      console.error('Error fetching orders:', errOrders);
    } else {
      console.log('Orders sample count:', orders?.length);
    }

  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

checkDatabase();
