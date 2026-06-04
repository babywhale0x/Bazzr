import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const TATUM_API_KEY = process.env.TATUM_SUI_API_KEY || '';
const SUI_NETWORK = process.env.SUI_NETWORK || 'testnet';

const TATUM_RPC_URL = SUI_NETWORK === 'mainnet'
  ? 'https://sui-mainnet.gateway.tatum.io'
  : 'https://sui-testnet.gateway.tatum.io';

/**
 * GET /api/tatum/transactions?address=0x...&limit=10
 * Fetches on-chain transaction history via Tatum's Sui RPC gateway
 * using the suix_queryTransactionBlocks method.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 50);
    const cursor = searchParams.get('cursor') || null;

    if (!address) {
      return NextResponse.json({ error: 'address is required' }, { status: 400 });
    }

    // Query outgoing transactions (FromAddress)
    const outgoingReq = fetch(TATUM_RPC_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': TATUM_API_KEY,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'suix_queryTransactionBlocks',
        params: [
          {
            filter: { FromAddress: address },
            options: { showEffects: true, showInput: true },
          },
          cursor,
          limit,
          true, // descending order (newest first)
        ],
      }),
    });

    // Query incoming transactions (ToAddress)
    const incomingReq = fetch(TATUM_RPC_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': TATUM_API_KEY,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'suix_queryTransactionBlocks',
        params: [
          {
            filter: { ToAddress: address },
            options: { showEffects: true, showInput: true },
          },
          cursor,
          limit,
          true,
        ],
      }),
    });

    const [outRes, inRes] = await Promise.all([outgoingReq, incomingReq]);
    const [outData, inData] = await Promise.all([outRes.json(), inRes.json()]);

    // Merge and deduplicate by digest
    const txMap = new Map<string, any>();

    const processResults = (results: any[], direction: string) => {
      if (!results) return;
      for (const tx of results) {
        if (!txMap.has(tx.digest)) {
          txMap.set(tx.digest, {
            digest: tx.digest,
            timestampMs: tx.timestampMs,
            direction,
            sender: tx.transaction?.data?.sender || null,
            gasUsed: tx.effects?.gasUsed || null,
            status: tx.effects?.status?.status || 'unknown',
            checkpoint: tx.checkpoint,
          });
        }
      }
    };

    processResults(outData.result?.data, 'outgoing');
    processResults(inData.result?.data, 'incoming');

    // Sort by timestamp descending
    const transactions = Array.from(txMap.values())
      .sort((a, b) => Number(b.timestampMs || 0) - Number(a.timestampMs || 0))
      .slice(0, limit);

    return NextResponse.json({
      transactions,
      hasMore: outData.result?.hasNextPage || inData.result?.hasNextPage || false,
      nextCursor: outData.result?.nextCursor || null,
      source: 'tatum-sui-rpc',
    });
  } catch (error: any) {
    console.error('Transaction history fetch failed:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch transactions' },
      { status: 500 }
    );
  }
}
