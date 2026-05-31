/**
 * Browser-side AES-256-GCM encryption for content protection.
 *
 * Encrypted format: [12-byte IV] [ciphertext + auth tag]
 *
 * The key is generated per-file. It's stored server-side in the
 * database and only served to users that have purchased access
 * (or the file owner for vault files).
 */

/** Generate a random AES-256-GCM key and return it as a hex string. */
export async function generateEncryptionKey(): Promise<string> {
  const key = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,           // extractable
    ['encrypt', 'decrypt'],
  );
  const raw = await crypto.subtle.exportKey('raw', key);
  return bufToHex(new Uint8Array(raw));
}

/** Encrypt `data` with the given hex key. Returns [12-byte IV | ciphertext]. */
export async function encryptData(
  data: Uint8Array,
  keyHex: string,
): Promise<Uint8Array> {
  const keyBuf = hexToBuf(keyHex);
  const key = await crypto.subtle.importKey(
    'raw', keyBuf.buffer as ArrayBuffer, { name: 'AES-GCM' }, false, ['encrypt'],
  );

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    data.buffer as ArrayBuffer,
  );

  // Prepend IV to ciphertext
  const result = new Uint8Array(iv.length + ciphertext.byteLength);
  result.set(iv, 0);
  result.set(new Uint8Array(ciphertext), iv.length);
  return result;
}

/** Decrypt data that was encrypted with `encryptData`. */
export async function decryptData(
  encryptedData: Uint8Array,
  keyHex: string,
): Promise<Uint8Array> {
  const keyBuf = hexToBuf(keyHex);
  const key = await crypto.subtle.importKey(
    'raw', keyBuf.buffer as ArrayBuffer, { name: 'AES-GCM' }, false, ['decrypt'],
  );

  const iv = encryptedData.slice(0, 12);
  const ciphertext = encryptedData.slice(12);

  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext.buffer as ArrayBuffer,
  );

  return new Uint8Array(plaintext);
}

// ─── Helpers ───

function bufToHex(buf: Uint8Array): string {
  return Array.from(buf).map(b => b.toString(16).padStart(2, '0')).join('');
}

function hexToBuf(hex: string): Uint8Array {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < clean.length; i += 2) {
    bytes[i / 2] = parseInt(clean.substring(i, i + 2), 16);
  }
  return bytes;
}
