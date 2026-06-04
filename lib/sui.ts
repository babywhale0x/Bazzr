import { SuiJsonRpcClient, JsonRpcHTTPTransport } from '@mysten/sui/jsonRpc';

// Initialize Sui client — server-side uses Tatum RPC directly
const network = (process.env.NEXT_PUBLIC_SUI_NETWORK as 'mainnet' | 'testnet' | 'devnet' | 'localnet') || 'testnet';
const tatumApiKey = process.env.TATUM_SUI_API_KEY || 't-6a15087f8e1cdc441253b0ce-b0398dce955840859730f0d9';
const tatumUrl = network === 'mainnet'
  ? 'https://sui-mainnet.gateway.tatum.io'
  : 'https://sui-testnet.gateway.tatum.io';

export const suiClient = new SuiJsonRpcClient({
  network,
  transport: new JsonRpcHTTPTransport({
    url: tatumUrl,
    rpc: {
      headers: { 'x-api-key': tatumApiKey },
    },
  }),
});

// Contract addresses
export const VERIXA_PACKAGE_ID = process.env.NEXT_PUBLIC_VERIXA_PACKAGE_ID || '';
export const WAL_TOKEN_ADDRESS = network === 'mainnet'
  ? '0x356a26eb9e012a68958082340d4c4116e7f55615cf27affcff209cf0ae544f59::wal::WAL'
  : '0x8270feb7375eee355e64fdb69c50abb6b5f9393a722883c1cf45f8e26048810a::wal::WAL';

// Module names
export const MARKETPLACE_MODULE = `${VERIXA_PACKAGE_ID}::verixa`;

// Access tier constants
export const TIER_FREE = 0;
export const TIER_STREAM = 1;
export const TIER_CITE = 2;
export const TIER_LICENSE = 3;
export const TIER_COMMERCIAL = 4;
export const TIER_SUBSCRIPTION = 5;

// Platform fee (10%)
export const PLATFORM_FEE_BPS = 1000;

// Helper to convert SUI to MIST (smallest unit)
// 1 SUI = 1,000,000,000 MIST
export function suiToMist(sui: number): number {
  return Math.floor(sui * 1_000_000_000);
}

// Helper to convert MIST to SUI
export function mistToSui(mist: number): number {
  return mist / 1_000_000_000;
}

// Format SUI amount for display
export function formatSui(mist: number): string {
  return `${mistToSui(mist).toFixed(4)} SUI`;
}

// Get tier name
export function getTierName(tier: number): string {
  switch (tier) {
    case TIER_FREE:
      return 'Free Preview';
    case TIER_STREAM:
      return 'Stream (In-App)';
    case TIER_CITE:
      return 'Cite (On-chain Reference)';
    case TIER_LICENSE:
      return 'License';
    case TIER_COMMERCIAL:
      return 'Commercial';
    case TIER_SUBSCRIPTION:
      return 'Subscription';
    default:
      return 'Unknown';
  }
}

// Calculate platform fee
export function calculatePlatformFee(amount: number): number {
  return Math.floor((amount * PLATFORM_FEE_BPS) / 10000);
}

// Calculate creator earnings
export function calculateCreatorEarnings(amount: number): number {
  return amount - calculatePlatformFee(amount);
}
