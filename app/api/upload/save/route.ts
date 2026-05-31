import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      walletAddress: rawWallet,
      blobId,
      name,
      contentType,
      size,
      isPublic,
      description,
      previewUrl,
      // Encryption fields
      encrypted,
      encryptionKey,
      // Marketplace fields
      categories,
      tags,
      streamPrice,
      citePrice,
      licensePrice,
      commercialPrice,
      subscriptionPrice,
      onChainContentId,
      // Fee tracking
      storageFee,
    } = body;

    const walletAddress = rawWallet?.toLowerCase();

    let user = await prisma.user.findUnique({ where: { walletAddress } });
    if (!user) {
      user = await prisma.user.create({ data: { walletAddress } });
    }

    // Determine if this is a marketplace publish (has pricing)
    const isPublished = isPublic === true && (streamPrice != null || licensePrice != null || citePrice != null);

    // Build tag list from tags + categories
    const allTags: string[] = [
      ...(Array.isArray(tags) ? tags : []),
      ...(Array.isArray(categories) ? categories : []),
    ].filter(Boolean);

    await prisma.file.upsert({
      where: { blobId },
      create: {
        userId: user.id,
        blobId,
        size: BigInt(size),
        name,
        contentType,
        encrypted: encrypted || false,
        encryptionKey: encryptionKey || null,
        isPublic: isPublic || false,
        isPublished,
        storageFee: storageFee != null ? storageFee : null,
        contentId: onChainContentId ? BigInt(onChainContentId) : null,
        publishedAt: isPublished ? new Date() : null,
        description: description || null,
        previewUrl: previewUrl || null,
      },
      update: {
        isPublic: isPublic || false,
        isPublished,
        contentId: onChainContentId ? BigInt(onChainContentId) : undefined,
        publishedAt: isPublished ? new Date() : undefined,
        previewUrl: previewUrl || undefined,
      },
    });

    // If marketplace content, also upsert into Content table for browsing
    if (isPublished) {
      // Use the real on-chain content ID from the smart contract
      const contentId = onChainContentId ? BigInt(onChainContentId) : BigInt(Date.now());
      await prisma.content.upsert({
        where: { id: contentId },
        create: {
          id: contentId,
          creatorAddress: walletAddress,
          title: name,
          description: description || '',
          contentType,
          walrusBlobId: blobId,
          previewCid: previewUrl || null,
          streamPrice: BigInt(streamPrice || 0),
          citePrice: BigInt(citePrice || 0),
          licensePrice: BigInt(licensePrice || 0),
          commercialPrice: BigInt(commercialPrice || 0),
          subscriptionPrice: BigInt(subscriptionPrice || 0),
          tags: allTags,
          uploadTimestamp: new Date(),
        },
        update: {
          title: name,
          description: description || '',
          previewCid: previewUrl || undefined,
          tags: allTags,
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Save failed:', error);
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
  }
}