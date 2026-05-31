import { NextRequest, NextResponse } from 'next/server';
import { completeUpload } from '@/lib/walrus';
import { prisma } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const metadataStr = formData.get('metadata') as string;

    if (!file || !metadataStr) {
      return NextResponse.json(
        { error: 'Missing file or metadata' },
        { status: 400 }
      );
    }

    const metadata = JSON.parse(metadataStr);
    const { walletAddress: rawWallet, blobId, name, contentType, isPublic, description } = metadata;

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

    const pendingUpload = await prisma.pendingUpload.findFirst({
      where: { userId: user.id, blobId, status: 'pending' },
    });

    if (!pendingUpload) {
      return NextResponse.json(
        { error: 'Invalid or expired upload session' },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const result = await completeUpload(blobId, buffer, file.type, file.name);

    await prisma.file.upsert({
      where: { blobId },
      create: {
        userId: user.id,
        blobId,
        rootHash: Buffer.from(result.rootHash),
        size: BigInt(result.size),
        name: name || file.name,
        contentType: contentType || file.type,
        encrypted: false,
        isPublic: isPublic || false,
        description: description || null,
      },
      update: { isPublic: isPublic || false },
    });

    await prisma.pendingUpload.update({
      where: { id: pendingUpload.id },
      data: { status: 'completed' },
    });

    return NextResponse.json({
      success: true,
      blobId,
      rootHash: Array.from(result.rootHash),
      size: result.size,
    });
  } catch (error) {
    console.error('Upload completion failed:', error);
    return NextResponse.json(
      { error: 'Failed to complete upload' },
      { status: 500 }
    );
  }
}
