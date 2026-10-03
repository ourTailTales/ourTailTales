"use client";

import { useEffect, useState } from "react";

import {
  authConfigured,
  createAuthBrowserClient,
} from "@/lib/supabase/auth-browser";

/**
 * The address of the signed-in account, or null.
 *
 * Knowing that somebody is signed in is not enough to save a book for them:
 * it has to be known who, so a book made under one address is not filed into
 * the library of a different account that happens to be signed in here.
 *
 * Starts null and resolves on mount, like `useIsAuthenticated`. Null means
 * "nobody, or not known yet", and both are reasons to do nothing.
 */
export function useSessionEmail(): string | null {
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    if (!authConfigured()) return;

    let active = true;
    let unsubscribe: (() => void) | undefined;

    try {
      const client = createAuthBrowserClient();

      client.auth
        .getSession()
        .then(({ data }) => {
          if (active) setEmail(data.session?.user.email?.trim() || null);
        })
        .catch(() => {
          // Treated as signed out.
        });

      const { data } = client.auth.onAuthStateChange((_event, session) => {
        if (active) setEmail(session?.user.email?.trim() || null);
      });
      unsubscribe = () => data.subscription.unsubscribe();
    } catch {
      // Any auth failure leaves this null, which saves nothing automatically.
    }

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, []);

  return email;
}
