import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const contentId = BigInt(params.id);
    const { searchParams } = new URL(request.url);
    const rawWallet = searchParams.get('wallet');

    if (!rawWallet) {
      return NextResponse.json({ hasAccess: false, canDownload: false });
    }

    const walletAddress = rawWallet.toLowerCase();

    const user = await prisma.user.findUnique({
      where: { walletAddress },
    });

    if (!user) {
      return NextResponse.json({ hasAccess: false, canDownload: false });
    }

    // Check if the user is the creator
    const content = await prisma.content.findUnique({
      where: { id: contentId },
    });

    if (content && content.creatorAddress.toLowerCase() === walletAddress) {
      return NextResponse.json({ hasAccess: true, canDownload: true, tier: 4 });
    }

    const purchases = await prisma.purchase.findMany({
      where: {
        userId: user.id,
        contentId: contentId,
      },
      orderBy: {
        tier: 'desc',
      },
    });

    if (purchases.length === 0) {
      return NextResponse.json({ hasAccess: false, canDownload: false });
    }

    const highestTier = purchases[0].tier;
    // TIER_LICENSE = 3, TIER_COMMERCIAL = 4 are downloadable
    const canDownload = highestTier >= 3;

    return NextResponse.json({
      hasAccess: true,
      canDownload,
      tier: highestTier,
      purchase: {
        purchaseId: purchases[0].purchaseId.toString(),
        contentId: purchases[0].contentId.toString(),
        tier: purchases[0].tier,
        tierId: purchases[0].tier, // map to tierId for safety
        amountPaid: Number(purchases[0].amountPaid) || 0,
        purchaseTimestamp: purchases[0].purchaseTimestamp.toISOString(),
        licenseHash: purchases[0].licenseHash,
        transactionHash: purchases[0].transactionHash,
      }
    });
  } catch (error) {
    console.error('Failed to check access:', error);
    return NextResponse.json(
      { error: 'Failed to check access' },
      { status: 500 }
    );
  }
}
