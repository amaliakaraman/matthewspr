import crypto from 'node:crypto';

/**
 * AES-256-GCM token encryption for OAuth secrets stored in Postgres.
 *
 * TOKEN_ENCRYPTION_KEY must be a base64-encoded 32-byte key:
 *   openssl rand -base64 32
 */
const ALGO = 'aes-256-gcm';
const IV_LEN = 12;

function key() {
  const k = process.env.TOKEN_ENCRYPTION_KEY;
  if (!k) throw new Error('TOKEN_ENCRYPTION_KEY missing');
  const buf = Buffer.from(k, 'base64');
  if (buf.length !== 32) throw new Error('TOKEN_ENCRYPTION_KEY must decode to 32 bytes');
  return buf;
}

/** Encrypt a string. Returns base64( iv | tag | ciphertext ). */
export function encryptToken(plain: string): string {
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, key(), iv);
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]).toString('base64');
}

/** Decrypt a string previously produced by `encryptToken`. */
export function decryptToken(payload: string): string {
  const buf = Buffer.from(payload, 'base64');
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + 16);
  const ct = buf.subarray(IV_LEN + 16);
  const decipher = crypto.createDecipheriv(ALGO, key(), iv);
  decipher.setAuthTag(tag);
  const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
  return pt.toString('utf8');
}

/** Stateful PKCE pair for OAuth 2.0 flows. */
export function pkcePair() {
  const verifier = crypto.randomBytes(32).toString('base64url');
  const challenge = crypto
    .createHash('sha256')
    .update(verifier)
    .digest('base64url');
  return { verifier, challenge };
}

function stateKey() {
  const k = process.env.TOKEN_ENCRYPTION_KEY;
  if (!k) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'TOKEN_ENCRYPTION_KEY is required in production for signing OAuth state'
      );
    }
    return 'dev-key';
  }
  return k;
}

/** Sign a short-lived value for `state` cookies. */
export function signState(value: string): string {
  const mac = crypto.createHmac('sha256', stateKey()).update(value).digest('base64url');
  return `${value}.${mac}`;
}

export function verifyState(signed: string): string | null {
  const i = signed.lastIndexOf('.');
  if (i < 0) return null;
  const value = signed.slice(0, i);
  const sig = signed.slice(i + 1);
  const expected = crypto.createHmac('sha256', stateKey()).update(value).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expected);
  if (sigBuf.length !== expectedBuf.length) return null;
  return crypto.timingSafeEqual(sigBuf, expectedBuf) ? value : null;
}
