import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function PUT(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const epochs = searchParams.get('epochs') || '5';
    
    // Read raw request body
    const arrayBuffer = await request.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    const publisherUrl = process.env.WALRUS_PUBLISHER_URL || 'https://publisher.walrus-testnet.walrus.space';
    
    console.log(`[Upload Proxy] Uploading ${buffer.length} bytes to ${publisherUrl} with epochs=${epochs}`);
    
    const response = await fetch(`${publisherUrl}/v1/blobs?epochs=${epochs}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/octet-stream',
      },
      body: buffer,
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Upload Proxy] Walrus publisher returned error: ${response.status} - ${errorText}`);
      return NextResponse.json(
        { error: `Walrus HTTP error: ${response.status} - ${errorText}` },
        { status: response.status }
      );
    }
    
    const result = await response.json();
    console.log(`[Upload Proxy] Upload successful! Blob ID: ${result.newlyCreated ? result.newlyCreated.blobObject.blobId : result.alreadyCertified.blobId}`);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[Upload Proxy] Request error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
