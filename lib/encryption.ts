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
  if (!globalThis.crypto || !globalThis.crypto.subtle) {
    throw new Error('Encryption requires a secure context (HTTPS or localhost).');
  }
  const key = await globalThis.crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,           // extractable
    ['encrypt', 'decrypt'],
  );
  const raw = await globalThis.crypto.subtle.exportKey('raw', key);
  return bufToHex(new Uint8Array(raw));
}

/** Encrypt `data` with the given hex key. Returns [12-byte IV | ciphertext]. */
export async function encryptData(
  data: Uint8Array,
  keyHex: string,
): Promise<Uint8Array> {
  const keyBuf = hexToBuf(keyHex);
  const key = await globalThis.crypto.subtle.importKey(
    'raw', keyBuf as any, { name: 'AES-GCM' }, false, ['encrypt'],
  );

  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await globalThis.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    data as any,
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
  const key = await globalThis.crypto.subtle.importKey(
    'raw', keyBuf as any, { name: 'AES-GCM' }, false, ['decrypt'],
  );

  const iv = encryptedData.slice(0, 12);
  const ciphertext = encryptedData.slice(12);

  const plaintext = await globalThis.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext as any,
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

import { Transform } from 'stream';
import crypto from 'crypto';

/**
 * A Node.js Transform stream that decrypts an AES-256-GCM stream.
 * It expects the format: [12-byte IV] [Ciphertext] [16-byte Auth Tag].
 */
export class GcmDecryptStream extends Transform {
  private decipher: crypto.DecipherGCM | null = null;
  private key: Buffer;
  private buffer: Buffer = Buffer.alloc(0);
  private iv: Buffer | null = null;

  constructor(keyHex: string) {
    super();
    this.key = Buffer.from(keyHex.startsWith('0x') ? keyHex.slice(2) : keyHex, 'hex');
  }

  _transform(chunk: Buffer, encoding: string, callback: Function) {
    this.buffer = Buffer.concat([this.buffer, chunk]);

    // We need at least 12 bytes for IV
    if (!this.iv) {
      if (this.buffer.length >= 12) {
        this.iv = this.buffer.subarray(0, 12);
        this.buffer = this.buffer.subarray(12);
        this.decipher = crypto.createDecipheriv('aes-256-gcm', this.key, this.iv);
      } else {
        return callback(); // Need more data
      }
    }

    // We must always keep at least 16 bytes in the buffer for the auth tag
    if (this.buffer.length > 16) {
      const bytesToProcess = this.buffer.length - 16;
      const dataToProcess = this.buffer.subarray(0, bytesToProcess);
      this.buffer = this.buffer.subarray(bytesToProcess);

      try {
        const decrypted = this.decipher!.update(dataToProcess);
        if (decrypted.length > 0) {
          this.push(decrypted);
        }
      } catch (err) {
        return callback(err);
      }
    }
    callback();
  }

  _flush(callback: Function) {
    if (!this.decipher) {
      return callback(new Error('Stream ended before IV was received'));
    }
    if (this.buffer.length !== 16) {
      return callback(new Error(`Invalid auth tag length: expected 16, got ${this.buffer.length}`));
    }
    try {
      this.decipher.setAuthTag(this.buffer);
      const final = this.decipher.final();
      if (final.length > 0) {
        this.push(final);
      }
      callback();
    } catch (err) {
      callback(err);
    }
  }
}
