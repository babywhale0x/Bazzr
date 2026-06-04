import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET all files uploaded by a user (published + delisted)
export async function GET(request: NextRequest) {
  try {
    const rawWallet = request.nextUrl.searchParams.get('walletAddress');
    if (!rawWallet) {
      return NextResponse.json({ error: 'walletAddress required' }, { status: 400 });
    }
    const walletAddress = rawWallet.toLowerCase();

    const user = await prisma.user.findUnique({ where: { walletAddress } });
    if (!user) return NextResponse.json({ files: [] });

    const files = await prisma.file.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        blobId: true,
        name: true,
        contentType: true,
        size: true,
        isPublished: true,
        isPublic: true,
        encrypted: true,
        previewUrl: true,
        previewContentType: true,
        description: true,
        createdAt: true,
        contentId: true,
        storageFee: true,
      },
    });

    const serializedFiles = files.map(f => ({
      ...f,
      size: f.size.toString(),
      contentId: f.contentId ? f.contentId.toString() : null,
      storageFee: f.storageFee ? f.storageFee.toString() : null,
      createdAt: f.createdAt.toISOString()
    }));

    return NextResponse.json({ files: serializedFiles });
  } catch (error) {
    console.error('Profile content error:', error);
    return NextResponse.json({ error: 'Failed to fetch content' }, { status: 500 });
  }
}
