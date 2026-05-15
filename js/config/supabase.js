import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ВСТАВЬ СЮДА СВОЙ URL И KEY ИЗ СТАРОГО ПРОЕКТА
const SUPABASE_URL = 'PASTE_YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'PASTE_YOUR_SUPABASE_ANON_KEY';

export const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);