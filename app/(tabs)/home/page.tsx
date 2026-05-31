'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowRight, Music, Image, Video, FileText, Zap, Users, BarChart2, Star, TrendingUp, Clock } from 'lucide-react';
import { useCurrentAccount } from '@mysten/dapp-kit';
import { formatSui } from '@/lib/sui';
import { AnimatePresence, motion } from 'framer-motion';

interface ContentItem {
  contentId: string;
  title: string;
  creator: string;
  contentType: string;
  streamPrice: string;
  citePrice: string;
  previewUrl?: string;
  tags: string[];
  uploadTimestamp: string;
}

const TRENDING_TAGS = ['music', 'photography', 'nft', 'design', 'art', 'electronic', 'nature', 'tutorial', 'video', 'research'];

const VERBS = ['Publish', 'License', 'Monetize'];

function RotatingVerbs({ align = 'right' }: { align?: 'left' | 'right' }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % VERBS.length);
    }, 2500);
    return () => clearInterval(timer);
  }, []);

  return (
    <span className={`relative inline-grid items-center ${align === 'right' ? 'justify-items-end' : 'justify-items-start'} h-[1.5em] overflow-hidden`}>
      <span className="invisible font-medium whitespace-nowrap col-start-1 row-start-1 px-1">
        Monetize,
      </span>
      <AnimatePresence>
        <motion.span
          key={index}
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -30, opacity: 0 }}
          transition={{ duration: 0.4, ease: "easeInOut" }}
          className={`col-start-1 row-start-1 flex items-center text-primary font-medium whitespace-nowrap h-full px-1`}
        >
          {VERBS[index]},
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

function getTypeKey(contentType: string): string {
  if (contentType.startsWith('image/')) return 'image';
  if (contentType.startsWith('audio/')) return 'audio';
  if (contentType.startsWith('video/')) return 'video';
  return 'document';
}

function getTypeIcon(type: string) {
  if (type === 'audio')    return <Music className="w-[32px] h-[32px] text-text-muted" strokeWidth={1.25} />;
  if (type === 'image')    return <Image className="w-[32px] h-[32px] text-text-muted" strokeWidth={1.25} />;
  if (type === 'video')    return <Video className="w-[32px] h-[32px] text-text-muted" strokeWidth={1.25} />;
  return <FileText className="w-[32px] h-[32px] text-text-muted" strokeWidth={1.25} />;
}

function getTypeLabel(type: string): string {
  if (type === 'audio') return 'Music';
  if (type === 'image') return 'Photos';
  if (type === 'video') return 'Video';
  return 'Document';
}

function formatAddress(addr: string) {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export default function HomePage() {
  const account = useCurrentAccount();
  const connected = !!account;
  const [isMounted, setIsMounted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [recentContent, setRecentContent] = useState<ContentItem[]>([]);
  const [totalItems, setTotalItems] = useState(0);

  useEffect(() => {
    setIsMounted(true);
    fetchContent();
  }, []);

  const fetchContent = async () => {
    try {
      const res = await fetch('/api/content?sort=newest&limit=20');
      if (res.ok) {
        const data = await res.json();
        setRecentContent(data.contents || []);
        setTotalItems(data.total || 0);
      }
    } catch (error) {
      console.error('Failed to fetch content:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const shortAddress = account?.address?.toString() ?? '';
  const displayAddr = shortAddress ? `${shortAddress.slice(0, 6)}…${shortAddress.slice(-4)}` : '';

  const trending = recentContent.slice(0, 5);
  const featured = recentContent.slice(5, 8);

  const STATS = [
    { label: 'Total items', value: totalItems.toString() },
    { label: 'Categories', value: '12' },
    { label: 'Open market', value: 'Live' },
    { label: 'Creators', value: new Set(recentContent.map(c => c.creator)).size.toString() },
  ];

  return (
    <div className="min-h-screen">
      <div className="max-w-[1440px] mx-auto px-8">

        {/* ─── HERO ─── */}
        {!isMounted ? (
          <section className="pt-[5rem] pb-[4rem]">
            <div className="animate-pulse flex flex-col opacity-30 h-[160px]">
              <div className="w-64 h-8 bg-border rounded mb-4" />
              <div className="w-48 h-4 bg-border rounded" />
            </div>
          </section>
        ) : connected ? (
          <section className="pt-[4rem] pb-[3rem] border-b border-border">
            <p className="text-[12px] font-medium text-primary tracking-[0.02em] mb-3">Welcome back</p>
            <h1 className="text-[clamp(2rem,4vw,2.5rem)] font-medium text-text-primary leading-[1.2] tracking-[-0.02em] mb-2">
              {displayAddr}
            </h1>
            <div className="flex items-center text-[18px] font-medium text-text-secondary mb-2">
              <RotatingVerbs align="left" />
              <span className="ml-1 shrink-0">your creative work.</span>
            </div>
            <p className="text-[14px] text-text-secondary mb-6">Continue creating or exploring the marketplace</p>
            <div className="flex gap-2.5">
              <Link href="/explore" className="inline-flex items-center gap-1.5 font-medium text-[14px] px-[18px] py-[8px] rounded-[10px] bg-primary text-white border border-primary hover:bg-primary-hover transition-all leading-none">
                Explore content <ArrowRight className="w-4 h-4" />
              </Link>
              <Link href="/create" className="inline-flex items-center gap-1.5 font-medium text-[14px] px-[18px] py-[8px] rounded-[10px] bg-surface text-text-primary border border-border hover:bg-bg transition-all leading-none">
                + Create
              </Link>
            </div>
          </section>
        ) : (
          <section className="pt-[6rem] pb-[5rem] border-b border-border text-center">
            <h1 className="text-[clamp(2rem,5vw,3.5rem)] font-medium text-text-primary leading-[1.15] tracking-[-0.02em] mb-4">
              The creator economy,<br />
              <span className="text-primary">on-chain.</span>
            </h1>
            <div className="flex justify-center items-center text-[18px] font-medium text-text-secondary mb-3">
              <RotatingVerbs align="right" />
              <span className="ml-1 shrink-0">your creative work.</span>
            </div>
            <p className="text-[12px] text-text-muted font-medium tracking-[0.08em] uppercase mb-8">
              Permanent storage • Direct wallet payments • Zero middlemen
            </p>
            <div className="flex gap-2.5 justify-center">
              <Link href="/explore" className="inline-flex items-center gap-1.5 font-medium text-[14px] px-[18px] py-[8px] rounded-[10px] bg-primary text-white border border-primary hover:bg-primary-hover transition-all leading-none">
                Browse content <ArrowRight className="w-4 h-4" />
              </Link>
              <Link href="/vault" className="inline-flex items-center gap-1.5 font-medium text-[14px] px-[18px] py-[8px] rounded-[10px] bg-surface text-text-primary border border-border hover:bg-bg transition-all leading-none">
                Store content
              </Link>
            </div>
          </section>
        )}

        {/* ─── STATS BAND ─── */}
        <div className="py-[3rem] border-b border-border">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {STATS.map(stat => (
              <div key={stat.label} className="text-center">
                <div className="text-[28px] font-medium text-text-primary tracking-[-0.02em] mb-1">{stat.value}</div>
                <div className="text-[13px] text-text-muted">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ─── FEATURED CONTENTS ─── */}
        {(isLoading || featured.length > 0) && (
          <section className="py-[5rem]">
            <div className="flex items-end justify-between mb-[2.5rem]">
              <div>
                <div className="text-[12px] font-medium text-text-muted tracking-[0.08em] uppercase mb-3">Featured</div>
                <h2 className="text-[1.75rem] font-medium text-text-primary tracking-[-0.015em] mb-0">Featured contents</h2>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="bg-surface border border-border rounded-[14px] overflow-hidden">
                    <div className="skeleton h-[160px] w-full" />
                    <div className="p-5 space-y-2">
                      <div className="skeleton h-4 w-3/4 rounded" />
                      <div className="skeleton h-3 w-1/2 rounded" />
                    </div>
                  </div>
                ))
              ) : (
                featured.map((item) => {
                  const typeKey = getTypeKey(item.contentType);
                  return (
                    <Link
                      key={item.contentId}
                      href={`/content/${item.contentId}`}
                      className="bg-surface border border-border rounded-[14px] overflow-hidden hover:border-primary transition-colors"
                    >
                      <div className="h-[160px] bg-bg border-b border-border flex items-center justify-center relative">
                        {item.previewUrl && item.contentType.startsWith('image/') ? (
                          <img src={item.previewUrl} alt={item.title} className="w-full h-full object-cover" />
                        ) : (
                          <div className="flex flex-col items-center gap-2">
                            {getTypeIcon(typeKey)}
                          </div>
                        )}
                        <span className="absolute top-[10px] left-[10px] text-[11px] font-medium px-[8px] py-[3px] rounded-full bg-primary-light text-primary">
                          {getTypeLabel(typeKey)}
                        </span>
                      </div>
                      <div className="p-4 md:p-5">
                        <div className="flex items-center gap-1.5 mb-2">
                          <div className="w-[20px] h-[20px] rounded-full bg-primary-light border border-border flex items-center justify-center text-[9px] font-medium text-primary">
                            {item.creator.slice(2, 4).toUpperCase()}
                          </div>
                          <span className="text-[12px] text-text-muted">{formatAddress(item.creator)}</span>
                        </div>
                        <div className="text-[14px] font-medium text-text-primary mb-2.5 truncate">{item.title}</div>
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-[11px] text-text-muted mb-px">Price</div>
                            <div className="text-[14px] font-medium text-text-primary font-mono">
                              {Number(item.streamPrice) > 0 ? formatSui(Number(item.streamPrice)) : 'Free'}
                            </div>
                          </div>
                        </div>
                      </div>
                    </Link>
                  );
                })
              )}
            </div>
          </section>
        )}

        {/* ─── LATEST CONTENT ─── */}
        <section className="pb-[5rem]">
          <div className="flex items-end justify-between mb-[2.5rem]">
            <div>
              <div className="text-[12px] font-medium text-text-muted tracking-[0.08em] uppercase mb-3">Latest</div>
              <h2 className="text-[1.75rem] font-medium text-text-primary tracking-[-0.015em] mb-0">Latest content</h2>
            </div>
            <Link href="/explore" className="inline-flex items-center gap-1.5 font-medium text-[13px] px-[14px] py-[6px] rounded-[10px] bg-surface text-text-primary border border-border hover:bg-bg transition-all leading-none">
              View all
            </Link>
          </div>

          <div className="scroll-row pb-2">
            {isLoading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="shrink-0 bg-surface border border-border rounded-[14px] overflow-hidden" style={{ width: 280 }}>
                    <div className="skeleton h-[140px] w-full" />
                    <div className="p-4 space-y-2">
                      <div className="skeleton h-4 w-3/4 rounded" />
                      <div className="skeleton h-3 w-1/2 rounded" />
                    </div>
                  </div>
                ))
              : trending.length === 0 ? (
                  <div className="w-full text-center py-12">
                    <Star className="w-12 h-12 mx-auto mb-3 text-text-muted opacity-20" />
                    <p className="text-[14px] text-text-secondary">No content yet — be the first to publish!</p>
                    <Link href="/create" className="inline-flex items-center gap-1.5 font-medium text-[14px] px-[18px] py-[8px] rounded-[10px] bg-primary text-white border border-primary hover:bg-primary-hover transition-all leading-none mt-4">
                      Create content
                    </Link>
                  </div>
                )
              : trending.map((item) => {
                  const typeKey = getTypeKey(item.contentType);
                  return (
                    <Link
                      key={item.contentId}
                      href={`/content/${item.contentId}`}
                      className="shrink-0 bg-surface border border-border rounded-[14px] overflow-hidden hover:border-primary transition-colors"
                      style={{ width: 280 }}
                    >
                      <div className="relative h-[140px] bg-bg border-b border-border flex items-center justify-center">
                        {item.previewUrl && item.contentType.startsWith('image/') ? (
                          <img src={item.previewUrl} alt={item.title} className="w-full h-full object-cover" />
                        ) : (
                          <div className="flex flex-col items-center gap-2">
                            {getTypeIcon(typeKey)}
                          </div>
                        )}
                        <span className="absolute top-[10px] left-[10px] text-[11px] font-medium px-[8px] py-[3px] rounded-full bg-primary-light text-primary">
                          {getTypeLabel(typeKey)}
                        </span>
                      </div>
                      <div className="p-4">
                        <div className="flex items-center gap-1.5 mb-2">
                          <div className="w-[20px] h-[20px] rounded-full bg-primary-light border border-border flex items-center justify-center text-[9px] font-medium text-primary">
                            {item.creator.slice(2, 4).toUpperCase()}
                          </div>
                          <span className="text-[12px] text-text-muted">{formatAddress(item.creator)}</span>
                        </div>
                        <h3 className="text-[14px] font-medium text-text-primary mb-2 truncate">{item.title}</h3>
                        <div className="flex items-center justify-between pt-2 border-t border-border">
                          <span className="text-[11px] text-text-muted">From</span>
                          <span className="text-[14px] font-medium text-primary font-mono">
                            {Number(item.streamPrice) > 0 ? formatSui(Number(item.streamPrice)) : 'Free'}
                          </span>
                        </div>
                      </div>
                    </Link>
                  );
                })}
          </div>
        </section>

        {/* ─── BROWSE BY TAG ─── */}
        <section className="pb-[5rem]">
          <div className="mb-[2.5rem]">
            <div className="text-[12px] font-medium text-text-muted tracking-[0.08em] uppercase mb-3">Discover</div>
            <h2 className="text-[1.75rem] font-medium text-text-primary tracking-[-0.015em] mb-0">Browse by tag</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {TRENDING_TAGS.map(tag => (
              <Link
                key={tag}
                href={`/explore?tag=${tag}`}
                className="px-4 py-2 rounded-full text-[13px] font-medium bg-surface text-text-secondary border border-border hover:border-primary hover:text-text-primary transition-all"
              >
                #{tag}
              </Link>
            ))}
          </div>
        </section>

      </div>
    </div>
  );
}
