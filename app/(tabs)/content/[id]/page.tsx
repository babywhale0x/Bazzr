'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useCurrentAccount, useSignAndExecuteTransaction } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { Heart, Share2, Download, Eye, Clock, Shield, Loader2, Lock, Music, Video, FileText, Crown, Award, Check } from 'lucide-react';
import { formatSui, getTierName, TIER_STREAM, TIER_CITE, TIER_LICENSE, TIER_COMMERCIAL } from '@/lib/sui';
import CertificateModal from '@/components/CertificateModal';
import toast from 'react-hot-toast';

interface ContentDetail {
  contentId: string;
  creator: string;
  title: string;
  description: string;
  contentType: string;
  previewUrl?: string;
  previewContentType?: string;
  walrusBlobId?: string;
  streamPrice: string;
  citePrice: string;
  licensePrice: string;
  commercialPrice: string;
  tags: string[];
  uploadTimestamp: string;
}

export default function ContentDetailPage() {
  const params = useParams();
  const account = useCurrentAccount();
  const connected = !!account;
  const { mutateAsync: signAndExecuteTransaction } = useSignAndExecuteTransaction();
  const [content, setContent] = useState<ContentDetail | null>(null);
  const [hasAccess, setHasAccess] = useState(false);
  const [canDownload, setCanDownload] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isCheckingAccess, setIsCheckingAccess] = useState(true);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [selectedTier, setSelectedTier] = useState<number | null>(null);
  const [userHighestTier, setUserHighestTier] = useState<number>(0);
  const [purchaseRecord, setPurchaseRecord] = useState<any>(null);
  const [showCertModal, setShowCertModal] = useState(false);
  const [isImageFullScreen, setIsImageFullScreen] = useState(false);
  const [mediaUrl, setMediaUrl] = useState<string>('');

  // Load content details
  useEffect(() => {
    if (!params.id) return;

    const fetchContentDetail = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/content/${params.id}`);
        if (res.ok) {
          const data = await res.json();
          setContent(data);
        } else {
          setContent(null);
        }
      } catch (error) {
        console.error('Failed to fetch content:', error);
        toast.error('Failed to load content');
      } finally {
        setIsLoading(false);
      }
    };

    fetchContentDetail();
  }, [params.id]);

  const checkAccess = async (currentContent: ContentDetail | null) => {
    if (!account?.address || !params.id) {
      setHasAccess(false);
      setCanDownload(false);
      setUserHighestTier(0);
      setPurchaseRecord(null);
      setIsCheckingAccess(false);
      return;
    }

    setIsCheckingAccess(true);
    try {
      const accessRes = await fetch(`/api/content/${params.id}/access?wallet=${account.address}`);
      if (accessRes.ok) {
        const accessData = await accessRes.json();
        setHasAccess(accessData.hasAccess);
        setCanDownload(accessData.canDownload);
        const highestTier = accessData.tier || 0;
        setUserHighestTier(highestTier);
        if (accessData.purchase) {
          setPurchaseRecord({
            ...accessData.purchase,
            content: {
              title: currentContent?.title || '',
              walrusBlobId: currentContent?.walrusBlobId || ''
            }
          });
        } else {
          setPurchaseRecord(null);
        }
      }
    } catch (e) {
      console.error('Failed to check access:', e);
    } finally {
      setIsCheckingAccess(false);
    }
  };

  // Load / check access status when content or account changes
  useEffect(() => {
    let isMounted = true;

    const runCheck = async () => {
      if (!account?.address) {
        // Wait 500ms for wallet auto-connection logic to initialize
        await new Promise((resolve) => setTimeout(resolve, 500));
        if (!isMounted) return;

        if (!account?.address) {
          setHasAccess(false);
          setCanDownload(false);
          setUserHighestTier(0);
          setPurchaseRecord(null);
          setIsCheckingAccess(false);
          return;
        }
      }

      await checkAccess(content);
    };

    runCheck();

    return () => {
      isMounted = false;
    };
  }, [params.id, account?.address, content?.contentId]);

  // Set dynamic media URL
  useEffect(() => {
    if (!content) {
      setMediaUrl('');
      return;
    }
    if (hasAccess && content.walrusBlobId) {
      setMediaUrl(`/api/download/${content.walrusBlobId}?wallet=${account?.address?.toString()}`);
    } else {
      setMediaUrl(content.previewUrl || '');
    }
  }, [content, hasAccess, account?.address]);

  const handleMediaError = () => {
    if (hasAccess && content?.walrusBlobId && content?.previewUrl && mediaUrl !== content.previewUrl) {
      setMediaUrl(content.previewUrl);
      toast.error('Failed to load full content from Walrus storage. Showing preview fallback.');
    }
  };

  const handlePurchase = async (tier: number) => {
    if (!connected || !account) {
      toast.error('Please connect your wallet');
      return;
    }

    if (!content) return;

    setIsPurchasing(true);
    setSelectedTier(tier);

    try {
      // Price maps for DB recording and payment splitting
      const priceMap: Record<number, number> = {
        1: Number(content.streamPrice),
        2: Number(content.citePrice),
        3: Number(content.licensePrice),
        4: Number(content.commercialPrice)
      };

      const tx = new Transaction();
      const [coin] = tx.splitCoins(tx.gas, [priceMap[tier] || 0]);
      
      tx.moveCall({
        target: `${process.env.NEXT_PUBLIC_VERIXA_PACKAGE_ID}::verixa::purchase_access`,
        arguments: [
          tx.object(process.env.NEXT_PUBLIC_VERIXA_SHARED_STATE_ID!),
          tx.object('0x6'), // Sui System Clock
          tx.pure.u64(content.contentId),
          tx.pure.u8(tier),
          coin // Payment coin
        ]
      });
      
      // Must transfer the remaining coin object (even if 0 balance) to the user
      tx.transferObjects([coin], account.address);
      const result = await signAndExecuteTransaction({ transaction: tx });

      // 1. Sync the permanent certificate with our backend 
      try {
        const certRes = await fetch('/api/purchase/certify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            txHash: result.digest,
            tier: tier,
            contentId: content.contentId,
            buyerAddress: account.address.toString(),
            amount: priceMap[tier] || 0
          })
        });
        
        if (!certRes.ok) {
          const errData = await certRes.json();
          throw new Error(errData.error || 'Failed to generate certificate');
        }
        toast.success('Purchase successful! Certificate generated.');
      } catch (err: any) {
        console.error("Failed to sync certificate implicitly: ", err);
        toast.error(`Transaction confirmed, but certificate failed: ${err.message}. Please refresh.`);
      }

      // Re-fetch to update access dynamically
      setTimeout(() => checkAccess(content), 2000);
    } catch (error: any) {
      console.error('Purchase failed:', error);
      const msg = error?.message || 'Unknown error';
      if (msg.includes('Rejected')) {
        toast.error('Transaction was rejected by wallet');
      } else if (msg.includes('InsufficientBalance') || msg.includes('insufficient')) {
        toast.error('Insufficient SUI balance for this purchase');
      } else if (msg.includes('EContentNotFound')) {
        toast.error('Content not found on-chain. It may not be published yet.');
      } else {
        toast.error(`Purchase failed: ${msg.slice(0, 120)}`);
      }
    } finally {
      setIsPurchasing(false);
      setSelectedTier(null);
    }
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const formatDate = (timestamp: string) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (!content) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-medium mb-2">Content Not Found</h2>
          <p className="text-text-secondary">The content you're looking for doesn't exist.</p>
        </div>
      </div>
    );
  }

  const streamPrice = Number(content.streamPrice);
  const citePrice = Number(content.citePrice);
  const licensePrice = Number(content.licensePrice);
  const commercialPrice = Number(content.commercialPrice);

  return (
    <div className="min-h-screen bg-bg">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: Preview */}
          <div className="lg:col-span-2">
            <div className="card overflow-hidden mb-6">
              <div className="relative aspect-video bg-surface flex items-center justify-center overflow-hidden">
                {mediaUrl ? (
                  content.contentType.startsWith('audio/') ? (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-4 p-6 bg-surface">
                      <Music className="w-16 h-16 text-purple-300" />
                      <audio 
                        src={mediaUrl} 
                        controls 
                        className="w-full max-w-sm" 
                        onError={handleMediaError}
                      />
                    </div>
                  ) : (content.contentType.startsWith('video/') && (hasAccess || (content.previewContentType && !content.previewContentType.startsWith('image/')))) ? (
                    <video 
                      src={mediaUrl} 
                      poster={content.previewUrl}
                      className="w-full h-full object-cover" 
                      controls 
                      onError={handleMediaError}
                    />
                  ) : (
                    <img 
                      src={mediaUrl} 
                      alt={content.title} 
                      className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity" 
                      onClick={() => setIsImageFullScreen(true)}
                      title="Click to view full screen"
                      onError={handleMediaError}
                    />
                  )
                ) : content.contentType.startsWith('audio/') ? (
                  <div className="flex flex-col items-center gap-3 text-white">
                    <Music className="w-16 h-16 text-purple-300" />
                    <span className="text-purple-300 text-sm">Audio content</span>
                  </div>
                ) : content.contentType.startsWith('video/') ? (
                  <div className="flex flex-col items-center gap-3 text-white">
                    <Video className="w-16 h-16 text-text-muted" />
                    <span className="text-text-muted text-sm">Video content</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3 text-white">
                    <FileText className="w-16 h-16 text-gray-300" />
                    <span className="text-gray-300 text-sm">Document</span>
                  </div>
                )}

                {/* Lock overlay for non-purchasers */}
                {!hasAccess && !isCheckingAccess && (
                  <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center gap-2 backdrop-blur-sm">
                    <div className="bg-surface/10 border border-white/20 rounded-xl px-6 py-4 text-center">
                      <Lock className="w-8 h-8 text-white mx-auto mb-2" />
                      <p className="text-white font-medium text-sm">Purchase to unlock full content</p>
                      {content.previewUrl && (
                        <p className="text-white/70 text-xs mt-1">↑ Preview only</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Loading overlay while checking access */}
                {isCheckingAccess && (
                  <div className="absolute inset-0 bg-black/20 flex flex-col items-center justify-center backdrop-blur-sm">
                    <Loader2 className="w-8 h-8 animate-spin text-white" />
                  </div>
                )}
              </div>
            </div>

            {/* Content Info */}
            <div className="card p-6 mb-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h1 className="text-3xl font-medium mb-2">{content.title}</h1>
                  <div className="flex items-center gap-4 text-sm text-text-secondary">
                    <span>By {formatAddress(content.creator)}</span>
                    <span>•</span>
                    <span>{formatDate(content.uploadTimestamp)}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button className="p-2 hover:bg-bg rounded-lg">
                    <Heart className="w-5 h-5" />
                  </button>
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(window.location.href);
                      toast.success('Link copied to clipboard!');
                    }}
                    className="p-2 hover:bg-bg rounded-lg"
                    title="Share this content"
                  >
                    <Share2 className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <p className="text-primary mb-4">{content.description}</p>

              <div className="flex flex-wrap gap-2">
                {content.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-3 py-1 bg-primary-light text-text-secondary rounded-full text-sm"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            </div>

            {/* Creator Info */}
            <div className="card p-6">
              <h3 className="font-medium mb-4">About the Creator</h3>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-surface   rounded-full" />
                <div>
                  <p className="font-medium">{formatAddress(content.creator)}</p>
                  <p className="text-sm text-text-secondary">Creator</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Purchase Options */}
          <div>
            <div className="card p-6 sticky top-24">
              <h3 className="font-medium mb-4">Access Options</h3>

              {isCheckingAccess ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3 text-text-secondary">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  <p className="text-sm font-medium">Checking access status...</p>
                </div>
              ) : (
                <>
                  {hasAccess && (
                    <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 rounded-lg text-sm mb-4 space-y-3">
                      <div className="flex items-center gap-2 font-medium">
                        <Shield className="w-5 h-5 text-emerald-500" />
                        <span>Access Active</span>
                      </div>
                      <p className="text-xs text-emerald-600/80">
                        {canDownload 
                          ? "You have full download and certificate access for this content." 
                          : "You have stream/citation access for this content."}
                      </p>
                      
                      {purchaseRecord && userHighestTier >= 2 && (
                        <button
                          onClick={() => setShowCertModal(true)}
                          className="w-full py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
                        >
                          <Award className="w-3.5 h-3.5" />
                          View Certificate
                        </button>
                      )}

                      {canDownload && (
                        <button
                          onClick={async () => {
                            const blobId = content.walrusBlobId;
                            if (!blobId) return toast.error('File not found');
                            try {
                              toast.loading('Downloading...', { id: 'download' });
                              const res = await fetch(`/api/download/${blobId}?wallet=${account?.address?.toString()}`);
                              if (res.ok) {
                                const blob = await res.blob();
                                const url = window.URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.style.display = 'none';
                                a.href = url;
                                a.download = content.title;
                                document.body.appendChild(a);
                                a.click();
                                document.body.removeChild(a);
                                window.URL.revokeObjectURL(url);
                                toast.success('Download complete!', { id: 'download' });
                              } else {
                                toast.error('Failed to download', { id: 'download' });
                              }
                            } catch (e) {
                              toast.error('Download error', { id: 'download' });
                            }
                          }}
                          className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
                        >
                          <Download className="w-3.5 h-3.5" />
                          Download Content File
                        </button>
                      )}
                    </div>
                  )}

                  <div className="space-y-3">
                    {/* Stream Tier */}
                    {streamPrice > 0 && (
                      <button
                        onClick={() => handlePurchase(1)}
                        disabled={isPurchasing || userHighestTier >= 1}
                        className={`w-full p-4 border-2 rounded-lg text-left transition-colors ${
                          userHighestTier >= 1
                            ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-700 cursor-not-allowed'
                            : 'border-border hover:border-primary'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Eye className={`w-5 h-5 ${userHighestTier >= 1 ? 'text-emerald-500' : 'text-primary'}`} />
                            <div>
                              <p className="font-medium">Stream (In-App)</p>
                              <p className="text-sm text-text-secondary">Full access in-app, no download</p>
                            </div>
                          </div>
                          <span className="font-medium text-sm flex items-center gap-1">
                            {userHighestTier >= 1 ? (
                              <><Check className="w-4 h-4 text-emerald-500" /> Active</>
                            ) : isPurchasing && selectedTier === 1 ? (
                              <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                              formatSui(streamPrice)
                            )}
                          </span>
                        </div>
                      </button>
                    )}

                    {/* Cite Tier */}
                    {citePrice > 0 && (
                      <button
                        onClick={() => handlePurchase(2)}
                        disabled={isPurchasing || userHighestTier >= 2}
                        className={`w-full p-4 border-2 rounded-lg text-left transition-colors ${
                          userHighestTier >= 2
                            ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-700 cursor-not-allowed'
                            : 'border-border hover:border-primary'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <FileText className={`w-5 h-5 ${userHighestTier >= 2 ? 'text-emerald-500' : 'text-purple-500'}`} />
                            <div>
                              <p className="font-medium">Cite</p>
                              <p className="text-sm text-text-secondary">On-chain citation certificate + access</p>
                            </div>
                          </div>
                          <span className="font-medium text-sm flex items-center gap-1">
                            {userHighestTier >= 2 ? (
                              <><Check className="w-4 h-4 text-emerald-500" /> Active</>
                            ) : isPurchasing && selectedTier === 2 ? (
                              <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                              formatSui(citePrice)
                            )}
                          </span>
                        </div>
                      </button>
                    )}

                    {/* License Tier */}
                    {licensePrice > 0 && (
                      <button
                        onClick={() => handlePurchase(3)}
                        disabled={isPurchasing || userHighestTier >= 3}
                        className={`w-full p-4 border-2 rounded-lg text-left transition-colors ${
                          userHighestTier >= 3
                            ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-700 cursor-not-allowed'
                            : 'border-border hover:border-primary'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Download className={`w-5 h-5 ${userHighestTier >= 3 ? 'text-emerald-500' : 'text-green-500'}`} />
                            <div>
                              <p className="font-medium">License</p>
                              <p className="text-sm text-text-secondary">Download + private use rights + certificate</p>
                            </div>
                          </div>
                          <span className="font-medium text-sm flex items-center gap-1">
                            {userHighestTier >= 3 ? (
                              <><Check className="w-4 h-4 text-emerald-500" /> Active</>
                            ) : isPurchasing && selectedTier === 3 ? (
                              <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                              formatSui(licensePrice)
                            )}
                          </span>
                        </div>
                      </button>
                    )}

                    {/* Commercial Tier */}
                    {commercialPrice > 0 && (
                      <button
                        onClick={() => handlePurchase(4)}
                        disabled={isPurchasing || userHighestTier >= 4}
                        className={`w-full p-4 border-2 rounded-lg text-left transition-colors ${
                          userHighestTier >= 4
                            ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-700 cursor-not-allowed'
                            : 'border-border hover:border-primary'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Crown className={`w-5 h-5 ${userHighestTier >= 4 ? 'text-emerald-500' : 'text-text-muted'}`} />
                            <div>
                              <p className="font-medium">Commercial</p>
                              <p className="text-sm text-text-secondary">Download + full commercial rights + certificate</p>
                            </div>
                          </div>
                          <span className="font-medium text-sm flex items-center gap-1">
                            {userHighestTier >= 4 ? (
                              <><Check className="w-4 h-4 text-emerald-500" /> Active</>
                            ) : isPurchasing && selectedTier === 4 ? (
                              <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                              formatSui(commercialPrice)
                            )}
                          </span>
                        </div>
                      </button>
                    )}

                    <p className="text-sm text-text-secondary text-center mt-4">
                      90% goes to creator • 10% platform fee
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
      <CertificateModal 
        isOpen={showCertModal}
        onClose={() => setShowCertModal(false)}
        purchase={purchaseRecord}
      />
      {isImageFullScreen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm cursor-zoom-out"
          onClick={() => setIsImageFullScreen(false)}
        >
          <img 
            src={mediaUrl} 
            alt={content.title} 
            className="max-w-[95vw] max-h-[95vh] object-contain transition-transform" 
            onError={handleMediaError}
          />
          <button 
            className="absolute top-6 right-6 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white text-xs font-medium"
            onClick={(e) => {
              e.stopPropagation();
              setIsImageFullScreen(false);
            }}
          >
            Close Fullscreen
          </button>
        </div>
      )}
    </div>
  );
}
