"use client";

import { useEffect, useState } from "react";

import { identifyAccount } from "@/lib/analytics";
import {
  authConfigured,
  createAuthBrowserClient,
} from "@/lib/supabase/auth-browser";

/**
 * Whether the visitor has a Supabase session.
 *
 * Was a stub returning a hardcoded `false`, which meant every signed-in
 * customer still saw the signed-out call to action on the landing page and was
 * asked for an email address they had already given.
 *
 * Starts false and resolves on mount, so the signed-out form is what renders
 * during the first paint — the safe way round, since showing a signed-in
 * shortcut to a signed-out visitor would dead-end them at the auth gate.
 */
export function useIsAuthenticated(): boolean {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // Nothing to ask when Supabase Auth has no keys in this environment.
    if (!authConfigured()) return;

    let active = true;
    let unsubscribe: (() => void) | undefined;

    try {
      const client = createAuthBrowserClient();

      client.auth
        .getSession()
        .then(({ data }) => {
          if (active) setIsAuthenticated(Boolean(data.session));
          if (data.session) {
            identifyAccount(data.session.user.id, data.session.user.email);
          }
        })
        .catch(() => {
          // Treated as signed out: the landing page must render either way.
        });

      const { data } = client.auth.onAuthStateChange((_event, session) => {
        if (active) setIsAuthenticated(Boolean(session));
        if (session) identifyAccount(session.user.id, session.user.email);
      });
      unsubscribe = () => data.subscription.unsubscribe();
    } catch {
      // Any auth failure leaves the visitor on the signed-out path, which is
      // the safe default: it works whether or not they have a session.
    }

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, []);

  return isAuthenticated;
}
