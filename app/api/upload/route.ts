import { NextRequest, NextResponse } from 'next/server';
import { initiateUpload } from '@/lib/walrus';
import { prisma } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fileSize, contentType, encrypted = false, walletAddress: rawWallet } = body;

    if (!fileSize || !contentType) {
      return NextResponse.json(
        { error: 'Missing required fields: fileSize, contentType' },
        { status: 400 }
      );
    }

    if (!rawWallet) {
      return NextResponse.json(
        { error: 'Wallet address required' },
        { status: 401 }
      );
    }

    const walletAddress = rawWallet.toLowerCase();

    let user = await prisma.user.findUnique({ where: { walletAddress } });
    if (!user) {
      user = await prisma.user.create({ data: { walletAddress } });
    }

    const session = await initiateUpload(fileSize, contentType, encrypted);

    await prisma.pendingUpload.create({
      data: {
        userId: user.id,
        blobId: session.blobId,
        fileSize: BigInt(fileSize),
        contentType,
        encrypted,
        status: 'pending',
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      },
    });

    return NextResponse.json({
      blobId: session.blobId,
      uploadUrl: session.uploadUrl,
      rootHash: Array.from(session.rootHash),
    });
  } catch (error) {
    console.error('Upload initiation failed:', error);
    return NextResponse.json(
      { error: 'Failed to initiate upload' },
      { status: 500 }
    );
  }
}
