import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const TATUM_API_KEY = process.env.TATUM_SUI_API_KEY || '';

/**
 * GET /api/tatum/exchange-rate?symbol=SUI&basePair=USD
 * Fetches live cryptocurrency exchange rates from Tatum's Data API.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol') || 'SUI';
    const basePair = searchParams.get('basePair') || 'USD';

    const response = await fetch(
      `https://api.tatum.io/v3/tatum/rate/${encodeURIComponent(symbol)}?basePair=${encodeURIComponent(basePair)}`,
      {
        headers: {
          'x-api-key': TATUM_API_KEY,
        },
        next: { revalidate: 60 }, // Cache for 60 seconds
      }
    );

    if (!response.ok) {
      throw new Error(`Tatum API error: ${response.statusText}`);
    }

    const data = await response.json();

    return NextResponse.json({
      symbol: data.id,
      basePair: data.basePair,
      value: parseFloat(data.value),
      source: data.source,
      timestamp: data.timestamp,
    });
  } catch (error: any) {
    console.error('Exchange rate fetch failed:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch exchange rate' },
      { status: 500 }
    );
  }
}
