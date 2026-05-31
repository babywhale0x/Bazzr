'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, wrap } from 'framer-motion';
import { ChevronLeft, ChevronRight, Image as ImageIcon, Music, Video, FileText } from 'lucide-react';
import Link from 'next/link';
import { formatSui } from '@/lib/sui';

// Reuse the Content interface from explore page
interface Content {
  contentId: string;
  creator: string;
  title: string;
  description: string;
  contentType: string;
  previewUrl?: string;
  streamPrice: string;
  citePrice: string;
  licensePrice?: string;
  tags: string[];
  uploadTimestamp: string;
}

const swipeConfidenceThreshold = 10000;
const swipePower = (offset: number, velocity: number) => {
  return Math.abs(offset) * velocity;
};

const variants = {
  enter: (direction: number) => {
    return {
      x: direction > 0 ? 1000 : -1000,
      opacity: 0
    };
  },
  center: {
    zIndex: 1,
    x: 0,
    opacity: 1
  },
  exit: (direction: number) => {
    return {
      zIndex: 0,
      x: direction < 0 ? 1000 : -1000,
      opacity: 0
    };
  }
};

const TYPE_BG: Record<string, string> = {
  image:    'linear-gradient(135deg, #3b82f6 0%, #818cf8 100%)',
  audio:    'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)',
  video:    'linear-gradient(135deg, #ef4444 0%, #f97316 100%)',
  document: 'linear-gradient(135deg, #10b981 0%, #14b8a6 100%)',
};

function getTypeKey(contentType: string): string {
  if (contentType.startsWith('image/')) return 'image';
  if (contentType.startsWith('audio/')) return 'audio';
  if (contentType.startsWith('video/')) return 'video';
  return 'document';
}

function getTypeIcon(type: string) {
  if (type === 'audio')    return <Music className="w-16 h-16" />;
  if (type === 'image')    return <ImageIcon className="w-16 h-16" />;
  if (type === 'video')    return <Video className="w-16 h-16" />;
  return <FileText className="w-16 h-16" />;
}

function formatAddress(addr: string) {
  if (!addr) return '';
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function FeaturedSlideshow({ items }: { items: Content[] }) {
  const [[page, direction], setPage] = useState([0, 0]);
  const [isHovered, setIsHovered] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // We only have index between 0 and items.length - 1
  const imageIndex = wrap(0, items.length, page);

  const paginate = (newDirection: number) => {
    setPage((prev) => [prev[0] + newDirection, newDirection]);
  };

  useEffect(() => {
    if (items.length <= 1) return;

    if (!isHovered) {
      const timer = setInterval(() => {
        setPage((prev) => [prev[0] + 1, 1]);
      }, 3500); // 3.5 seconds
      
      return () => clearInterval(timer);
    }
  }, [isHovered, items.length]);

  if (!items || items.length === 0) return null;

  const currentItem = items[imageIndex];
  const typeKey = getTypeKey(currentItem.contentType);
  const isImage = typeKey === 'image';
  
  // Mock data for the UI
  const mockLicensePrice = "1.5";
  const mockCommercialPrice = "5.0";
  const mockVolume = "24.5K";

  return (
    <div 
      className="relative w-full rounded-2xl overflow-hidden shadow-none mb-8 group"
      style={{ height: '400px', background: 'var(--color-surface)' }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <AnimatePresence initial={false} custom={direction}>
        <motion.div
          key={page}
          custom={direction}
          variants={variants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{
            x: { type: "spring", stiffness: 300, damping: 30 },
            opacity: { duration: 0.2 }
          }}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={1}
          onDragEnd={(e, { offset, velocity }) => {
            const swipe = swipePower(offset.x, velocity.x);
            if (swipe < -swipeConfidenceThreshold) {
              paginate(1);
            } else if (swipe > swipeConfidenceThreshold) {
              paginate(-1);
            }
          }}
          className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing"
        >
          {/* Background image or gradient */}
          {currentItem.previewUrl ? (
            <img 
              src={currentItem.previewUrl} 
              alt={currentItem.title} 
              className="absolute inset-0 w-full h-full object-cover" 
            />
          ) : (
            <div className="absolute inset-0 w-full h-full flex items-center justify-center" style={{ background: TYPE_BG[typeKey] }}>
              <div className="text-white/30 transform scale-150">
                {getTypeIcon(typeKey)}
              </div>
            </div>
          )}

          {/* Vignette overlay */}
          <div 
            className="absolute inset-0" 
            style={{ 
              background: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.4) 40%, rgba(0,0,0,0) 100%)' 
            }} 
          />

          {/* Details block */}
          <div className="absolute bottom-0 left-0 p-6 sm:p-8 md:p-10 w-full z-10 pointer-events-none">
            <h2 className="text-3xl md:text-5xl font-medium text-white mb-2 tracking-tight drop-shadow-sm">
              {currentItem.title}
            </h2>
            <div className="flex items-center gap-2 mb-6 text-white/90 font-medium">
              <span>By {formatAddress(currentItem.creator)}</span>
              <span className="w-4 h-4 rounded-full bg-primary flex items-center justify-center text-[10px] font-medium">✓</span>
            </div>

            {/* Stats Box */}
            <div 
              className="inline-flex gap-6 rounded-xl border border-white/20 p-4 backdrop-blur-md pointer-events-auto"
              style={{ background: 'rgba(0,0,0,0.5)' }}
            >
              {isImage ? (
                <>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-white/60 font-medium uppercase tracking-wider mb-1">Cite</span>
                    <span className="text-white font-medium">{Number(currentItem.citePrice) > 0 ? formatSui(Number(currentItem.citePrice)) : 'Free'}</span>
                  </div>
                  <div className="flex flex-col border-l border-white/20 pl-6">
                    <span className="text-[10px] text-white/60 font-medium uppercase tracking-wider mb-1">License</span>
                    <span className="text-white font-medium">{mockLicensePrice} SUI</span>
                  </div>
                  <div className="flex flex-col border-l border-white/20 pl-6">
                    <span className="text-[10px] text-white/60 font-medium uppercase tracking-wider mb-1">Commercial</span>
                    <span className="text-white font-medium">{mockCommercialPrice} SUI</span>
                  </div>
                  <div className="flex flex-col border-l border-white/20 pl-6">
                    <span className="text-[10px] text-white/60 font-medium uppercase tracking-wider mb-1">Total Volume</span>
                    <span className="text-white font-medium">{mockVolume} SUI</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-white/60 font-medium uppercase tracking-wider mb-1">View</span>
                    <span className="text-white font-medium">{Number(currentItem.streamPrice) > 0 ? formatSui(Number(currentItem.streamPrice)) : 'Free'}</span>
                  </div>
                  <div className="flex flex-col border-l border-white/20 pl-6">
                    <span className="text-[10px] text-white/60 font-medium uppercase tracking-wider mb-1">Cite</span>
                    <span className="text-white font-medium">{Number(currentItem.citePrice) > 0 ? formatSui(Number(currentItem.citePrice)) : 'Free'}</span>
                  </div>
                  <div className="flex flex-col border-l border-white/20 pl-6">
                    <span className="text-[10px] text-white/60 font-medium uppercase tracking-wider mb-1">License</span>
                    <span className="text-white font-medium">{mockLicensePrice} SUI</span>
                  </div>
                </>
              )}
            </div>
            
            <div className="mt-4 pointer-events-auto">
              <Link href={`/content/${currentItem.contentId}`} className="btn-primary inline-flex">
                View Content
              </Link>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Navigation Arrows */}
      {items.length > 1 && (
        <>
          <button 
            className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center bg-black/40 text-white hover:bg-black/70 backdrop-blur-sm transition-all opacity-0 group-hover:opacity-100 z-20"
            onClick={() => paginate(-1)}
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <button 
            className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center bg-black/40 text-white hover:bg-black/70 backdrop-blur-sm transition-all opacity-0 group-hover:opacity-100 z-20"
            onClick={() => paginate(1)}
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </>
      )}

      {/* Dash indicators */}
      {items.length > 1 && (
        <div className="absolute bottom-4 left-0 w-full flex justify-center gap-2 z-20 pointer-events-none">
          {items.map((_, i) => (
            <div 
              key={i} 
              className={`h-1.5 rounded-full transition-all duration-300 ${i === imageIndex ? 'w-8 bg-white' : 'w-4 bg-white/40'}`} 
            />
          ))}
        </div>
      )}
    </div>
  );
}
