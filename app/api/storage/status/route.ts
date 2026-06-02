import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getUserStorage } from '@/lib/contract-queries';

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

    // Aggregate total size from user's files
    const fileStats = await prisma.file.aggregate({
      where: { userId: targetUserId },
      _sum: { size: true },
    });
    const totalBytes = fileStats._sum.size || BigInt(0);

    // Fetch WAL from Sui RPC
    let walrusBalance = BigInt(0);
    try {
      const { suiClient, WAL_TOKEN_ADDRESS } = await import('@/lib/sui');
      try {
        const balance = await suiClient.getBalance({
          owner: targetWallet,
          coinType: WAL_TOKEN_ADDRESS
        });
        walrusBalance = BigInt(balance.totalBalance);
      } catch (e) {
        walrusBalance = BigInt(0);
      }
    } catch (e) {
      console.error('Failed to fetch WAL balance:', e);
    }

    // Calculate monthly cost
    const bytesPerGB = 1073741824;
    const costPerGBMonthOctas = 100000;
    const gb = Math.ceil(Number(totalBytes) / bytesPerGB);
    const monthlyCost = BigInt(gb * costPerGBMonthOctas);
    const monthsRemaining = monthlyCost > 0 
      ? BigInt(Math.floor(Number(walrusBalance) / Number(monthlyCost)))
      : BigInt(0);

    // Also get from blockchain for grace period
    const chainStorage = await getUserStorage(targetWallet);

    return NextResponse.json({
      totalBytes: totalBytes.toString(),
      walletBalance: walrusBalance.toString(),
      monthlyCost: monthlyCost.toString(),
      monthsRemaining: monthsRemaining.toString(),
      inGracePeriod: chainStorage.inGracePeriod,
    });
  } catch (error: any) {
    console.error('Failed to fetch storage status:', error);
    return NextResponse.json(
      { error: 'Failed to fetch storage status', details: error.message, stack: error.stack },
      { status: 500 }
    );
  }
}
