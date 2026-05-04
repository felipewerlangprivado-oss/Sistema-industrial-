
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('ERRO: VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY não estão definidos.');
}

export const supabase = createClient(
  supabaseUrl || 'https://debhhucfesgemtxinvia.supabase.co', 
  supabaseKey || 'sb_publishable_FotH1zQkHI8PptGPkgWWuQ_d7GU8Wbn'
);
