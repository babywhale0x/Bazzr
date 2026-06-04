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
    if (!user) return NextResponse.json({ purchases: [] });

    const purchases = await prisma.purchase.findMany({
      where: { userId: user.id },
      orderBy: { purchaseTimestamp: 'desc' },
    });

    // Group purchases by contentId and keep the one with the highest tier
    const purchasesMap = new Map<string, typeof purchases[0]>();
    for (const p of purchases) {
      const key = p.contentId.toString();
      const existing = purchasesMap.get(key);
      if (!existing || p.tier > existing.tier) {
        purchasesMap.set(key, p);
      }
    }
    const uniquePurchases = Array.from(purchasesMap.values()).sort(
      (a, b) => b.purchaseTimestamp.getTime() - a.purchaseTimestamp.getTime()
    );

    const uniqueContentIds = uniquePurchases.map(p => p.contentId);

    // Fetch Content entities manually
    const contents = await prisma.content.findMany({
      where: { id: { in: uniqueContentIds } },
    });

    // Fetch corresponding Files manually
    const files = await prisma.file.findMany({
      where: { contentId: { in: uniqueContentIds } },
      select: {
        contentId: true,
        name: true,
        contentType: true,
        previewUrl: true,
        previewContentType: true,
        blobId: true,
      },
    });

    const enrichedPurchases = uniquePurchases.map(p => {
      const content = contents.find(c => c.id === p.contentId);
      const contentFiles = files.filter(f => f.contentId === p.contentId);
      
      const safeContentFiles = contentFiles.map(f => ({
        ...f,
        contentId: f.contentId ? f.contentId.toString() : null
      }));
      
      return {
        ...p,
        // Convert BigInts to string for JSON serialization
        purchaseId: p.purchaseId.toString(),
        contentId: p.contentId.toString(),
        amountPaid: Number(p.amountPaid) || 0,
        tier: p.tier,
        tierId: p.tier, // Map db tier to tierId expected by frontend
        content: content ? {
          title: content.title,
          walrusBlobId: content.walrusBlobId,
          files: safeContentFiles
        } : {
          title: 'Unknown Content',
          walrusBlobId: '',
          files: []
        }
      };
    });

    return NextResponse.json({ purchases: enrichedPurchases });
  } catch (error) {
    console.error('Profile purchases error:', error);
    return NextResponse.json({ error: 'Failed to fetch purchases' }, { status: 500 });
  }
}
