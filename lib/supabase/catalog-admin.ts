import "server-only";
import { createClient } from "@supabase/supabase-js";
// Call only after verifying the visitor with auth.getUser(). Never export the key.
export async function catalogWrite(userId: string, operation: string, args: Record<string, unknown>) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("Catalog server credentials are not configured");
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return db.rpc("ding_catalog_write", { p_user_id: userId, p_operation: operation, p_args: args });
}
