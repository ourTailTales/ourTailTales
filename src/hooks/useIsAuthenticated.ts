"use client";

/**
 * Returns whether the current user is authenticated via Supabase.
 *
 * TODO: Implement Supabase session check using createAuthBrowserClient().
 *       Per @supabase/ssr docs for Next.js App Router client components:
 *
 *       import { createAuthBrowserClient } from "@/lib/supabase/auth-browser";
 *
 *       const [isAuthenticated, setIsAuthenticated] = useState(false);
 *       useEffect(() => {
 *         const client = createAuthBrowserClient();
 *         client.auth.getSession().then(({ data }) => {
 *           setIsAuthenticated(!!data.session);
 *         });
 *         const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
 *           setIsAuthenticated(!!session);
 *         });
 *         return () => subscription.unsubscribe();
 *       }, []);
 *
 *       return isAuthenticated;
 */
export function useIsAuthenticated(): boolean {
  // TODO: replace with real Supabase session check (see above)
  return false;
}
