import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { decodeSuiPrivateKey } from '@mysten/sui/cryptography';
import { WalrusClient } from '@mysten/walrus';
import { suiClient } from './sui';

// Lazy-initialised client
let _walrusClient: WalrusClient | null = null;

async function getWalrusClient() {
  if (_walrusClient) return _walrusClient;

  try {
    const isMainnet = process.env.SUI_NETWORK === 'mainnet';

    _walrusClient = new WalrusClient({
      network: isMainnet ? 'mainnet' : 'testnet',
      suiClient: suiClient as any, // Workaround in case WalrusClient types expect the older type
    });
    return _walrusClient;
  } catch (error) {
    console.error('Failed to initialise WalrusClient:', error);
    throw new Error('Walrus SDK initialisation failed');
  }
}

function getSigner(): Ed25519Keypair {
  const privKey = process.env.SUI_PRIVATE_KEY || '';
  if (!privKey.startsWith('suiprivkey')) {
    throw new Error('Invalid or missing SUI_PRIVATE_KEY. It must start with suiprivkey');
  }
  const decoded = decodeSuiPrivateKey(privKey);
  return Ed25519Keypair.fromSecretKey(decoded.secretKey);
}

export interface UploadSession {
  blobId: string;
  uploadUrl: string;
  rootHash: Uint8Array;
}

export async function initiateUpload(
  fileSize: number,
  contentType: string,
  encrypted: boolean = false
): Promise<UploadSession> {
  // Ensure the SDK loads successfully before returning a session
  await getWalrusClient();

  const blobId = `verixa-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return {
    blobId,
    uploadUrl: '/api/upload/complete',
    rootHash: new Uint8Array(32),
  };
}

export async function completeUpload(
  blobId: string,
  fileData: Buffer,
  contentType: string,
  fileName: string
): Promise<{ rootHash: Uint8Array; size: number; blobName: string }> {
  try {
    const client = await getWalrusClient();
    const signer = getSigner();

    // 3-phase write handled internally by WalrusClient writeBlob
    const result = await client.writeBlob({
      signer,
      blob: new Uint8Array(fileData),
      epochs: 5, // Default storage duration, requires sufficient WAL
      deletable: true,
    });

    return {
      rootHash: new Uint8Array(32), // Legacy field, mock it
      size: fileData.length,
      blobName: result.blobId, // We return the new Walrus Blob ID here
    };
  } catch (error) {
    console.error('Walrus upload error:', error);
    throw new Error('Failed to upload to Walrus storage');
  }
}

export async function downloadBlob(
  blobName: string,
  ownerAddress?: string
): Promise<Buffer> {
  try {
    // blobName is now the Walrus Blob ID since completeUpload returns it.
    const aggregatorUrl = process.env.WALRUS_AGGREGATOR_URL || 'https://aggregator.walrus-testnet.walrus.space';
    const response = await fetch(`${aggregatorUrl}/v1/blobs/${blobName}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch blob from aggregator: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error) {
    console.error('Walrus download error:', error);
    throw new Error('Failed to download from Walrus storage');
  }
}

export function generateBlobId(): string {
  return `verixa-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}