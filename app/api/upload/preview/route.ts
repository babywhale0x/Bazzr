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
      previewUrl = body.previewDataUrl;

      if (!rawWalletAddress || !blobId || !previewUrl) {
        return NextResponse.json(
          { error: 'Missing required fields: walletAddress, blobId, previewDataUrl' },
          { status: 400 }
        );
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

      // Convert file to base64 data-URL for storage
      // In production replace this with a CDN / Shelby public blob upload
      const arrayBuffer = await previewFile.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString('base64');
      previewUrl = `data:${previewFile.type};base64,${base64}`;
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
