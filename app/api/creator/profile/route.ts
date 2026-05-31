import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');

    if (!address) {
      return NextResponse.json(
        { error: 'Address required' },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { walletAddress: address },
      include: {
        creatorProfile: true,
        files: {
          where: { isPublished: true },
          orderBy: { publishedAt: 'desc' },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'Creator not found' }, { status: 404 });
    }

    return NextResponse.json({
      address: user.walletAddress,
      username: user.username,
      displayName: user.displayName,
      bio: user.bio,
      avatarUrl: user.avatarUrl,
      profile: user.creatorProfile,
      contents: user.files,
    });
  } catch (error) {
    console.error('Failed to get creator profile:', error);
    return NextResponse.json(
      { error: 'Failed to get creator profile' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await auth();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { displayName, bio, avatarUrl, subscriptionEnabled, subscriptionPrice } = body;

    await prisma.user.update({
      where: { id: user.id },
      data: { displayName, bio, avatarUrl },
    });

    await prisma.creatorProfile.upsert({
      where: { userId: user.id },
      update: { subscriptionEnabled, subscriptionPrice },
      create: {
        userId: user.id,
        subscriptionEnabled,
        subscriptionPrice,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to update creator profile:', error);
    return NextResponse.json(
      { error: 'Failed to update profile' },
      { status: 500 }
    );
  }
}
