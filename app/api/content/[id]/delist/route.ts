import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// PATCH to toggle isPublished status (Delist / Re-list)
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { walletAddress: rawWallet, isPublished } = await request.json();
    const { id } = params;

    if (!rawWallet || typeof isPublished !== 'boolean') {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const walletAddress = rawWallet.toLowerCase();

    const user = await prisma.user.findUnique({ where: { walletAddress } });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Verify ownership
    const file = await prisma.file.findUnique({
      where: { id },
      select: { userId: true },
    });

    if (!file || file.userId !== user.id) {
      return NextResponse.json({ error: 'Unauthorized or file not found' }, { status: 403 });
    }

    // Update visibility (soft delist)
    const updatedFile = await prisma.file.update({
      where: { id },
      data: { isPublished },
    });

    return NextResponse.json({ success: true, file: updatedFile });
  } catch (error) {
    console.error('Delist error:', error);
    return NextResponse.json({ error: 'Failed to update content status' }, { status: 500 });
  }
}
