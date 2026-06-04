'use client';

import { useState, useCallback } from 'react';
import { useCurrentAccount, useSignAndExecuteTransaction, useSuiClient } from '@mysten/dapp-kit';
import { useDropzone } from 'react-dropzone';
import { Upload, Image, Video, Music, FileText, Loader2, Star,
  Tag, Eye, Download, Crown, X, Check, Lock, Droplets, ArrowLeft, Link as LinkIcon
} from 'lucide-react';
import { suiToMist, TIER_STREAM, TIER_CITE, TIER_LICENSE, TIER_COMMERCIAL, TIER_SUBSCRIPTION } from '@/lib/sui';
import { Transaction } from '@mysten/sui/transactions';
import toast from 'react-hot-toast';

type ImagePreviewMode = 'blur' | 'watermark';

interface PricingTier {
  enabled: boolean;
  price: number;
}

const CATEGORIES = [
  { id: 'art', label: 'Art', emoji: '🎨' },
  { id: 'photography', label: 'Photography', emoji: '📸' },
  { id: 'music', label: 'Music', emoji: '🎵' },
  { id: 'video', label: 'Video', emoji: '🎬' },
  { id: 'document', label: 'Document', emoji: '📄' },
  { id: 'research', label: 'Research', emoji: '🔬' },
  { id: 'nft', label: 'NFT', emoji: '💎' },
  { id: 'design', label: 'Design', emoji: '✏️' },
  { id: 'writing', label: 'Writing', emoji: '📝' },
  { id: 'journalism', label: 'Journalism', emoji: '📰' },
  { id: 'education', label: 'Education', emoji: '📚' },
  { id: 'other', label: 'Other', emoji: '📦' },
];

const getFileTypeIcon = (type: string, size = 'md') => {
  const cls = size === 'sm' ? 'w-5 h-5' : 'w-10 h-10';
  if (type.startsWith('image/')) return <Image className={`${cls}`} style={{ color: 'var(--color-primary)' }} />;
  if (type.startsWith('video/')) return <Video className={`${cls}`} style={{ color: 'var(--color-text-secondary)' }} />;
  if (type.startsWith('audio/')) return <Music className={`${cls}`} style={{ color: 'var(--color-text-secondary)' }} />;
  return <FileText className={`${cls}`} style={{ color: 'var(--color-text-secondary)' }} />;
};

export default function CreatePage() {
  const account = useCurrentAccount();
  const connected = !!account;
  const { mutateAsync: signAndExecuteTransaction } = useSignAndExecuteTransaction();
  const suiClient = useSuiClient();

  // Staging state
  const [stagedFiles, setStagedFiles] = useState<File[]>([]);
  const [baseTitle, setBaseTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [imagePreviewMode, setImagePreviewMode] = useState<ImagePreviewMode>('blur');
  const [previewFile, setPreviewFile] = useState<File | null>(null);

  // Per-file generated previews: indexed by file index
  const [generatedPreviews, setGeneratedPreviews] = useState<Record<number, string>>({});
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);

  // Publish state
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishProgress, setPublishProgress] = useState<{ current: number; total: number } | null>(null);

  // Recent creations state
  const [recentCreations, setRecentCreations] = useState<any[]>([]);
  const [isLoadingRecent, setIsLoadingRecent] = useState(false);

  // Fetch recent creations
  const fetchRecentCreations = useCallback(async () => {
    if (!account) return;
    setIsLoadingRecent(true);
    try {
      const res = await fetch(`/api/profile/content?walletAddress=${account.address.toString()}`);
      if (res.ok) {
        const data = await res.json();
        const publishedFiles = data.files ? data.files.filter((f: any) => f.isPublished) : [];
        setRecentCreations(publishedFiles.slice(0, 4));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingRecent(false);
    }
  }, [account]);

  // Load on mount
  require('react').useEffect(() => {
    if (connected && account) fetchRecentCreations();
  }, [connected, account, fetchRecentCreations]);

  const [tiers, setTiers] = useState<Record<number, PricingTier>>({
    [TIER_STREAM]: { enabled: true, price: 0.001 },
    [TIER_CITE]: { enabled: false, price: 0.005 },
    [TIER_LICENSE]: { enabled: true, price: 0.01 },
    [TIER_COMMERCIAL]: { enabled: false, price: 0.05 },
    [TIER_SUBSCRIPTION]: { enabled: false, price: 0.02 },
  });

  const toggleCategory = (categoryId: string) => {
    setSelectedCategories(prev => {
      if (prev.includes(categoryId)) return prev.filter(c => c !== categoryId);
      if (prev.length >= 3) { toast.error('Maximum 3 categories allowed'); return prev; }
      return [...prev, categoryId];
    });
  };

  const generateImagePreview = useCallback(async (file: File, mode: ImagePreviewMode): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX = 800;
        const scale = Math.min(1, MAX / Math.max(img.width, img.height));
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext('2d')!;
        if (mode === 'blur') ctx.filter = 'blur(18px)';
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        ctx.filter = 'none';
        const fontSize = Math.max(16, canvas.width / 18);
        ctx.font = `bold ${fontSize}px Inter, sans-serif`;
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.textAlign = 'center';
        ctx.shadowColor = 'rgba(0,0,0,0.6)';
        ctx.shadowBlur = 8;
        ctx.fillText('🔒 Verixa', canvas.width / 2, canvas.height / 2);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  }, []);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;
    setStagedFiles(acceptedFiles);
    setBaseTitle('');
    setPreviewFile(null);
    setGeneratedPreviews({});

    // Auto-generate previews for image files
    const imageFiles = acceptedFiles.filter(f => f.type.startsWith('image/'));
    if (imageFiles.length > 0) {
      setIsGeneratingPreview(true);
      const previews: Record<number, string> = {};
      for (let i = 0; i < acceptedFiles.length; i++) {
        if (acceptedFiles[i].type.startsWith('image/')) {
          try {
            previews[i] = await generateImagePreview(acceptedFiles[i], imagePreviewMode);
          } catch (e) {
            console.error('Preview generation failed for', acceptedFiles[i].name);
          }
        }
      }
      setGeneratedPreviews(previews);
      setIsGeneratingPreview(false);
    }
  }, [imagePreviewMode, generateImagePreview]);

  const handlePreviewModeChange = useCallback(async (mode: ImagePreviewMode) => {
    setImagePreviewMode(mode);
    if (stagedFiles.length === 0) return;
    setIsGeneratingPreview(true);
    const previews: Record<number, string> = {};
    for (let i = 0; i < stagedFiles.length; i++) {
      if (stagedFiles[i].type.startsWith('image/')) {
        try {
          previews[i] = await generateImagePreview(stagedFiles[i], mode);
        } catch (e) { /* skip */ }
      }
    }
    setGeneratedPreviews(previews);
    setIsGeneratingPreview(false);
  }, [stagedFiles, generateImagePreview]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxSize: 1024 * 1024 * 500,
    multiple: true,
  });

  const handleTierChange = (tier: number, field: 'enabled' | 'price', value: boolean | number) => {
    setTiers(prev => ({ ...prev, [tier]: { ...prev[tier], [field]: value } }));
  };

  const resetAll = () => {
    setStagedFiles([]);
    setBaseTitle('');
    setDescription('');
    setTags('');
    setSelectedCategories([]);
    setPreviewFile(null);
    setGeneratedPreviews({});
    setPublishProgress(null);
  };

  const handlePublish = async () => {
    if (!connected || !account) { toast.error('Please connect your wallet'); return; }
    if (stagedFiles.length === 0) { toast.error('Please select at least one file'); return; }
    if (!baseTitle.trim()) { toast.error('Please enter a title for your content'); return; }
    if (selectedCategories.length === 0) { toast.error('Please select at least one category'); return; }

    setIsPublishing(true);
    setPublishProgress({ current: 0, total: stagedFiles.length });

    try {
      const safeBase = baseTitle.trim().toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
      const tagList = [...tags.split(',').map(t => t.trim()).filter(Boolean), ...selectedCategories];
      
      const hasOnlyImages = stagedFiles.every(f => f.type.startsWith('image/'));
      const streamPrice = (!hasOnlyImages && tiers[TIER_STREAM].enabled) ? suiToMist(tiers[TIER_STREAM].price || 0) : 0;
      
      const citePrice = tiers[TIER_CITE].enabled ? suiToMist(tiers[TIER_CITE].price || 0) : 0;
      const licensePrice = tiers[TIER_LICENSE].enabled ? suiToMist(tiers[TIER_LICENSE].price || 0) : 0;
      const commercialPrice = tiers[TIER_COMMERCIAL].enabled ? suiToMist(tiers[TIER_COMMERCIAL].price || 0) : 0;
      const subscriptionPrice = tiers[TIER_SUBSCRIPTION].enabled ? suiToMist(tiers[TIER_SUBSCRIPTION].price || 0) : 0;

      // Track the total on-chain items for this creator to ensure we capture the distinct new additions
      const { getCreatorContents } = await import('@/lib/contract-queries');
      let previousContentIds = await getCreatorContents(account.address.toString());
      let successfulUploads = 0;

      for (let i = 0; i < stagedFiles.length; i++) {
        const file = stagedFiles[i];
        const finalTitle = stagedFiles.length === 1 ? baseTitle.trim() : `${baseTitle.trim()} ${i + 1}`;
        const blobName = `verixa-${Date.now()}-${safeBase}${stagedFiles.length > 1 ? `-${i + 1}` : ''}`;

        setPublishProgress({ current: i + 1, total: stagedFiles.length });
        toast.loading(`Publishing ${finalTitle} (${i + 1}/${stagedFiles.length})…`, { id: 'upload' });

        try {
          
          // Step 1: Encrypt the file before upload
          const { generateEncryptionKey, encryptData } = await import('@/lib/encryption');
          const encKey = await generateEncryptionKey();
          const rawData = new Uint8Array(await file.arrayBuffer());
          const encryptedData = await encryptData(rawData, encKey);

          // Step 2 & 3 & 4: Upload ENCRYPTED data via Server-Side Proxy (bypasses CORS)
          let uploadSuccess = false;
          let uploadRetries = 0;
          let walrusBlobId = '';
          
          while (!uploadSuccess && uploadRetries < 3) {
            try {
              const response = await fetch(`/api/upload/proxy?epochs=5`, {
                method: 'PUT',
                body: encryptedData as any, // Pass raw Uint8Array directly
              });
              if (!response.ok) throw new Error(`Walrus proxy HTTP error: ${response.status}`);
              const result = await response.json();
              walrusBlobId = result.newlyCreated ? result.newlyCreated.blobObject.blobId : result.alreadyCertified.blobId;
              uploadSuccess = true;
            } catch (err: any) {
              uploadRetries++;
              console.warn(`Walrus upload attempt ${uploadRetries} failed via proxy:`, err);
              if (uploadRetries >= 3) {
                throw new Error(`Walrus upload failed after 3 attempts.`);
              }
              await new Promise(r => setTimeout(r, 2000));
            }
          }

          // Handle preview (previews are NOT encrypted — they are the blurred/watermarked version)
          let previewUrl: string | null = null;
          if (file.type.startsWith('image/') && generatedPreviews[i]) {
            previewUrl = generatedPreviews[i];
            await fetch('/api/upload/preview', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                walletAddress: account.address.toString(),
                blobId: walrusBlobId,
                previewDataUrl: generatedPreviews[i],
              }),
            });
          } else if (previewFile && i === 0) {
            // Preview clip only applies to the first file in a batch for audio/video/docs
            // Upload preview to Walrus via proxy (same as main upload, but unencrypted)
            const previewBytes = new Uint8Array(await previewFile.arrayBuffer());
            const previewUploadRes = await fetch('/api/upload/proxy?epochs=5', {
              method: 'PUT',
              body: previewBytes as any,
            });
            if (previewUploadRes.ok) {
              const previewResult = await previewUploadRes.json();
              const previewBlobId = previewResult.newlyCreated
                ? previewResult.newlyCreated.blobObject.blobId
                : previewResult.alreadyCertified.blobId;
              previewUrl = `https://aggregator.walrus-testnet.walrus.space/v1/blobs/${previewBlobId}`;
            }
          }

          // Publish to marketplace FIRST to get the on-chain content ID
          const rootBytes = Array.from(new Uint8Array(32)); // Dummy hash for Walrus
          
          let onChainPreviewId = '';
          if (previewUrl) {
            const parts = previewUrl.split('/');
            onChainPreviewId = parts[parts.length - 1] || '';
          }

          const tx = new Transaction();
          tx.moveCall({
            target: `${process.env.NEXT_PUBLIC_VERIXA_PACKAGE_ID}::verixa::publish_content`,
            arguments: [
               tx.object(process.env.NEXT_PUBLIC_VERIXA_SHARED_STATE_ID!),
               tx.object('0x6'), // clock
               tx.pure.string(finalTitle),
               tx.pure.string(description),
               tx.pure.string(file.type),
               tx.pure.string(walrusBlobId),
               tx.pure.vector('u8', rootBytes),
               tx.pure.string(onChainPreviewId),
               tx.pure.u64(streamPrice),
               tx.pure.u64(citePrice),
               tx.pure.u64(licensePrice),
               tx.pure.u64(commercialPrice),
               tx.pure.u64(subscriptionPrice),
               tx.pure.vector('string', tagList),
               tx.pure.u64(0) // collection_id
            ]
          });
          const publishTx = await signAndExecuteTransaction({ transaction: tx });
          
          // Wait for the transaction and extract the content_id from the ContentPublished event
          const txResult = await suiClient.waitForTransaction({
            digest: publishTx.digest,
            options: { showEvents: true }
          });
          
          const publishEvent = txResult.events?.find(e => e.type.includes('ContentPublished'));
          const onChainContentId = publishEvent 
            ? (publishEvent.parsedJson as any).content_id.toString() 
            : Date.now().toString();

          // NOW save metadata + pricing + encryption key with the real on-chain content ID
          const saveRes = await fetch('/api/upload/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              walletAddress: account.address.toString(),
              blobId: walrusBlobId,
              name: finalTitle,
              contentType: file.type,
              size: file.size,
              isPublic: true,
              encrypted: true,
              encryptionKey: encKey,
              description,
              categories: selectedCategories,
              tags: tagList,
              previewUrl,
              previewContentType: previewFile ? previewFile.type : (file.type.startsWith('image/') && generatedPreviews[i] ? 'image/png' : null),
              streamPrice,
              citePrice,
              licensePrice,
              commercialPrice,
              subscriptionPrice,
              onChainContentId,
            }),
          });
          
          if (!saveRes.ok) {
            throw new Error('Database sync failed. The item is on-chain but metadata failed to save.');
          }

          toast.success(`Published: ${finalTitle}`, { id: 'upload' });
          successfulUploads++;
          
          // Final delay before the NEXT file in the loop starts, to reset wallet state completely
          if (i < stagedFiles.length - 1) {
            await new Promise(r => setTimeout(r, 2000));
          }
        } catch (err: any) {
          console.error(`Failed to publish ${finalTitle}:`, err);
          toast.error(`Failed: ${finalTitle} — ${err?.message || 'Unknown error'}`, { duration: 6000 });
        }
      }

      if (successfulUploads > 0) {
        toast.success(
          successfulUploads === 1 ? 'Content published!' : `${successfulUploads} items published!`,
          { id: 'upload' }
        );
      } else {
        toast.dismiss('upload');
      }
      
      fetchRecentCreations();
      resetAll();
    } catch (error: any) {
      console.error('Publish error:', error);
      toast.error(error?.message || 'Failed to publish content', { id: 'upload' });
    } finally {
      setIsPublishing(false);
      setPublishProgress(null);
    }
  };

  if (!connected) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="text-center">
          <Upload className="w-16 h-16 mx-auto text-text-muted mb-4" />
          <h2 className="text-2xl font-medium mb-2">Connect your wallet</h2>
          <p className="text-text-secondary">Connect your wallet to publish content</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg">
      <div className="max-w-[1440px] mx-auto px-8">
        
        {/* Page header — no divider, flows into content */}
        <div className="flex items-end justify-between pt-10 pb-8">
          <div>
            <p className="text-[11px] font-medium tracking-[0.08em] uppercase mb-1" style={{ color: 'var(--color-text-muted)' }}>Publish</p>
            <h1 className="text-[26px] font-medium tracking-tight" style={{ color: 'var(--color-text-primary)', letterSpacing: '-0.015em' }}>Create content</h1>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-8">

        {/* ─── STEP 1: Drop Zone (no files staged yet) ─── */}
        {stagedFiles.length === 0 && (
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-2xl p-16 text-center cursor-pointer transition-colors mb-8 ${
              isDragActive ? 'border-primary' : 'border-border hover:border-gray-400'
            }`}
          >
            <input {...getInputProps()} />
            <Upload className="w-14 h-14 mx-auto text-text-muted mb-4" />
            <p className="text-xl font-medium text-text-primary">
              {isDragActive ? 'Drop files here' : 'Drag & drop your files here'}
            </p>
            <p className="text-xs text-text-muted mt-1">Max 500 MB per file • Multiple files supported</p>
          </div>
        )}

        {/* ─── RECENT CREATIONS (Only visible when no files are staged) ─── */}
        {stagedFiles.length === 0 && connected && recentCreations.length > 0 && (
          <div className="mt-12">
            <h3 className="text-[15px] font-medium mb-4 flex items-center gap-2" style={{ color: 'var(--color-text-primary)' }}>
              Your recent creations
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              {recentCreations.map((file) => (
                <div key={file.id} className="card overflow-hidden flex flex-col">
                  <div className="h-28 relative flex items-center justify-center" style={{ background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}>
                    {file.previewUrl ? (
                      file.contentType.startsWith('image/')
                        ? <img src={file.previewUrl} className="w-full h-full object-cover" alt="preview" />
                        : getFileTypeIcon(file.contentType, 'sm')
                    ) : getFileTypeIcon(file.contentType, 'sm')}
                  </div>
                  <div className="p-3 bg-surface flex-1">
                    <h4 className="font-medium text-sm truncate mb-1">{file.name}</h4>
                    <p className="text-xs text-text-secondary">{new Date(file.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ─── STEP 2: Staging + Details (files selected) ─── */}
        {stagedFiles.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

            {/* Left column */}
            <div className="space-y-6">

              {/* Staged files list */}
              <div className="card p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-medium">
                    {stagedFiles.length === 1 ? '1 File Selected' : `${stagedFiles.length} Files Selected`}
                  </h2>
                  <button
                    onClick={resetAll}
                    className="flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary"
                  >
                    <ArrowLeft className="w-4 h-4" /> Change files
                  </button>
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {stagedFiles.map((f, i) => {
                    const finalName = baseTitle
                      ? (stagedFiles.length === 1 ? baseTitle : `${baseTitle} ${i + 1}`)
                      : null;
                    return (
                      <div key={i} className="flex items-center gap-3 p-3 bg-bg rounded-lg">
                        {getFileTypeIcon(f.type, 'sm')}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {finalName ?? <span className="text-text-muted italic">Awaiting title…</span>}
                          </p>
                          <p className="text-xs text-text-muted">{(f.size / 1024 / 1024).toFixed(2)} MB · {f.type}</p>
                        </div>
                        {generatedPreviews[i] && (
                          <img src={generatedPreviews[i]} alt="preview" className="w-10 h-10 rounded object-cover border border-border" />
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Drop more files */}
                <div
                  {...getRootProps()}
                  className="mt-3 border-dashed p-3 text-center cursor-pointer transition-colors" style={{ border: '1.5px dashed var(--color-border)', borderRadius: 'var(--radius-md)' }}
                >
                  <input {...getInputProps()} />
                  <p className="text-xs text-text-secondary">{isDragActive ? 'Drop here' : '+ Add more files'}</p>
                </div>
              </div>

              {/* Content Details */}
              <div className="card p-6">
                <h2 className="text-lg font-medium mb-4">Content Details</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-text-primary mb-1">
                      {stagedFiles.length === 1 ? 'Title *' : 'Base Title *'}
                    </label>
                    <input
                      type="text"
                      value={baseTitle}
                      onChange={e => setBaseTitle(e.target.value)}
                      className="input"
                      placeholder={stagedFiles.length === 1 ? 'Enter content title' : 'e.g. "Summer Collection" → Summer Collection 1, 2, 3…'}
                    />
                    {stagedFiles.length > 1 && (
                      <p className="text-xs text-text-secondary mt-1">
                        Files will be published as <strong>{baseTitle || 'Title'} 1</strong>, <strong>{baseTitle || 'Title'} 2</strong>…
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-primary mb-1">Description</label>
                    <textarea
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                      className="input"
                      rows={3}
                      placeholder="Describe your content"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-primary mb-1">Tags (comma separated)</label>
                    <div className="relative">
                      <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
                      <input
                        type="text"
                        value={tags}
                        onChange={e => setTags(e.target.value)}
                        className="input pl-10"
                        placeholder="summer, exclusive, rare"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Image preview mode — only when at least one image is staged */}
              {stagedFiles.some(f => f.type.startsWith('image/')) && (
                <div className="card p-5">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[13px] font-medium" style={{ color: 'var(--color-text-primary)' }}>Buyer preview style</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handlePreviewModeChange('blur')}
                        className={`btn btn-sm ${imagePreviewMode === 'blur' ? 'btn-primary' : 'btn-secondary'}`}
                      >
                        <Droplets className="w-3.5 h-3.5" /> Blur
                      </button>
                      <button
                        onClick={() => handlePreviewModeChange('watermark')}
                        className={`btn btn-sm ${imagePreviewMode === 'watermark' ? 'btn-primary' : 'btn-secondary'}`}
                      >
                        <Lock className="w-3.5 h-3.5" /> Watermark only
                      </button>
                    </div>
                  </div>

                  {isGeneratingPreview ? (
                    <div className="flex items-center gap-2 text-text-primary py-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm">Generating previews…</span>
                    </div>
                  ) : Object.keys(generatedPreviews).length > 0 ? (
                    <div className="flex gap-2 flex-wrap">
                      {Object.entries(generatedPreviews).map(([idx, url]) => (
                        <img key={idx} src={url} alt="preview" className="h-20 rounded-lg object-cover" style={{ border: '1px solid var(--color-border)' }} />
                      ))}
                    </div>
                  ) : null}
                </div>
              )}

              {/* Audio/Video/Doc preview clip upload */}
              {stagedFiles.some(f => f.type.startsWith('audio/') || f.type.startsWith('video/') || f.type.includes('pdf') || f.type.includes('document')) && (
                <div className="card p-4 space-y-2">
                  <p className="text-[13px] font-medium" style={{ color: 'var(--color-text-primary)' }}>Preview file — optional</p>
                  <p className="text-[13px]" style={{ color: 'var(--color-text-muted)' }}>Upload a short clip or preview image buyers can see before purchasing. Will apply to the first file in the batch.</p>
                  <label className="block">
                    <div className={`border-dashed p-4 text-center cursor-pointer transition-colors ${ previewFile ? 'border-primary' : '' }`} style={{ border: '1.5px dashed var(--color-border)', borderRadius: 'var(--radius-md)' }}>
                      <input
                        type="file"
                        className="hidden"
                        accept="audio/*,video/*,image/*"
                        onChange={e => { const f = e.target.files?.[0]; if (f) setPreviewFile(f); }}
                      />
                      {previewFile ? (
                        <div className="flex items-center justify-center gap-2" style={{ color: 'var(--color-text-secondary)' }}>
                          <Check className="w-4 h-4" />
                          <span className="text-sm font-medium">{previewFile.name}</span>
                          <button type="button" onClick={e => { e.preventDefault(); setPreviewFile(null); }} style={{ color: 'var(--color-error)' }}>
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-[13px]" style={{ color: 'var(--color-primary)' }}>Click to choose preview file</span>
                      )}
                    </div>
                  </label>
                </div>
              )}


              {/* Categories */}
              <div className="card p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-medium">Categories</h2>
                  <span className="text-sm text-text-secondary">{selectedCategories.length}/3 selected</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {CATEGORIES.map(cat => {
                    const isSelected = selectedCategories.includes(cat.id);
                    return (
                      <button
                        key={cat.id}
                        onClick={() => toggleCategory(cat.id)}
                        className={`relative flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all ${
                          isSelected ? 'border-primary' : 'border-border hover:border-border text-text-secondary'
                        }`}
                      >
                        {isSelected && (
                          <div className="absolute top-1 right-1 w-4 h-4 bg-primary rounded-full flex items-center justify-center">
                            <Check className="w-2.5 h-2.5 text-white" />
                          </div>
                        )}
                        <span className="text-xl">{cat.emoji}</span>
                        <span className="text-xs font-medium">{cat.label}</span>
                      </button>
                    );
                  })}
                </div>
                {selectedCategories.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {selectedCategories.map(id => {
                      const cat = CATEGORIES.find(c => c.id === id);
                      return cat ? (
                        <span key={id} className="flex items-center gap-1 px-2 py-1 bg-primary-light text-primary rounded-full text-xs font-medium">
                          {cat.emoji} {cat.label}
                          <button onClick={() => toggleCategory(id)}><X className="w-3 h-3" /></button>
                        </span>
                      ) : null;
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Right column: Pricing + Publish */}
            <div className="space-y-6">
              <div className="card p-6">
                <h2 className="text-lg font-medium mb-4">Pricing Tiers</h2>
                <div className="space-y-4">
                  {!stagedFiles.every(f => f.type.startsWith('image/')) && (
                    <div className="flex items-center gap-4 p-4 bg-bg rounded-lg">
                      <Eye className="w-5 h-5 text-text-primary shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium">Stream (In-App)</p>
                        <p className="text-sm text-text-secondary">Full access in-app, no download</p>
                      </div>
                      <label className="flex items-center gap-2 shrink-0">
                        <input type="checkbox" checked={tiers[TIER_STREAM].enabled} onChange={e => handleTierChange(TIER_STREAM, 'enabled', e.target.checked)} className="w-4 h-4" />
                        <span className="text-sm">Enable</span>
                      </label>
                      {tiers[TIER_STREAM].enabled && (
                        <div className="flex items-center gap-1 shrink-0">
                          <input type="number" step="0.001" min="0" value={tiers[TIER_STREAM].price} onChange={e => handleTierChange(TIER_STREAM, 'price', parseFloat(e.target.value) || 0)} className="w-20 px-2 py-1 border rounded text-sm" />
                          <span className="text-xs text-text-secondary">SUI</span>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-4 p-4 bg-bg rounded-lg">
                    <LinkIcon className="w-5 h-5 text-text-secondary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">Cite</p>
                      <p className="text-sm text-text-secondary">On-chain citation certificate + access</p>
                    </div>
                    <label className="flex items-center gap-2 shrink-0">
                      <input type="checkbox" checked={tiers[TIER_CITE].enabled} onChange={e => handleTierChange(TIER_CITE, 'enabled', e.target.checked)} className="w-4 h-4" />
                      <span className="text-sm">Enable</span>
                    </label>
                    {tiers[TIER_CITE].enabled && (
                      <div className="flex items-center gap-1 shrink-0">
                        <input type="number" step="0.001" min="0" value={tiers[TIER_CITE].price} onChange={e => handleTierChange(TIER_CITE, 'price', parseFloat(e.target.value) || 0)} className="w-20 px-2 py-1 border rounded text-sm" />
                        <span className="text-xs text-text-secondary">SUI</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-4 p-4 bg-bg rounded-lg">
                    <Download className="w-5 h-5 text-success shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">License</p>
                      <p className="text-sm text-text-secondary">Permanent download</p>
                    </div>
                    <label className="flex items-center gap-2 shrink-0">
                      <input type="checkbox" checked={tiers[TIER_LICENSE].enabled} onChange={e => handleTierChange(TIER_LICENSE, 'enabled', e.target.checked)} className="w-4 h-4" />
                      <span className="text-sm">Enable</span>
                    </label>
                    {tiers[TIER_LICENSE].enabled && (
                      <div className="flex items-center gap-1 shrink-0">
                        <input type="number" step="0.001" min="0" value={tiers[TIER_LICENSE].price} onChange={e => handleTierChange(TIER_LICENSE, 'price', parseFloat(e.target.value) || 0)} className="w-20 px-2 py-1 border rounded text-sm" />
                        <span className="text-xs text-text-secondary">SUI</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-4 p-4 bg-bg rounded-lg">
                    <Crown className="w-5 h-5 shrink-0" style={{ color: 'var(--color-text-muted)' }} />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">Commercial</p>
                      <p className="text-sm text-text-secondary">Full commercial rights</p>
                    </div>
                    <label className="flex items-center gap-2 shrink-0">
                      <input type="checkbox" checked={tiers[TIER_COMMERCIAL].enabled} onChange={e => handleTierChange(TIER_COMMERCIAL, 'enabled', e.target.checked)} className="w-4 h-4" />
                      <span className="text-sm">Enable</span>
                    </label>
                    {tiers[TIER_COMMERCIAL].enabled && (
                      <div className="flex items-center gap-1 shrink-0">
                        <input type="number" step="0.001" min="0" value={tiers[TIER_COMMERCIAL].price} onChange={e => handleTierChange(TIER_COMMERCIAL, 'price', parseFloat(e.target.value) || 0)} className="w-20 px-2 py-1 border rounded text-sm" />
                        <span className="text-xs text-text-secondary">SUI</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Progress indicator */}
              {publishProgress && (
                <div className="alert alert-info">
                  <div className="alert-dot" />
                  <div className="flex-1">
                    <p className="mb-2">Publishing {publishProgress.current} of {publishProgress.total}&hellip;</p>
                    <div className="w-full rounded-full h-1" style={{ background: 'var(--color-border)' }}>
                      <div className="h-1 rounded-full transition-all" style={{ width: `${(publishProgress.current / publishProgress.total) * 100}%`, background: 'var(--color-primary)' }} />
                    </div>
                  </div>
                </div>
              )}

              <button
                onClick={handlePublish}
                disabled={isPublishing || stagedFiles.length === 0 || !baseTitle.trim() || selectedCategories.length === 0}
                className="btn btn-primary w-full justify-center"
              >
                {isPublishing
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Publishing&hellip;</>
                  : stagedFiles.length === 1 ? 'Publish content' : `Publish ${stagedFiles.length} items`}
              </button>

              <p className="text-[13px] text-center" style={{ color: 'var(--color-text-muted)' }}>
                Platform fee: 10% &bull; You receive 90% of all sales
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
