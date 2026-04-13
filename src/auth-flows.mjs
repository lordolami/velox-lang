import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export function hashPassword(password, salt = randomBytes(16).toString("hex")) {
  const key = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${key}`;
}

export function verifyPassword(password, hashed) {
  const [salt, keyHex] = String(hashed || "").split(":");
  if (!salt || !keyHex) return false;
  const calc = scryptSync(password, salt, 64);
  const key = Buffer.from(keyHex, "hex");
  if (calc.length !== key.length) return false;
  return timingSafeEqual(calc, key);
}

export function createOAuthState() {
  return randomBytes(20).toString("hex");
}

export function buildOAuthAuthorizeUrl({ authorizeUrl, clientId, redirectUri, scope = "openid profile email", state }) {
  const u = new URL(authorizeUrl);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("client_id", clientId);
  u.searchParams.set("redirect_uri", redirectUri);
  u.searchParams.set("scope", scope);
  u.searchParams.set("state", state || createOAuthState());
  return u.toString();
}
