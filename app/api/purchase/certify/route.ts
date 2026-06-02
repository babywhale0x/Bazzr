import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { completeUpload } from '@/lib/walrus';
import { getTierName } from '@/lib/sui';

function generateCitation(title: string, creatorName: string, contentUrl: string): string {
  const year = new Date().getFullYear();
  return `${creatorName || 'Unknown Creator'}. (${year}). ${title}. Verixa. Retrieved from ${contentUrl}`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { txHash, tier, contentId, buyerAddress: rawBuyer, amount } = body;

    if (!txHash || tier === undefined || !contentId || !rawBuyer) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const buyerAddress = rawBuyer.toLowerCase();

    // 1. Verify or create user
    let user = await prisma.user.findUnique({
      where: { walletAddress: buyerAddress },
    });

    if (!user) {
      // Auto-create user for first-time buyers
      user = await prisma.user.create({
        data: {
          walletAddress: buyerAddress,
        }
      });
    }

    // 2. Fetch content details
    const content = await prisma.content.findUnique({
      where: { id: BigInt(contentId) },
    });

    if (!content) {
      return NextResponse.json({ error: 'Content not found' }, { status: 404 });
    }

    // 3. Removed on-chain wait to prevent Vercel 10s timeout aborting the DB save

    // 4. Generate Certificate JSON payload
    const tierName = getTierName(Number(tier));
    const isCiteTier = Number(tier) === 2 || Number(tier) === 3 || Number(tier) === 4; // Cite, License, Commercial
    
    // Construct the optional APA citation string
    let citation = null;
    if (isCiteTier) {
      const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://verixa.app';
      citation = generateCitation(content.title, content.creatorAddress, `${siteUrl}/content/${contentId}`);
    }

    const certificate = {
      platform: "Verixa Protocol",
      type: "Certificate of Authenticity",
      issuedAt: new Date().toISOString(),
      transactionHash: txHash,
      buyer: buyerAddress,
      creator: content.creatorAddress,
      contentId: contentId.toString(),
      contentTitle: content.title,
      tier: {
        level: Number(tier),
        name: tierName,
        rights: Number(tier) >= 3 ? "Download & Local Use" : "Streaming & On-chain Access"
      },
      citation: citation
    };

    // 5. Upload Certificate to Permanent storage (Walrus)
    const certString = JSON.stringify(certificate, null, 2);
    const certBuffer = Buffer.from(certString, 'utf-8');
    
    // Generate a unique ID for the certificate blob
    const certBlobId = `cert-${contentId}-${Date.now()}`;
    const certFileName = `certificate.json`;

    let walrusBlobId = '';
    
    // Create a 5 second timeout to prevent Vercel serverless function kills
    let timeoutId: NodeJS.Timeout;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error('Walrus upload timeout')), 5000);
    });

    try {
      const uploadTask = completeUpload(
        certBlobId,
        certBuffer,
        'application/json',
        certFileName
      );
      
      // Prevent unhandled rejection if it fails after timeout wins
      uploadTask.catch((err) => console.error('Background upload error:', err.message));

      const uploadResult = await Promise.race([
        uploadTask,
        timeoutPromise
      ]) as any;
      clearTimeout(timeoutId!);
      walrusBlobId = uploadResult.blobName; // This acts as our permanent receipt identifier
    } catch (uploadError) {
      clearTimeout(timeoutId!);
      console.error('Failed to upload certificate to Walrus:', uploadError);
      // Fallback: If permanent storage fails, we still record the purchase using the txHash
      walrusBlobId = `fallback-${txHash}`;
    }

    // 6. Save Purchase to Database with License Hash & Tx Hash
    // We use the Walrus Blob URL (or fallback) as the permanent licenseHash
    const purchase = await prisma.purchase.create({
      data: {
        userId: user.id,
        purchaseId: BigInt(Date.now()), // Unique internal ID
        contentId: BigInt(contentId),
        tier: Number(tier),
        amountPaid: amount || 0,
        purchaseTimestamp: new Date(),
        licenseHash: walrusBlobId, 
        transactionHash: txHash,
      },
    });

    return NextResponse.json({ 
      success: true, 
      certificateUrl: walrusBlobId,
      citation: citation
    });

  } catch (error: any) {
    console.error('Certification Error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
