import { NextRequest, NextResponse } from 'next/server';

const TATUM_API_KEY = process.env.TATUM_SUI_API_KEY || 't-6a15087f8e1cdc441253b0ce-b0398dce955840859730f0d9';
const SUI_NETWORK = process.env.NEXT_PUBLIC_SUI_NETWORK || 'testnet';
const TATUM_RPC_URL = SUI_NETWORK === 'mainnet'
  ? 'https://sui-mainnet.gateway.tatum.io'
  : 'https://sui-testnet.gateway.tatum.io';

/**
 * Proxy JSON-RPC requests from the browser to Tatum's Sui RPC gateway.
 * This avoids CORS issues and keeps the API key server-side.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const response = await fetch(TATUM_RPC_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': TATUM_API_KEY,
      },
      body: JSON.stringify(body),
      cache: 'no-store',
    });

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[sui-rpc proxy] Error:', error.message);
    return NextResponse.json(
      { jsonrpc: '2.0', error: { code: -32603, message: error.message }, id: null },
      { status: 502 }
    );
  }
}
