import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export function hashDraftSecret(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

export function newDraftSecret(): string {
  return randomBytes(32).toString("hex");
}

export function secretsMatch(provided: string, storedHash: string): boolean {
  const hashed = hashDraftSecret(provided);
  const a = Buffer.from(hashed, "hex");
  const b = Buffer.from(storedHash, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function draftSecretFromRequest(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (header?.startsWith("Bearer ")) return header.slice(7).trim() || null;
  return null;
}
