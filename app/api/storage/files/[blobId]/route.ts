import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { blobId: string } }
) {
  try {
    const user = await auth();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { blobId } = params;

    // Verify ownership
    const file = await prisma.file.findFirst({
      where: { blobId, userId: user.id },
    });

    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    // Delete from database
    await prisma.file.delete({
      where: { id: file.id },
    });

    // Update storage balance
    await prisma.storageBalance.update({
      where: { userId: user.id },
      data: {
        totalBytes: {
          decrement: file.size,
        },
      },
    });

    // Note: In production, also delete from Walrus storage

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete file:', error);
    return NextResponse.json(
      { error: 'Failed to delete file' },
      { status: 500 }
    );
  }
}
