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

    const ownerAddress = file?.user?.walletAddress || content?.creatorAddress;
    // Retrieve from Walrus using blobId as blobName
    const data = await downloadBlob(blobId, ownerAddress);

    let outputData: any = new Uint8Array(data);
    
    if (file?.encrypted && file?.encryptionKey) {
      outputData = await decryptData(outputData, file.encryptionKey);
    }

    const contentType = file?.contentType || content?.contentType || 'application/octet-stream';
    const filename = file?.name || content?.title || 'download';

    return new NextResponse(outputData as any, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'private, no-cache',
        'Content-Length': outputData.length.toString(),
      },
    });
  } catch (error) {
    console.error('Download failed:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve file' },
      { status: 500 }
    );
  }
}
