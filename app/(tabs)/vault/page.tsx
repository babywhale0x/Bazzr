'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useCurrentAccount } from '@mysten/dapp-kit';
import { useDropzone } from 'react-dropzone';
import { Upload, File, Image as ImageIcon, Video, Music, FileText, Trash2, Download, Lock, Globe, Loader2, ArrowLeft, Eye, Folder as FolderIcon, X } from 'lucide-react';
import { formatSui } from '@/lib/sui';
import { FiatOnramp } from '@/components/wallet/FiatOnramp';
import toast from 'react-hot-toast';

interface StoredFile {
  id: string;
  blobId: string;
  name: string;
  contentType: string;
  size: bigint;
  isPublic: boolean;
  encrypted: boolean;
  createdAt: string;
  storageFee: number | null;
}

export default function VaultPage() {
  const account = useCurrentAccount();
  const connected = !!account;
  const [files, setFiles] = useState<StoredFile[]>([]);
  const [storageStats, setStorageStats] = useState({
    totalBytes: BigInt(0),
    walletBalance: BigInt(0),
    monthlyCost: BigInt(0),
    monthsRemaining: BigInt(0),
  });
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);
  const [stagedFiles, setStagedFiles] = useState<File[]>([]);
  const [stagedTitle, setStagedTitle] = useState('');
  const [stagedDescription, setStagedDescription] = useState('');
  const [showFundModal, setShowFundModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [currentFolder, setCurrentFolder] = useState<{name: string, files: StoredFile[]} | null>(null);
  const [previewFile, setPreviewFile] = useState<StoredFile | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);


  
  const groupedItems = useMemo(() => {
    const groups: Record<string, StoredFile[]> = {};
    const singles: StoredFile[] = [];

    files.forEach(f => {
      const match = f.name.match(/^(.*?) (\d+)(\.[^.]+)?$/);
      if (match) {
        const base = match[1];
        if (!groups[base]) groups[base] = [];
        groups[base].push(f);
      } else {
        singles.push(f);
      }
    });

    const result: any[] = [...singles];
    
    Object.entries(groups).forEach(([base, gFiles]) => {
      if (gFiles.length === 1) {
        result.push(gFiles[0]);
      } else {
        result.push({
          isFolder: true,
          name: base,
          id: `folder-${base}`,
          files: gFiles.sort((a, b) => a.name.localeCompare(b.name)),
          size: gFiles.reduce((acc, current) => acc + BigInt(current.size), BigInt(0)),
          createdAt: gFiles[gFiles.length - 1].createdAt,
          storageFee: gFiles.reduce((acc, current) => acc + (current.storageFee || 0), 0)
        });
      }
    });

    return result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [files]);

  // Fetch user's files and storage stats
  useEffect(() => {
    if (connected && account) {
      fetchFiles();
      fetchStorageStats();
    }
  }, [connected, account]);

  const fetchFiles = async () => {
    if (!account) return;
    try {
      const response = await fetch(`/api/storage/files?wallet=${account.address.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setFiles(data.files || []);
      }
    } catch (error) {
      console.error('Failed to fetch files:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchStorageStats = async () => {
    if (!account) return;
    try {
      const response = await fetch(`/api/storage/status?wallet=${account.address.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setStorageStats({
          totalBytes: BigInt(data.totalBytes || 0),
          walletBalance: BigInt(data.walletBalance || 0),
          monthlyCost: BigInt(data.monthlyCost || 0),
          monthsRemaining: BigInt(data.monthsRemaining || 0),
        });
      }
    } catch (error) {
      console.error('Failed to fetch storage stats:', error);
    }
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (!connected) {
      toast.error('Please connect your wallet first');
      return;
    }

    setStagedFiles(acceptedFiles);
    setStagedTitle('');
    setStagedDescription('');
  }, [connected]);

  // ─── Upload using the BROWSER SDK (same flow as Create tab) ───
  const handleConfirmUpload = async () => {
    if (!connected || !account) return;

    setIsUploading(true);
    setUploadProgress({ current: 0, total: stagedFiles.length });

    try {
      for (let i = 0; i < stagedFiles.length; i++) {
        const file = stagedFiles[i];
        let finalName = file.name;
        if (stagedTitle) {
          finalName = stagedFiles.length === 1
            ? stagedTitle
            : `${stagedTitle} ${i + 1}`;
        }

        const safeBase = finalName.trim().toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
        const blobName = `vault-${Date.now()}-${safeBase}`;

        setUploadProgress({ current: i + 1, total: stagedFiles.length });
        toast.loading(`Uploading ${finalName} (${i + 1}/${stagedFiles.length})…`, { id: 'vault-upload' });

        try {
          // Step 1: Encrypt the file before upload
          const { generateEncryptionKey, encryptData } = await import('@/lib/encryption');
          const encKey = await generateEncryptionKey();
          const rawData = new Uint8Array(await file.arrayBuffer());
          const encryptedData = await encryptData(rawData, encKey);

          // Step 2: Upload ENCRYPTED data directly to Walrus Publisher
          let walrusBlobId = '';
          let uploadRetries = 0;
          let uploadSuccess = false;
          while (!uploadSuccess && uploadRetries < 3) {
            try {
              const publisherUrl = process.env.NEXT_PUBLIC_WALRUS_PUBLISHER_URL || 'https://publisher.walrus-testnet.walrus.space';
              const response = await fetch(`${publisherUrl}/v1/blobs?epochs=5`, {
                method: 'PUT',
                body: new Blob([encryptedData as any]),
              });
              if (!response.ok) throw new Error(`Walrus HTTP error: ${response.status}`);
              const result = await response.json();
              walrusBlobId = result.newlyCreated ? result.newlyCreated.blobObject.blobId : result.alreadyCertified.blobId;
              uploadSuccess = true;
            } catch (err: any) {
              uploadRetries++;
              console.warn(`Walrus upload attempt ${uploadRetries} failed:`, err);
              if (uploadRetries >= 3) throw new Error(`Walrus upload failed after 3 attempts.`);
              await new Promise(r => setTimeout(r, 3000));
            }
          }

          // Step 3: Calculate storage fee based on actual file size
          const fileSizeGB = file.size / 1073741824;
          const feePerGBYear = 0.012; // WAL
          const calculatedFee = Math.max(fileSizeGB * feePerGBYear, 0.0001); // min floor

          // Step 4: Save metadata + encryption key + fee to DB
          await fetch('/api/upload/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              walletAddress: account.address.toString(),
              blobId: walrusBlobId,
              name: finalName,
              contentType: file.type,
              size: file.size,
              isPublic: false,
              encrypted: true,
              encryptionKey: encKey,
              description: stagedDescription || null,
              storageFee: parseFloat(calculatedFee.toFixed(8)),
            }),
          });

          toast.success(`Uploaded ${finalName}`, { id: 'vault-upload' });
        } catch (err: any) {
          console.error(`Upload error for ${finalName}:`, err);
          toast.error(`Failed to upload ${finalName} — ${err?.message || 'Unknown error'}`, { id: 'vault-upload' });
        }
      }

      toast.success(
        stagedFiles.length === 1 ? 'File uploaded to vault!' : `${stagedFiles.length} files uploaded to vault!`,
        { id: 'vault-upload' },
      );

      setStagedFiles([]);
      setStagedTitle('');
      setStagedDescription('');
      fetchFiles();
      fetchStorageStats();
    } catch (error: any) {
      console.error('Vault upload error:', error);
      toast.error(error?.message || 'Failed to upload', { id: 'vault-upload' });
    } finally {
      setIsUploading(false);
      setUploadProgress(null);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxSize: 1024 * 1024 * 500, // 500MB
  });

  const handleDelete = async (blobId: string) => {
    try {
      const response = await fetch(`/api/storage/files/${blobId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast.success('File deleted');
        fetchFiles();
        fetchStorageStats();
      }
    } catch (error) {
      toast.error('Failed to delete file');
    }
  };

  
  const handlePreview = async (file: StoredFile) => {
    setPreviewFile(file);
    setIsPreviewLoading(true);
    setPreviewUrl(null);
    try {
      const response = await fetch(`/api/download/${file.blobId}?wallet=${account?.address?.toString() || ''}`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        setPreviewUrl(url);
      } else {
         const { default: toast } = await import('react-hot-toast');
         toast.error('Failed to load preview');
         setPreviewFile(null);
      }
    } catch (error) {
      const { default: toast } = await import('react-hot-toast');
      toast.error('Failed to load preview');
      setPreviewFile(null);
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const closePreview = () => {
    if (previewUrl) {
      window.URL.revokeObjectURL(previewUrl);
    }
    setPreviewFile(null);
    setPreviewUrl(null);
  };

  const handleDownload = async (blobId: string, name: string) => {
    try {
      const response = await fetch(`/api/download/${blobId}?wallet=${account?.address?.toString() || ''}`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      toast.error('Failed to download file');
    }
  };

  const formatFileSize = (bytes: bigint) => {
    const num = Number(bytes);
    if (num === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(num) / Math.log(k));
    return parseFloat((num / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (contentType: string) => {
    if (contentType.startsWith('image/')) return <ImageIcon className="w-5 h-5" />;
    if (contentType.startsWith('video/')) return <Video className="w-5 h-5" />;
    if (contentType.startsWith('audio/')) return <Music className="w-5 h-5" />;
    return <FileText className="w-5 h-5" />;
  };

  const ExpiryTimer = ({ createdAt }: { createdAt: string }) => {
    const [timeLeft, setTimeLeft] = useState('');

    useEffect(() => {
      const calculateTime = () => {
        const expiryDate = new Date(new Date(createdAt).getTime() + 365 * 24 * 60 * 60 * 1000);
        const diffTime = Math.max(0, expiryDate.getTime() - Date.now());
        if (diffTime === 0) return 'Expired';
        
        const d = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        const h = Math.floor((diffTime % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const m = Math.floor((diffTime % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((diffTime % (1000 * 60)) / 1000);
        
        return `${d}d ${h}h ${m}m ${s}s`;
      };

      setTimeLeft(calculateTime());
      const interval = setInterval(() => setTimeLeft(calculateTime()), 1000);
      return () => clearInterval(interval);
    }, [createdAt]);

    return <span>{timeLeft}</span>;
  };

  if (!connected) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--color-bg)' }}>
        <div className="text-center">
          <Lock className="w-16 h-16 mx-auto mb-4" style={{ color: 'var(--color-text-muted)' }} />
          <h2 className="text-[1.75rem] font-medium mb-2" style={{ color: 'var(--color-text-primary)' }}>Your vault</h2>
          <p className="text-[15px]" style={{ color: 'var(--color-text-secondary)' }}>Connect your wallet to access your vault</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-bg)' }}>
      <div className="max-w-[1440px] mx-auto px-8">

        {/* Page header — no divider, flows into content */}
        <div className="flex items-end justify-between pt-10 pb-8">
          <div>
            <p className="text-[11px] font-medium tracking-[0.08em] uppercase mb-1" style={{ color: 'var(--color-text-muted)' }}>Vault</p>
            <h1 className="text-[26px] font-medium tracking-tight" style={{ color: 'var(--color-text-primary)', letterSpacing: '-0.015em' }}>Your vault</h1>
          </div>
          <button onClick={() => setShowFundModal(true)} className="btn btn-primary btn-sm">
            Fund wallet
          </button>
        </div>
        {/* Storage Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="card p-4">
            <p className="text-sm text-text-secondary">Storage Used</p>
            <p className="text-2xl font-medium">{formatFileSize(storageStats.totalBytes)}</p>
          </div>
          <div className="card p-4">
            <p className="text-sm text-text-secondary">WAL Balance</p>
            <div className="flex items-center gap-2 mt-1">
              <div className="w-2 h-2 rounded-full bg-success" />
              <p className="text-2xl font-medium">{(Number(storageStats.walletBalance) / 1e8).toFixed(2)} WAL</p>
            </div>
          </div>
          <div className="card p-4">
            <p className="text-sm text-text-secondary">Total Fees Paid</p>
            <p className="text-2xl font-medium text-success">
              {files.reduce((sum, f) => sum + (f.storageFee || 0), 0).toFixed(4)} WAL
            </p>
          </div>
        </div>

        {/* Upload area */}
        {stagedFiles.length > 0 ? (
          <div className="card p-6 mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[15px] font-medium" style={{ color: 'var(--color-text-primary)' }}>Confirm upload</h2>
              <button
                onClick={() => { setStagedFiles([]); setStagedTitle(''); setStagedDescription(''); }}
                disabled={isUploading}
                className="btn btn-sm btn-secondary"
              >
                <ArrowLeft className="w-4 h-4" /> Change files
              </button>
            </div>

            {/* File List */}
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1 mb-4">
              {stagedFiles.map((f, i) => {
                const finalName = stagedTitle
                  ? (stagedFiles.length === 1 ? stagedTitle : `${stagedTitle} ${i + 1}`)
                  : f.name;
                return (
                  <div key={i} className="flex items-center gap-3 p-3 bg-surface rounded-lg">
                    {getFileIcon(f.type)}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{finalName}</p>
                      <p className="text-xs text-text-muted">{(f.size / 1024 / 1024).toFixed(2)} MB · {f.type}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">
                  {stagedFiles.length === 1 ? 'Name' : 'Base Name'}
                </label>
                <input
                  type="text"
                  value={stagedTitle}
                  onChange={(e) => setStagedTitle(e.target.value)}
                  className="w-full px-4 py-2 border border-border rounded-lg bg-surface"
                  placeholder={stagedFiles[0]?.name || 'Enter name'}
                />
                {stagedFiles.length > 1 && (
                  <p className="text-xs text-text-secondary mt-1">
                    Files will be named <strong>{stagedTitle || 'Name'} 1</strong>, <strong>{stagedTitle || 'Name'} 2</strong>…
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">Description (Optional)</label>
                <textarea
                  value={stagedDescription}
                  onChange={(e) => setStagedDescription(e.target.value)}
                  className="w-full px-4 py-2 border border-border rounded-lg bg-surface"
                  rows={2}
                  placeholder="Describe these files"
                />
              </div>

              {/* Progress indicator */}
              {uploadProgress && (
                <div className="alert alert-info">
                  <div className="alert-dot" />
                  <div className="flex-1">
                    <p className="mb-2">Uploading {uploadProgress.current} of {uploadProgress.total}&hellip;</p>
                    <div className="w-full rounded-full h-1" style={{ background: 'var(--color-border)' }}>
                      <div className="h-1 rounded-full transition-all" style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%`, background: 'var(--color-primary)' }} />
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button onClick={handleConfirmUpload} disabled={isUploading} className="btn btn-primary flex-1 justify-center">
                  {isUploading ? <><Loader2 className="w-4 h-4 animate-spin" /> Uploading&hellip;</> : <><Upload className="w-4 h-4" /> Upload to vault</>}
                </button>
                <button onClick={() => { setStagedFiles([]); setStagedTitle(''); setStagedDescription(''); }} disabled={isUploading} className="btn btn-secondary">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div
            {...getRootProps()}
            className={`upload-zone mb-8 ${ isDragActive ? 'border-primary' : '' }`}
          >
            <input {...getInputProps()} />
            <Upload className="w-8 h-8 mb-4" strokeWidth={1.25} style={{ color: 'var(--color-text-muted)' }} />
            <h4 className="text-[14px] font-medium mb-1" style={{ color: 'var(--color-text-primary)' }}>
              {isDragActive ? 'Drop files here' : 'Drag & drop your files here'}
            </h4>
            <p className="text-[13px]" style={{ color: 'var(--color-text-muted)' }}>
              <strong style={{ color: 'var(--color-primary)', fontWeight: 500 }}>Click to browse</strong> or drag any file type &middot; Max 500 MB &middot; Encrypted
            </p>
          </div>
        )}


        {/* File List */}
        {isLoading ? (
          <div className="text-center py-12">
            <Loader2 className="w-8 h-8 animate-spin mx-auto" />
          </div>
        ) : groupedItems.length === 0 ? (
          <div className="text-center py-12 text-text-secondary">
            <File className="w-16 h-16 mx-auto mb-4" />
            <p>No files yet. Upload your first file above.</p>
          </div>
        ) : (
          <div className="card overflow-hidden">
            
              {currentFolder && (
                 <div className="flex items-center gap-2 mb-4 p-4" style={{ background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}>
                    <button onClick={() => setCurrentFolder(null)} className="btn btn-sm btn-secondary">
                      <ArrowLeft className="w-4 h-4" /> Back to vault
                    </button>
                    <span className="text-[14px] font-medium flex items-center gap-2" style={{ color: 'var(--color-text-primary)' }}>
                      <FolderIcon className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />
                      {currentFolder.name}
                    </span>
                 </div>
              )}

<table className="w-full" style={{ borderCollapse: 'collapse', fontSize: 13 }}>
              <thead style={{ background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}>
                <tr>
                  <th className="px-4 py-3 text-left" style={{ fontSize: 11, fontWeight: 500, color: 'var(--color-text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>File</th>
                  <th className="px-4 py-3 text-left" style={{ fontSize: 11, fontWeight: 500, color: 'var(--color-text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Size</th>
                  <th className="px-4 py-3 text-left" style={{ fontSize: 11, fontWeight: 500, color: 'var(--color-text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Fee paid</th>
                  <th className="px-4 py-3 text-left" style={{ fontSize: 11, fontWeight: 500, color: 'var(--color-text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Type</th>
                  <th className="px-4 py-3 text-left" style={{ fontSize: 11, fontWeight: 500, color: 'var(--color-text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Status</th>
                  <th className="px-4 py-3 text-right" style={{ fontSize: 11, fontWeight: 500, color: 'var(--color-text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {(currentFolder ? currentFolder.files : groupedItems).map((item) => {
                  if (item.isFolder) {
                    return (
                      <tr key={item.id} style={{ cursor: 'pointer' }} onClick={() => setCurrentFolder(item)} onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-bg)')} onMouseLeave={e => (e.currentTarget.style.background = '')}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <FolderIcon className="w-5 h-5" style={{ color: 'var(--color-primary)' }} />
                            <span className="font-medium text-[13px]" style={{ color: 'var(--color-text-primary)' }}>{item.name}</span>
                            <span className="badge badge-primary">{item.files.length} files</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-mono text-[12px]" style={{ color: 'var(--color-text-muted)' }}>{formatFileSize(item.size)}</td>
                        <td className="px-4 py-3 font-mono text-[12px]" style={{ color: 'var(--color-text-muted)' }}>
                          {item.storageFee != null ? item.storageFee.toFixed(4) : '—'} WAL
                        </td>
                        <td className="px-4 py-3 text-[13px]" style={{ color: 'var(--color-text-secondary)' }}>
                          Folder
                        </td>
                        <td className="px-4 py-3">
                           <span className="text-[13px]" style={{ color: 'var(--color-text-secondary)' }}>—</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={(e) => { e.stopPropagation(); setCurrentFolder(item); }}
                            className="btn btn-sm btn-secondary"
                          >
                            Open
                          </button>
                        </td>
                      </tr>
                    );
                  }

                  
                  const file = item as StoredFile;
                  return (
                    <tr key={file.id} className="hover:bg-bg">

<td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {getFileIcon(file.contentType)}
                        <span className="font-medium">{file.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-text-secondary">
                      {formatFileSize(file.size)}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-success">
                      {file.storageFee != null ? file.storageFee.toFixed(4) : '—'} WAL
                    </td>
                    <td className="px-6 py-4 text-sm text-text-secondary">
                      {file.contentType}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          {file.encrypted && <Lock className="w-4 h-4 text-success" />}
                          {file.isPublic && <Globe className="w-4 h-4 text-text-primary" />}
                          <span className="text-sm text-text-secondary">
                            {file.isPublic ? 'Public' : 'Private'}
                          </span>
                        </div>
                        <div className="text-[12px] font-mono" style={{ color: 'var(--color-text-muted)' }}>
                          Expires: <ExpiryTimer createdAt={file.createdAt} />
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); handlePreview(file); }}
                          className="p-2 hover:bg-bg rounded-lg text-text-primary"
                          title="Preview"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDownload(file.blobId, file.name); }}
                          className="p-2 hover:bg-bg rounded-lg"
                          title="Download"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(file.blobId); }}
                          className="p-2 hover:bg-red-50 dark:bg-red-900/20 dark:hover:bg-red-900/20 text-red-600 rounded-lg"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Fund Modal */}
      <FiatOnramp
        isOpen={showFundModal}
        onClose={() => setShowFundModal(false)}
        onSuccess={() => {
          setShowFundModal(false);
          fetchStorageStats();
          toast.success('Wallet funded successfully!');
        }}
      />
    
      {/* Preview Modal */}
      {previewFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-surface rounded-xl  w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div className="flex items-center gap-3">
                {getFileIcon(previewFile.contentType)}
                <h3 className="font-medium text-lg">{previewFile.name}</h3>
              </div>
              <button onClick={closePreview} className="p-2 hover:bg-bg rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex-1 overflow-auto bg-bg flex items-center justify-center p-4 min-h-[300px]">
              {isPreviewLoading ? (
                <div className="flex flex-col items-center text-text-secondary">
                   <Loader2 className="w-8 h-8 animate-spin mb-3 text-text-primary" />
                   <p>Decrypting and loading preview...</p>
                </div>
              ) : previewUrl ? (
                previewFile.contentType.startsWith('image/') ? (
                  <img src={previewUrl} alt={previewFile.name} className="max-w-full max-h-full object-contain rounded-lg " />
                ) : previewFile.contentType.startsWith('video/') ? (
                  <video src={previewUrl} controls autoPlay className="max-w-full max-h-full rounded-lg " />
                ) : previewFile.contentType.startsWith('audio/') ? (
                  <audio src={previewUrl} controls className="w-full max-w-md" />
                ) : (
                  <div className="text-center">
                    <FileText className="w-16 h-16 text-text-muted mx-auto mb-4" />
                    <p className="text-text-secondary mb-4">Preview not available for this file type.</p>
                    <button onClick={() => handleDownload(previewFile.blobId, previewFile.name)} className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover font-medium">
                       <Download className="w-4 h-4 inline mr-2" /> Download to View
                    </button>
                  </div>
                )
              ) : (
                <div className="text-text-secondary">Failed to load preview.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
