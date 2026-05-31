import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const wallet = searchParams.get('wallet');

    let targetUserId = '';
    let targetWallet = '';

    if (wallet) {
      const dbUser = await prisma.user.findUnique({ where: { walletAddress: wallet.toLowerCase() }});
      if (dbUser) {
        targetUserId = dbUser.id;
        targetWallet = dbUser.walletAddress;
      }
    } else {
      const user = await auth();
      if (user) {
        targetUserId = user.id;
        targetWallet = user.walletAddress;
      }
    }

    if (!targetUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const files = await prisma.file.findMany({
      where: { userId: targetUserId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        blobId: true,
        name: true,
        contentType: true,
        size: true,
        isPublic: true,
        encrypted: true,
        createdAt: true,
      },
    });

    const serializedFiles = files.map(file => ({
      ...file,
      size: file.size.toString(),
      createdAt: file.createdAt.toISOString(),
    }));

    return NextResponse.json({ files: serializedFiles });
  } catch (error) {
    console.error('Failed to fetch files:', error);
    return NextResponse.json(
      { error: 'Failed to fetch files' },
      { status: 500 }
    );
  }
}
