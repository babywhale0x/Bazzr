'use client';
import Link from 'next/link';
import { ConnectButton } from '@/components/wallet/ConnectButton';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { MatrixText } from '@/components/ui/MatrixText';
import { motion } from 'framer-motion';
import { Layers, Zap, ShieldCheck, Music, Image as ImageIcon, Video, FileText, CheckCircle2, AlertCircle, Info, UploadCloud } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-bg text-text-secondary font-sans leading-[1.6]">
      {/* NAV */}
      <nav className="bg-surface border-b border-border sticky top-0 z-[100]">
        <div className="max-w-[1440px] mx-auto px-8 w-full h-[60px] flex items-center justify-between">
          <Link href="/" className="text-[17px] font-medium text-text-primary tracking-[-0.01em]">
            Veri<span className="text-primary">xa</span>
          </Link>
          <ul className="hidden md:flex items-center gap-8 list-none">
            <li><Link href="/explore" className="text-[14px] font-medium text-text-primary transition-colors">Explore</Link></li>
            <li><Link href="/vault" className="text-[14px] text-text-secondary hover:text-text-primary transition-colors">Vault</Link></li>
            <li><Link href="/create" className="text-[14px] text-text-secondary hover:text-text-primary transition-colors">Create</Link></li>
          </ul>
          <div className="flex items-center gap-2.5">
            <ThemeToggle />
            <ConnectButton />
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="pt-[6rem] pb-[5rem]">
        <div className="max-w-[1440px] mx-auto px-8">
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="inline-flex items-center gap-1.5 text-[12px] font-medium text-primary bg-primary-light px-3 py-1 rounded-full mb-6 tracking-[0.02em] before:content-[''] before:w-1.5 before:h-1.5 before:rounded-full before:bg-primary before:inline-block"
          >
            Built on Sui & Walrus
          </motion.div>
          <h1 className="text-[clamp(2rem,4vw,3rem)] font-medium text-text-primary leading-[1.2] tracking-[-0.02em] max-w-[560px] mb-5">
            <MatrixText text="Your files." delay={0} /><br/>
            <MatrixText text="Your earnings." delay={0.6} />
          </h1>
          <motion.p 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.2, duration: 0.5 }}
            className="text-[16px] text-text-secondary max-w-[480px] mb-8 leading-[1.7]"
          >
            Decentralized storage meets creator marketplace. Store files permanently, publish creative work, and earn directly to your wallet.
          </motion.p>
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.6, duration: 0.5 }}
            className="flex gap-2.5 items-center"
          >
            <Link href="/vault" className="inline-flex items-center gap-1.5 font-medium text-[14px] px-[18px] py-[8px] rounded-[10px] bg-primary text-white border border-primary hover:bg-primary-hover hover:border-primary-hover transition-all leading-none">
              Start storing
            </Link>
            <Link href="/explore" className="inline-flex items-center gap-1.5 font-medium text-[14px] px-[18px] py-[8px] rounded-[10px] bg-surface text-text-primary border border-border hover:bg-bg transition-all leading-none">
              Explore creators
            </Link>
          </motion.div>
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.8, duration: 0.5 }}
            className="mt-[3rem] flex items-center gap-8"
          >
            <div className="flex flex-col gap-[2px]">
              <span className="text-[18px] font-medium text-text-primary tracking-[-0.01em]">14,200+</span>
              <span className="text-[12px] text-text-muted">Active creators</span>
            </div>
            <div className="w-[1px] h-[32px] bg-border"></div>
            <div className="flex flex-col gap-[2px]">
              <span className="text-[18px] font-medium text-text-primary tracking-[-0.01em]">90%</span>
              <span className="text-[12px] text-text-muted">Earnings to creators</span>
            </div>
            <div className="w-[1px] h-[32px] bg-border"></div>
            <div className="flex flex-col gap-[2px]">
              <span className="text-[18px] font-medium text-text-primary tracking-[-0.01em]">∞</span>
              <span className="text-[12px] text-text-muted">Permanent storage</span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* STATS BAND */}
      <div className="py-[3rem] px-8">
        <div className="max-w-[1440px] mx-auto bg-surface border border-border rounded-[24px] py-[3rem] px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="text-[28px] font-medium text-text-primary tracking-[-0.02em] mb-1">2.4<span className="text-primary">M</span></div>
              <div className="text-[13px] text-text-muted">Files stored</div>
            </div>
            <div className="text-center">
              <div className="text-[28px] font-medium text-text-primary tracking-[-0.02em] mb-1">840<span className="text-primary">K</span></div>
              <div className="text-[13px] text-text-muted">APT distributed</div>
            </div>
            <div className="text-center">
              <div className="text-[28px] font-medium text-text-primary tracking-[-0.02em] mb-1">99<span className="text-primary">.9%</span></div>
              <div className="text-[13px] text-text-muted">Uptime</div>
            </div>
            <div className="text-center">
              <div className="text-[28px] font-medium text-text-primary tracking-[-0.02em] mb-1">7,200</div>
              <div className="text-[13px] text-text-muted">Active nodes</div>
            </div>
          </div>
        </div>
      </div>

      {/* FEATURES */}
      <section className="py-[5rem]">
        <div className="max-w-[1440px] mx-auto px-8">
          <div className="mb-[2.5rem]">
            <div className="text-[12px] font-medium text-text-muted tracking-[0.08em] uppercase mb-3">Why Verixa</div>
            <h2 className="text-[1.75rem] font-medium text-text-primary tracking-[-0.015em] mb-3">Infrastructure for the creator economy</h2>
            <p className="text-[15px] text-text-secondary max-w-[480px] leading-[1.7] mb-12">Everything you need to store, share, and monetize creative work — without trusting a platform.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-[1px] bg-border border border-border rounded-[14px] overflow-hidden">
            <div className="bg-surface p-8">
              <div className="w-[36px] h-[36px] rounded-[6px] bg-primary-light flex items-center justify-center mb-5">
                <Layers className="w-[18px] h-[18px] text-primary" strokeWidth={1.75} />
              </div>
              <h3 className="text-[15px] font-medium text-text-primary mb-2">Permanent storage</h3>
              <p className="text-[14px] text-text-secondary leading-[1.65]">Files are distributed across thousands of nodes via Walrus — no single point of failure, no takedowns.</p>
            </div>
            <div className="bg-surface p-8">
              <div className="w-[36px] h-[36px] rounded-[6px] bg-primary-light flex items-center justify-center mb-5">
                <Zap className="w-[18px] h-[18px] text-primary" strokeWidth={1.75} />
              </div>
              <h3 className="text-[15px] font-medium text-text-primary mb-2">Instant earnings</h3>
              <p className="text-[14px] text-text-secondary leading-[1.65]">90% of every sale goes directly to your wallet. No holding periods, no withdrawal requests, no middlemen.</p>
            </div>
            <div className="bg-surface p-8">
              <div className="w-[36px] h-[36px] rounded-[6px] bg-primary-light flex items-center justify-center mb-5">
                <ShieldCheck className="w-[18px] h-[18px] text-primary" strokeWidth={1.75} />
              </div>
              <h3 className="text-[15px] font-medium text-text-primary mb-2">Uncensorable</h3>
              <p className="text-[14px] text-text-secondary leading-[1.65]">Content hash-committed on Sui blockchain. No platform can take down your work or freeze your earnings.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CONTENT TYPES */}
      <section className="pb-[5rem]">
        <div className="max-w-[1440px] mx-auto px-8">
          <div className="mb-[2.5rem]">
            <div className="text-[12px] font-medium text-text-muted tracking-[0.08em] uppercase mb-3">Content types</div>
            <h2 className="text-[1.75rem] font-medium text-text-primary tracking-[-0.015em] mb-3">Support for all file types</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Link href="/explore?type=audio" className="bg-surface border border-border rounded-[14px] px-5 py-6 text-center cursor-pointer hover:border-primary hover:shadow-[0_0_0_3px_var(--color-primary-light)] transition-all">
              <div className="w-[44px] h-[44px] rounded-[10px] bg-bg border border-border flex items-center justify-center mx-auto mb-4">
                <Music className="w-[20px] h-[20px] text-text-secondary" strokeWidth={1.5} />
              </div>
              <h4 className="text-[14px] font-medium text-text-primary mb-1">Music</h4>
              <p className="text-[12px] text-text-muted">MP3, WAV, FLAC</p>
            </Link>
            <Link href="/explore?type=image" className="bg-surface border border-border rounded-[14px] px-5 py-6 text-center cursor-pointer hover:border-primary hover:shadow-[0_0_0_3px_var(--color-primary-light)] transition-all">
              <div className="w-[44px] h-[44px] rounded-[10px] bg-bg border border-border flex items-center justify-center mx-auto mb-4">
                <ImageIcon className="w-[20px] h-[20px] text-text-secondary" strokeWidth={1.5} />
              </div>
              <h4 className="text-[14px] font-medium text-text-primary mb-1">Photos</h4>
              <p className="text-[12px] text-text-muted">JPG, PNG, RAW</p>
            </Link>
            <Link href="/explore?type=video" className="bg-surface border border-border rounded-[14px] px-5 py-6 text-center cursor-pointer hover:border-primary hover:shadow-[0_0_0_3px_var(--color-primary-light)] transition-all">
              <div className="w-[44px] h-[44px] rounded-[10px] bg-bg border border-border flex items-center justify-center mx-auto mb-4">
                <Video className="w-[20px] h-[20px] text-text-secondary" strokeWidth={1.5} />
              </div>
              <h4 className="text-[14px] font-medium text-text-primary mb-1">Video</h4>
              <p className="text-[12px] text-text-muted">MP4, MOV, MKV</p>
            </Link>
            <Link href="/explore?type=document" className="bg-surface border border-border rounded-[14px] px-5 py-6 text-center cursor-pointer hover:border-primary hover:shadow-[0_0_0_3px_var(--color-primary-light)] transition-all">
              <div className="w-[44px] h-[44px] rounded-[10px] bg-bg border border-border flex items-center justify-center mx-auto mb-4">
                <FileText className="w-[20px] h-[20px] text-text-secondary" strokeWidth={1.5} />
              </div>
              <h4 className="text-[14px] font-medium text-text-primary mb-1">Documents</h4>
              <p className="text-[12px] text-text-muted">PDF, DOCX, MD</p>
            </Link>
          </div>
        </div>
      </section>

      {/* MARKETPLACE PREVIEW */}
      <section className="pb-[5rem]">
        <div className="max-w-[1440px] mx-auto px-8">
          <div className="flex items-end justify-between mb-[2.5rem]">
            <div>
              <div className="text-[12px] font-medium text-text-muted tracking-[0.08em] uppercase mb-3">Marketplace</div>
              <h2 className="text-[1.75rem] font-medium text-text-primary tracking-[-0.015em] mb-0">Trending listings</h2>
            </div>
            <Link href="/explore" className="inline-flex items-center gap-1.5 font-medium text-[13px] px-[14px] py-[6px] rounded-[10px] bg-surface text-text-primary border border-border hover:bg-bg transition-all leading-none">View all</Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { id: 1, type: 'Music', title: 'Ambient set 01 — generative textures', creator: '@soundbyte', price: '4.2', icon: Music, avatar: 'SB', file: 'ambient-set-01.wav' },
              { id: 2, type: 'Photos', title: 'Urban series no. 12 — Lagos at dusk', creator: '@lensvault', price: '1.8', icon: ImageIcon, avatar: 'LV', file: 'urban-series-12.raw' },
              { id: 3, type: 'Video', title: 'Short doc — ep. 2: Decentralized futures', creator: '@framerio', price: '9.0', icon: Video, avatar: 'FR', file: 'short-doc-ep2.mp4' },
            ].map((item) => (
              <div key={item.id} className="bg-surface border border-border rounded-[14px] overflow-hidden hover:border-primary transition-colors cursor-pointer">
                <div className="h-[160px] bg-bg border-b border-border flex items-center justify-center relative">
                  <div className="flex flex-col items-center gap-2">
                    <item.icon className="w-[32px] h-[32px] text-text-muted" strokeWidth={1.25} />
                    <span className="text-[11px] text-text-muted font-mono">{item.file}</span>
                  </div>
                  <span className="absolute top-[10px] left-[10px] text-[11px] font-medium px-[8px] py-[3px] rounded-full bg-primary-light text-primary">{item.type}</span>
                </div>
                <div className="p-4 md:p-5">
                  <div className="flex items-center gap-1.5 mb-2">
                    <div className="w-[20px] h-[20px] rounded-full bg-primary-light border border-border flex items-center justify-center text-[9px] font-medium text-primary">{item.avatar}</div>
                    <span className="text-[12px] text-text-muted">{item.creator}</span>
                  </div>
                  <div className="text-[14px] font-medium text-text-primary mb-2.5 truncate">{item.title}</div>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[11px] text-text-muted mb-px">Price</div>
                      <div className="text-[14px] font-medium text-text-primary font-mono">{item.price} APT</div>
                    </div>
                    <button className="inline-flex items-center gap-1.5 font-medium text-[13px] px-[14px] py-[6px] rounded-[10px] bg-primary text-white border border-primary hover:bg-primary-hover transition-all leading-none">Buy now</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* UPLOAD + TABLE */}
      <section className="pb-[5rem]">
        <div className="max-w-[1440px] mx-auto px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
            {/* Upload zone */}
            <div>
              <div className="text-[12px] font-medium text-text-muted tracking-[0.08em] uppercase mb-3">Vault</div>
              <h2 className="text-[1.75rem] font-medium text-text-primary tracking-[-0.015em] mb-3">Store a file</h2>
              <p className="text-[14px] text-text-secondary leading-[1.7] mb-6">Drop any file — it gets pinned permanently across the Walrus network.</p>
              <div className="border-[1.5px] border-dashed border-border rounded-[14px] p-12 text-center bg-surface hover:border-primary hover:bg-bg transition-colors cursor-pointer group">
                <UploadCloud className="w-[32px] h-[32px] text-text-muted mx-auto mb-4 group-hover:text-primary transition-colors" strokeWidth={1.25} />
                <h4 className="text-[14px] font-medium text-text-primary mb-1">Drag & drop your file here</h4>
                <p className="text-[13px] text-text-muted mb-1.5"><strong className="text-primary font-medium">Click to browse</strong> or drag any file type</p>
                <p className="text-[13px] text-text-muted">Max 500 MB per file</p>
              </div>
            </div>

            {/* Recent files table */}
            <div>
              <div className="text-[12px] font-medium text-text-muted tracking-[0.08em] uppercase mb-3">Recent uploads</div>
              <div className="bg-surface border border-border rounded-[14px] overflow-hidden">
                <table className="w-full border-collapse text-[13px] text-left">
                  <thead>
                    <tr>
                      <th className="px-4 py-3 text-[11px] font-medium text-text-muted tracking-[0.06em] uppercase border-b border-border bg-bg">File</th>
                      <th className="px-4 py-3 text-[11px] font-medium text-text-muted tracking-[0.06em] uppercase border-b border-border bg-bg">Size</th>
                      <th className="px-4 py-3 text-[11px] font-medium text-text-muted tracking-[0.06em] uppercase border-b border-border bg-bg">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="hover:bg-bg transition-colors">
                      <td className="px-4 py-3.5 border-b border-border">
                        <span className="font-medium text-text-primary text-[13px]">ambient-set-01.wav</span><br/>
                        <span className="font-mono text-[12px] text-text-muted">baf...3k9x</span>
                      </td>
                      <td className="px-4 py-3.5 border-b border-border text-text-secondary">42 MB</td>
                      <td className="px-4 py-3.5 border-b border-border">
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-[#F0FDF4] text-[#16a34a] border border-[#BBF7D0]">Stored</span>
                      </td>
                    </tr>
                    <tr className="hover:bg-bg transition-colors">
                      <td className="px-4 py-3.5 border-b border-border">
                        <span className="font-medium text-text-primary text-[13px]">urban-series-12.raw</span><br/>
                        <span className="font-mono text-[12px] text-text-muted">b3f...9mq2</span>
                      </td>
                      <td className="px-4 py-3.5 border-b border-border text-text-secondary">118 MB</td>
                      <td className="px-4 py-3.5 border-b border-border">
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-[#F0FDF4] text-[#16a34a] border border-[#BBF7D0]">Stored</span>
                      </td>
                    </tr>
                    <tr className="hover:bg-bg transition-colors">
                      <td className="px-4 py-3.5 border-b border-border">
                        <span className="font-medium text-text-primary text-[13px]">short-doc-ep2.mp4</span><br/>
                        <span className="font-mono text-[12px] text-text-muted">c9a...7rb1</span>
                      </td>
                      <td className="px-4 py-3.5 border-b border-border text-text-secondary">384 MB</td>
                      <td className="px-4 py-3.5 border-b border-border">
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-[#FFFBEB] text-[#b45309] border border-[#FDE68A]">Pinning…</span>
                      </td>
                    </tr>
                    <tr className="hover:bg-bg transition-colors">
                      <td className="px-4 py-3.5">
                        <span className="font-medium text-text-primary text-[13px]">design-tokens-v2.pdf</span><br/>
                        <span className="font-mono text-[12px] text-text-muted">d2e...1hs5</span>
                      </td>
                      <td className="px-4 py-3.5 text-text-secondary">2.1 MB</td>
                      <td className="px-4 py-3.5">
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-primary-light text-primary border border-transparent">Listed</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Alerts */}
              <div className="flex flex-col gap-2.5 mt-3">
                <div className="flex items-start gap-2.5 px-4 py-3 rounded-[10px] border border-[#BBF7D0] bg-[#F0FDF4] text-[#166534] text-[13px]">
                  <div className="w-2 h-2 rounded-full bg-success shrink-0 mt-[4px]"></div>
                  <div>File stored successfully across 7,200+ nodes.</div>
                </div>
                <div className="flex items-start gap-2.5 px-4 py-3 rounded-[10px] border border-[#FDE68A] bg-[#FFFBEB] text-[#92400E] text-[13px]">
                  <div className="w-2 h-2 rounded-full bg-warning shrink-0 mt-[4px]"></div>
                  <div>Wallet not connected — you won't earn from listings until you do.</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA SECTION */}
      <div className="bg-bg py-[5rem] px-8">
        <div className="max-w-[1440px] mx-auto bg-surface border border-border rounded-[24px] py-[4rem] px-8 text-center relative overflow-hidden">
          <div className="relative z-10">
            <h2 className="text-[2rem] font-medium text-text-primary tracking-[-0.02em] mb-4">Ready to get started?</h2>
            <p className="text-[15px] text-text-secondary max-w-[420px] mx-auto mb-8 leading-[1.7]">
              Join thousands of creators already using Verixa for decentralized storage and monetization.
            </p>
            <div className="flex gap-2.5 justify-center">
              <Link href="/vault" className="inline-flex items-center gap-1.5 font-medium text-[14px] px-[18px] py-[8px] rounded-[10px] bg-primary text-white border border-primary hover:bg-primary-hover transition-all leading-none shadow-sm">
                Launch app
              </Link>
              <Link href="/docs" className="inline-flex items-center gap-1.5 font-medium text-[14px] px-[18px] py-[8px] rounded-[10px] bg-surface text-text-primary border border-border hover:bg-bg transition-all leading-none">
                Read the docs
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <footer className="bg-bg py-[2.5rem]">
        <div className="max-w-[1440px] mx-auto px-8">
          <div className="flex items-center justify-between">
            <div className="text-[14px] font-medium text-text-primary">
              Verixa <small className="font-normal text-[12px] text-text-muted ml-2">Built on Sui & Walrus</small>
            </div>
            <ul className="flex gap-6 list-none">
              <li><Link href="/explore" className="text-[13px] text-text-muted hover:text-text-secondary transition-colors">Explore</Link></li>
              <li><Link href="/vault" className="text-[13px] text-text-muted hover:text-text-secondary transition-colors">Vault</Link></li>
              <li><Link href="/docs" className="text-[13px] text-text-muted hover:text-text-secondary transition-colors">Docs</Link></li>
              <li><Link href="/privacy" className="text-[13px] text-text-muted hover:text-text-secondary transition-colors">Privacy</Link></li>
            </ul>
          </div>
        </div>
      </footer>
    </div>
  );
}
