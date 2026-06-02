import { NextRequest, NextResponse } from 'next/server';
import { downloadBlob } from '@/lib/walrus';
import { prisma } from '@/lib/db';
import { decryptData } from '@/lib/encryption';

export async function GET(
  request: NextRequest,
  { params }: { params: { blobId: string } }
) {
  try {
    const { blobId } = params;
    const { searchParams } = new URL(request.url);
    const rawWallet = searchParams.get('wallet');

    // Get file metadata
    let file = await prisma.file.findUnique({
      where: { blobId },
      include: { user: true },
    });

    let content = await prisma.content.findFirst({
      where: { walrusBlobId: blobId },
    });

    if (!file && !content) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 400 } // using 400 to avoid Next.js intercepting 404
      );
    }

    // Check access permissions
    let hasAccess = false;
    const walletAddress = rawWallet?.toLowerCase();

    if (file && file.isPublic && !file.encrypted) {
      hasAccess = true;
    } else if (file && walletAddress && file.user.walletAddress.toLowerCase() === walletAddress) {
      hasAccess = true;
    } else if (content && walletAddress && content.creatorAddress.toLowerCase() === walletAddress) {
      hasAccess = true;
    } else if (walletAddress) {
      const contentId = file?.contentId || content?.id;
      if (contentId != null) {
        // For marketplace content, check if the user has purchased a streaming/viewable tier
        const user = await prisma.user.findUnique({
          where: { walletAddress },
        });
        if (user) {
          const purchases = await prisma.purchase.findMany({
            where: {
              userId: user.id,
              contentId: contentId,
            },
          });
          // Any purchased tier (tier >= 1) is allowed to stream/view the content in-app
          if (purchases.some((p: any) => p.tier >= 1)) {
            hasAccess = true;
          }
        }
      }
    }

    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Access denied or download not permitted for this tier' },
        { status: 403 }
      );
    }

    const contentType = file?.contentType || content?.contentType || 'application/octet-stream';
    const filename = file?.name || content?.title || 'download';

    if (file?.encrypted && file?.encryptionKey) {
      const aggregatorUrl = process.env.WALRUS_AGGREGATOR_URL || 'https://aggregator.walrus-testnet.walrus.space';
      const walrusResponse = await fetch(`${aggregatorUrl}/v1/blobs/${blobId}`);
      
      if (!walrusResponse.ok) {
        throw new Error(`Failed to fetch blob from aggregator: ${walrusResponse.statusText}`);
      }

      const headers = new Headers({
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'private, no-cache',
      });

      const contentLength = walrusResponse.headers.get('Content-Length');
      if (contentLength) {
        // AES-GCM output is 28 bytes smaller (12 IV + 16 Auth Tag)
        const newLen = Math.max(0, parseInt(contentLength, 10) - 28);
        headers.set('Content-Length', newLen.toString());
      }

      const { Readable } = await import('stream');
      const { GcmDecryptStream } = await import('@/lib/encryption');

      // Convert Web Stream from fetch to Node.js Readable stream
      const nodeReadable = Readable.fromWeb(walrusResponse.body as import('stream/web').ReadableStream);
      const decryptStream = new GcmDecryptStream(file.encryptionKey);
      
      // Pipe through our streaming decryptor
      const finalStream = nodeReadable.pipe(decryptStream);

      // Convert back to Web Stream for NextResponse
      return new NextResponse(Readable.toWeb(finalStream) as any, { headers });
    }

    // For non-encrypted files, stream the response directly to avoid timeouts and memory limits
    const aggregatorUrl = process.env.WALRUS_AGGREGATOR_URL || 'https://aggregator.walrus-testnet.walrus.space';
    const walrusResponse = await fetch(`${aggregatorUrl}/v1/blobs/${blobId}`);
    
    if (!walrusResponse.ok) {
      throw new Error(`Failed to fetch blob from aggregator: ${walrusResponse.statusText}`);
    }

    const headers = new Headers({
      'Content-Type': contentType,
      'Content-Disposition': `inline; filename="${filename}"`,
      'Cache-Control': 'private, no-cache',
    });
    
    const contentLength = walrusResponse.headers.get('Content-Length');
    if (contentLength) {
      headers.set('Content-Length', contentLength);
    }

    return new NextResponse(walrusResponse.body, { headers });
  } catch (error) {
    console.error('Download failed:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve file' },
      { status: 500 }
    );
  }
}
