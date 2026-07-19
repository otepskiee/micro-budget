import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  // Not fatal — the app runs fully offline on local SQLite; sync just no-ops.
  console.warn(
    "[supabase] missing EXPO_PUBLIC_SUPABASE_URL / _PUBLISHABLE_KEY (see .env.example)",
  );
}

// Supabase is sync/backup + auth, NOT the source of truth. The device's SQLite is.
export const supabase = createClient(url ?? "", key ?? "", {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export const isSupabaseConfigured = Boolean(url && key);
