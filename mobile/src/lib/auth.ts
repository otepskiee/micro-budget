import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase, isSupabaseConfigured } from "./supabase";
import { flushOutbox } from "./sync";
import { capture } from "./analytics";

/** Auth is OPTIONAL. Signed-out = fully local (SQLite). Signing in turns on
 * cloud backup: on SIGNED_IN we flush the local outbox up to Supabase. */
export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next);
      if (event === "SIGNED_IN" && next) {
        capture("signed_in");
        void flushOutbox();
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return { session, loading };
}

export async function signInWithEmail(email: string) {
  return supabase.auth.signInWithOtp({ email: email.trim() });
}

export async function signOut() {
  return supabase.auth.signOut();
}
