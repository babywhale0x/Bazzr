import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const rawWallet = request.nextUrl.searchParams.get('walletAddress');
    if (!rawWallet) {
      return NextResponse.json({ error: 'walletAddress required' }, { status: 400 });
    }
    const walletAddress = rawWallet.toLowerCase();

    const user = await prisma.user.findUnique({ where: { walletAddress } });
    if (!user) {
      return NextResponse.json({ listed: 0, sold: 0, earned: 0, purchased: 0 });
    }

    const listed = await prisma.file.count({ where: { userId: user.id, isPublished: true } });

    // Storage stats
    const totalFiles = await prisma.file.count({ where: { userId: user.id } });
    const storageAgg = await prisma.file.aggregate({
      where: { userId: user.id },
      _sum: { size: true, storageFee: true },
    });

    // Sales of content owned by this user
    const userFiles = await prisma.file.findMany({
      where: { userId: user.id, contentId: { not: null } },
      select: { contentId: true },
    });
    
    // We filter nulls, but since we queried `not: null`, they should be BigInts.
    const contentIdsArray = userFiles.map(f => f.contentId as bigint);
    // Remove duplicates
    const uniqueContentIds = Array.from(new Set(contentIdsArray));

    let soldCount = 0;
    let earnedAgg = { _sum: { amountPaid: null as any } };

    if (uniqueContentIds.length > 0) {
      soldCount = await prisma.purchase.count({
        where: { contentId: { in: uniqueContentIds } },
      });

      earnedAgg = await prisma.purchase.aggregate({
        where: { contentId: { in: uniqueContentIds } },
        _sum: { amountPaid: true },
      });
    }

    const purchased = await prisma.purchase.count({ where: { userId: user.id } });

    return NextResponse.json({
      listed,
      sold: soldCount,
      earned: Number(earnedAgg._sum.amountPaid ?? 0),
      purchased,
      totalFiles,
      totalStorageFees: Number(storageAgg._sum.storageFee ?? 0),
      totalStorageBytes: (storageAgg._sum.size ?? BigInt(0)).toString(),
    });
  } catch (error) {
    console.error('Profile stats error:', error);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
