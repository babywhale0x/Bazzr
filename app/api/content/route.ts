import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// GET /api/content — list published marketplace content
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const type = searchParams.get('type') || '';       // 'image', 'audio', 'video', 'document'
    const category = searchParams.get('category') || '';
    const sort = searchParams.get('sort') || 'newest';
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build where clause
    const where: any = {};

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { tags: { has: search.toLowerCase() } },
      ];
    }

    if (type) {
      const typeMap: Record<string, string> = {
        image: 'image/',
        audio: 'audio/',
        video: 'video/',
        document: 'application/',
      };
      if (typeMap[type]) {
        where.contentType = { startsWith: typeMap[type] };
      }
    }

    if (category) {
      where.tags = { has: category };
    }

    // Sort
    let orderBy: any;
    switch (sort) {
      case 'price_asc':
        orderBy = { streamPrice: 'asc' };
        break;
      case 'price_desc':
        orderBy = { streamPrice: 'desc' };
        break;
      default:
        orderBy = { uploadTimestamp: 'desc' };
    }

    const [contents, total] = await Promise.all([
      prisma.content.findMany({
        where,
        orderBy,
        take: limit,
        skip: offset,
      }),
      prisma.content.count({ where }),
    ]);

    // Serialize BigInt values for JSON
    const serialized = contents.map((c) => ({
      contentId: c.id.toString(),
      creator: c.creatorAddress,
      title: c.title,
      description: c.description || '',
      contentType: c.contentType,
      previewUrl: c.previewCid || null,
      walrusBlobId: c.walrusBlobId,
      streamPrice: c.streamPrice.toString(),
      citePrice: c.citePrice.toString(),
      licensePrice: c.licensePrice.toString(),
      commercialPrice: c.commercialPrice.toString(),
      subscriptionPrice: c.subscriptionPrice.toString(),
      tags: c.tags,
      uploadTimestamp: c.uploadTimestamp.toISOString(),
    }));

    return NextResponse.json({ contents: serialized, total });
  } catch (error) {
    console.error('Failed to fetch content:', error);
    return NextResponse.json(
      { error: 'Failed to fetch content' },
      { status: 500 },
    );
  }
}
