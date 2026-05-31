import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// GET /api/content/[id] — fetch a single content item
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const contentId = BigInt(params.id);

    const content = await prisma.content.findUnique({
      where: { id: contentId },
    });

    if (!content) {
      return NextResponse.json({ error: 'Content not found' }, { status: 404 });
    }

    return NextResponse.json({
      contentId: content.id.toString(),
      creator: content.creatorAddress,
      title: content.title,
      description: content.description || '',
      contentType: content.contentType,
      walrusBlobId: content.walrusBlobId,
      previewUrl: content.previewCid || null,
      streamPrice: content.streamPrice.toString(),
      citePrice: content.citePrice.toString(),
      licensePrice: content.licensePrice.toString(),
      commercialPrice: content.commercialPrice.toString(),
      subscriptionPrice: content.subscriptionPrice.toString(),
      tags: content.tags,
      uploadTimestamp: content.uploadTimestamp.toISOString(),
    });
  } catch (error) {
    console.error('Failed to fetch content:', error);
    return NextResponse.json(
      { error: 'Failed to fetch content' },
      { status: 500 },
    );
  }
}
