/**
 * AES-256-GCM envelope encryption for sensitive third-party credentials
 * stored in the profiles table (Musaned / Enjaz / MOFA passwords).
 *
 * Values stored in the DB use the format:
 *   enc:v1:<base64-iv>:<base64-ciphertext>
 *
 * Legacy plaintext values (without the prefix) are returned as-is on read
 * so existing rows keep working until the manager next saves their credentials.
 *
 * Requires CREDENTIALS_ENCRYPTION_KEY env var — a 64-char hex string (256 bits).
 * Generate one with: openssl rand -hex 32
 */

const ENC_PREFIX = "enc:v1:";

function hexToBytes(hex: string): Uint8Array<ArrayBuffer> {
  if (hex.length !== 64) throw new Error("CREDENTIALS_ENCRYPTION_KEY must be 64 hex chars (32 bytes)");
  const buf = new ArrayBuffer(32);
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < 32; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

async function getCryptoKey(): Promise<CryptoKey> {
  const raw = process.env.CREDENTIALS_ENCRYPTION_KEY;
  if (!raw) throw new Error("CREDENTIALS_ENCRYPTION_KEY env var not set");
  return crypto.subtle.importKey("raw", hexToBytes(raw), "AES-GCM", false, ["encrypt", "decrypt"]);
}

function b64Encode(buf: ArrayBuffer | Uint8Array): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf instanceof ArrayBuffer ? buf : buf.buffer)));
}

function b64Decode(s: string): Uint8Array {
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}

export async function encryptCredential(plaintext: string): Promise<string> {
  const key = await getCryptoKey();
  const ivBuf = new ArrayBuffer(12);
  const iv = new Uint8Array(ivBuf);
  crypto.getRandomValues(iv);
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plaintext));
  return `${ENC_PREFIX}${b64Encode(iv)}:${b64Encode(ct)}`;
}

export async function decryptCredential(stored: string | null): Promise<string | null> {
  if (!stored) return null;
  if (!stored.startsWith(ENC_PREFIX)) return stored; // legacy plaintext — return as-is
  const [ivB64, ctB64] = stored.slice(ENC_PREFIX.length).split(":");
  const key = await getCryptoKey();
  const ivBytes = b64Decode(ivB64);
  const ctBytes = b64Decode(ctB64);
  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: ivBytes.buffer.slice(ivBytes.byteOffset, ivBytes.byteOffset + ivBytes.byteLength) as ArrayBuffer },
    key,
    ctBytes.buffer.slice(ctBytes.byteOffset, ctBytes.byteOffset + ctBytes.byteLength) as ArrayBuffer,
  );
  return new TextDecoder().decode(pt);
}
