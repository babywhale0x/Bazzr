import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/**
 * POST /api/upload/preview
 *
 * Accepts two shapes:
 * 1. JSON body { walletAddress, blobId, previewDataUrl } — for image previews
 *    generated client-side as a base64 data-URL.
 * 2. multipart/form-data with fields `previewFile`, `walletAddress`, `blobId` — for
 *    audio / video / doc preview clips uploaded by the creator.
 *    These are stored in the DB as uploaded blobs (public, unencrypted).
 */
export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';

    let rawWalletAddress: string;
    let blobId: string;
    let previewUrl: string;

    if (contentType.includes('application/json')) {
      // Image preview — base64 data-URL sent from browser canvas
      const body = await request.json();
      rawWalletAddress = body.walletAddress;
      blobId = body.blobId;
      const base64Data = body.previewDataUrl;

      if (!rawWalletAddress || !blobId || !base64Data) {
        return NextResponse.json(
          { error: 'Missing required fields: walletAddress, blobId, previewDataUrl' },
          { status: 400 }
        );
      }

      const match = base64Data.match(/^data:(.*?);base64,(.*)$/);
      if (match) {
        const base64Str = match[2];
        const buffer = Buffer.from(base64Str, 'base64');
        const publisherUrl = process.env.WALRUS_PUBLISHER_URL || 'https://publisher.walrus-testnet.walrus.space';
        const response = await fetch(`${publisherUrl}/v1/blobs?epochs=5`, {
          method: 'PUT',
          body: buffer,
        });
        if (!response.ok) throw new Error('Walrus upload failed for image preview');
        const result = await response.json();
        const previewBlobId = result.newlyCreated ? result.newlyCreated.blobObject.blobId : result.alreadyCertified.blobId;
        const aggregatorUrl = process.env.WALRUS_AGGREGATOR_URL || 'https://aggregator.walrus-testnet.walrus.space';
        previewUrl = `${aggregatorUrl}/v1/blobs/${previewBlobId}`;
      } else {
        previewUrl = base64Data; // Fallback
      }
    } else if (contentType.includes('multipart/form-data')) {
      // Audio / Video / Doc preview — actual file upload
      const formData = await request.formData();
      const previewFile = formData.get('previewFile') as File | null;
      rawWalletAddress = formData.get('walletAddress') as string;
      blobId = formData.get('blobId') as string;

      if (!previewFile || !rawWalletAddress || !blobId) {
        return NextResponse.json(
          { error: 'Missing required fields: previewFile, walletAddress, blobId' },
          { status: 400 }
        );
      }

      // Upload the preview file directly to Walrus
      const arrayBuffer = await previewFile.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const publisherUrl = process.env.WALRUS_PUBLISHER_URL || 'https://publisher.walrus-testnet.walrus.space';
      const response = await fetch(`${publisherUrl}/v1/blobs?epochs=5`, {
        method: 'PUT',
        body: buffer,
      });
      
      if (!response.ok) throw new Error('Walrus upload failed for file preview');
      const result = await response.json();
      const previewBlobId = result.newlyCreated ? result.newlyCreated.blobObject.blobId : result.alreadyCertified.blobId;
      const aggregatorUrl = process.env.WALRUS_AGGREGATOR_URL || 'https://aggregator.walrus-testnet.walrus.space';
      previewUrl = `${aggregatorUrl}/v1/blobs/${previewBlobId}`;
    } else {
      return NextResponse.json({ error: 'Unsupported content type' }, { status: 415 });
    }

    const walletAddress = rawWalletAddress.toLowerCase();

    // Ensure user exists
    let user = await prisma.user.findUnique({ where: { walletAddress } });
    if (!user) {
      user = await prisma.user.create({ data: { walletAddress } });
    }

    // Update the File record with the preview URL
    await prisma.file.updateMany({
      where: { blobId, userId: user.id },
      data: { previewUrl },
    });

    return NextResponse.json({ success: true, previewUrl });
  } catch (error) {
    console.error('Preview upload failed:', error);
    return NextResponse.json({ error: 'Failed to save preview' }, { status: 500 });
  }
}
