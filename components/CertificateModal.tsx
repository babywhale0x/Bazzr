import { X, ExternalLink, ShieldCheck, Download, Award, Shield, Crown } from 'lucide-react';

interface CertificateProps {
  isOpen: boolean;
  onClose: () => void;
  purchase: any;
}

export default function CertificateModal({ isOpen, onClose, purchase }: CertificateProps) {
  if (!isOpen || !purchase) return null;

  const content = purchase.content;
  const tierName = getTierName(purchase.tier);
  const tierIcon = getTierIcon(purchase.tier);

  // Fallbacks for Walrus URL + TxHash parsing depending on if it's new or old purchases
  const isWalrusUrl = purchase.licenseHash && !purchase.licenseHash.startsWith('fallback-');
  const walrusLink = isWalrusUrl ? `https://aggregator.walrus-testnet.walrus.space/v1/blobs/${purchase.licenseHash}` : null;
  const rawTxHash = purchase.licenseHash?.startsWith('fallback-') 
      ? purchase.licenseHash.split('fallback-')[1] 
      : (purchase.transactionHash || null); // Note: We might not have raw TxHash in DB yet if we only saved blobId, but we can display the blockchain state
  const contentBlobId = purchase.content?.walrusBlobId;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div 
        className="w-full max-w-2xl bg-surface border border-border rounded-xl  relative overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Background Patterns */}
        <div className="absolute top-0 left-0 w-full h-full bg-surface   pointer-events-none" />
        <div className="absolute -top-32 -right-32 w-64 h-64 bg-amber-200/20 rounded-full blur-3xl pointer-events-none" />
        
        {/* Header Ribbon */}
        <div className="h-14 bg-surface   flex items-center justify-between px-6 relative z-10">
           <h2 className="text-white font-medium flex items-center gap-2">
             <ShieldCheck className="w-5 h-5 text-amber-400" />
             Certificate of Authenticity
           </h2>
           <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-full text-white transition-colors">
             <X className="w-5 h-5" />
           </button>
        </div>

        {/* Certificate Body */}
        <div className="p-8 relative z-10">
          <div className="text-center mb-10">
            <div className="mx-auto w-20 h-20 bg-surface   rounded-full flex items-center justify-center  border-4 border-border mb-4">
               {tierIcon}
            </div>
            <h1 className="text-3xl font-medium text-primary font-serif">Official License Record</h1>
            <p className="text-secondary mt-2">Issued by the Verixa Decentralized Protocol</p>
          </div>

          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-bg border border-border rounded-xl z-10 relative">
                <p className="text-xs font-medium text-secondary uppercase tracking-wider mb-1">Licensed Content</p>
                <p className="font-medium text-primary truncate">{content?.title || "Unknown File"}</p>
              </div>
              <div className="p-4 bg-bg border border-border rounded-xl z-10 relative">
                <p className="text-xs font-medium text-secondary uppercase tracking-wider mb-1">Access Tier Rights</p>
                <p className="font-medium text-amber-600">{tierName}</p>
              </div>
            </div>

            <div className="p-5 border-2 border-border border-dashed rounded-xl bg-surface z-10 relative space-y-3">
              <div className="flex justify-between items-center text-sm">
                 <span className="text-secondary">Date Issued:</span>
                 <span className="font-medium text-primary">{new Date(purchase.purchaseTimestamp).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                 <span className="text-secondary">License ID:</span>
                 <span className="font-mono text-primary bg-bg px-2 py-0.5 rounded text-xs">{purchase.purchaseId}</span>
              </div>
              {rawTxHash && (
                <div className="flex justify-between items-center text-sm pt-2 border-t border-border">
                  <span className="text-secondary">Sui Tx Hash:</span>
                  <a 
                    href={`https://suiscan.xyz/testnet/tx/${rawTxHash}`} 
                    target="_blank" 
                    rel="noreferrer"
                    className="font-mono text-primary hover:underline hover:text-primary-hover flex items-center gap-1 text-xs truncate max-w-[220px]"
                    title="View transaction details on Suiscan explorer"
                  >
                    {rawTxHash} <ExternalLink className="w-3 h-3 shrink-0" />
                  </a>
                </div>
              )}
              {contentBlobId && (
                <div className="flex justify-between items-center text-sm pt-2 border-t border-border">
                  <span className="text-secondary">On-Chain Content Blob:</span>
                  <a 
                    href={`https://walruscan.com/testnet/blob/${contentBlobId}`} 
                    target="_blank" 
                    rel="noreferrer"
                    className="font-mono text-primary hover:underline hover:text-primary-hover flex items-center gap-1 text-xs truncate max-w-[220px]"
                    title="View content storage proof on Walrus Explorer"
                  >
                    {contentBlobId} <ExternalLink className="w-3 h-3 shrink-0" />
                  </a>
                </div>
              )}
              {isWalrusUrl && purchase.licenseHash && (
                <div className="flex justify-between items-center text-sm pt-2 border-t border-border">
                  <span className="text-secondary">On-Chain Certificate Blob:</span>
                  <a 
                    href={`https://walruscan.com/testnet/blob/${purchase.licenseHash}`} 
                    target="_blank" 
                    rel="noreferrer"
                    className="font-mono text-primary hover:underline hover:text-primary-hover flex items-center gap-1 text-xs truncate max-w-[220px]"
                    title="View certificate receipt on Walrus Explorer"
                  >
                    {purchase.licenseHash} <ExternalLink className="w-3 h-3 shrink-0" />
                  </a>
                </div>
              )}
            </div>
            
            {/* Action Buttons */}
            <div className="flex gap-3 pt-4 z-10 relative">
              {walrusLink ? (
                <a 
                  href={walrusLink}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-gray-900 dark:bg-white text-white dark:text-black rounded-xl font-medium hover:bg-black dark:hover:bg-gray-200 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  View Raw JSON Certificate
                </a>
              ) : (
                <button disabled className="flex-1 flex items-center justify-center gap-2 py-3 bg-bg text-muted rounded-xl font-medium cursor-not-allowed">
                  No Permanent JSON Attached
                </button>
              )}
              <button 
                onClick={onClose}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-bg text-primary rounded-xl font-medium hover:opacity-80 transition-colors"
               >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Helpers
function getTierName(tier: number): string {
  switch (tier) {
    case 1: return 'Stream (In-App)';
    case 2: return 'Cite (On-chain Reference)';
    case 3: return 'License (Local Use)';
    case 4: return 'Commercial Rights';
    default: return 'Standard Access';
  }
}

function getTierIcon(tier: number) {
  switch (tier) {
    case 1: return <Shield className="w-8 h-8 text-white" />;
    case 2: return <Award className="w-8 h-8 text-white" />;
    case 3: return <ShieldCheck className="w-8 h-8 text-white" />;
    case 4: return <Crown className="w-8 h-8 text-white" />;
    default: return <Award className="w-8 h-8 text-white" />;
  }
}
