# Verixa Project Summary

## Overview

Verixa is a complete decentralized storage and creator marketplace platform built on **Aptos Testnet** and **Walrus**. It combines permanent decentralized storage with a creator marketplace featuring multiple access tiers and direct wallet-to-wallet payments.

## What Was Built

### 1. Smart Contracts (Move on Aptos)

**marketplace.move** - Core marketplace functionality
- `publish_content`: Publish content with pricing tiers
- `purchase_access`: Buy access to content
- `has_valid_access`: Verify access permissions
- 90/10 split (creator/platform)
- 5 access tiers: View(24h), Borrow(7d), License, Commercial, Subscription

**storage.move** - Decentralized storage management
- `register_user`: Register for storage service
- `fund_wallet`: Add APT to storage balance
- `add_file`: Upload encrypted files
- `process_deductions`: Monthly auto-deduction (0.001 APT/GB/month)
- 30-day grace period for expired balances

**subscription.move** - Creator subscriptions
- `create_subscription_tier`: Set up recurring payments
- `subscribe`: Subscribe to creator
- `has_active_subscription`: Check subscription status

### 2. Frontend (Next.js 14)

**Pages:**
- `/` - Landing page with feature overview
- `/home` - Personalized feed with featured content
- `/explore` - Browse all content with filters
- `/vault` - Personal encrypted storage
- `/create` - Publish content with pricing tiers
- `/wallet` - Balance, transactions, fiat onramp
- `/content/[id]` - Content detail with purchase options
- `/creator/[address]` - Creator profile page

**Components:**
- Wallet connection (Petra + Aptos Connect)
- Fiat onramp (Stripe integration)
- File upload with drag-and-drop
- Media viewers (image, video, audio)
- Tier selection for purchases

### 3. API Routes

- `POST /api/upload` - Initiate Walrus upload
- `POST /api/upload/complete` - Complete upload & encrypt
- `GET /api/download/[blobId]` - Download with watermarking
- `GET /api/storage/files` - List user's files
- `GET /api/storage/status` - Storage stats
- `POST /api/stripe/create-intent` - Create payment intent
- `POST /api/stripe/webhook` - Handle Stripe payments

### 4. Database (PostgreSQL + Prisma)

**Models:**
- User - Wallet-based user accounts
- CreatorProfile - Public creator profiles
- File - Stored file metadata
- Content - On-chain content cache
- Purchase - Purchase records
- Subscription - Subscription records
- StorageBalance - User storage balances

## Key Features Implemented

### ✅ Storage Features
- [x] Encrypted file upload to Walrus
- [x] Private vault for personal files
- [x] Auto-deduction for storage fees
- [x] Grace period management
- [x] File download with decryption

### ✅ Marketplace Features
- [x] Content publishing with multiple tiers
- [x] Direct APT payments (90% to creator)
- [x] Access verification on-chain
- [x] Content discovery and search
- [x] Creator profiles

### ✅ Payment Features
- [x] Wallet-to-wallet APT transfers
- [x] Fiat onramp via Stripe
- [x] Automatic wallet funding
- [x] Transaction history

### ✅ User Experience
- [x] Mobile-responsive design
- [x] Bottom tab navigation
- [x] Toast notifications
- [x] Loading states
- [x] Error handling

## File Structure

```
verixa/
├── contracts/           # Move smart contracts
│   ├── sources/
│   │   ├── marketplace.move
│   │   ├── storage.move
│   │   └── subscription.move
│   └── Move.toml
├── app/                 # Next.js app router
│   ├── (tabs)/         # Main app tabs
│   ├── api/            # API routes
│   ├── content/[id]/   # Content detail
│   └── creator/[address]/ # Creator profile
├── components/          # React components
│   └── wallet/         # Wallet integration
├── lib/                # Utilities
│   ├── aptos.ts       # Aptos config
│   ├── shelby.ts      # Shelby integration
│   ├── stripe.ts      # Stripe integration
│   ├── auth.ts        # Authentication
│   └── db/            # Database
├── scripts/            # Deployment scripts
└── prisma/            # Database schema
```

## Quick Start Commands

```bash
# 1. Install dependencies
npm install

# 2. Set up environment
cp .env.example .env.local
# Edit .env.local with your values

# 3. Set up database
npx prisma migrate dev --name init
npx prisma generate

# 4. Deploy contracts (requires Aptos CLI)
aptos init --network testnet
aptos account fund-with-faucet --account default
# Update contracts/Move.toml with your address
aptos move publish --package-dir contracts --named-addresses verixa=YOUR_ADDRESS

# 5. Update .env.local with deployed address
# NEXT_PUBLIC_VERIXA_MODULE_ADDRESS=YOUR_ADDRESS

# 6. Run the app
npm run dev
```

## Configuration Checklist

Before running, ensure you have:

- [ ] PostgreSQL database running
- [ ] `DATABASE_URL` in `.env.local`
- [ ] `JWT_SECRET` in `.env.local` (min 32 chars)
- [ ] `ENCRYPTION_KEY` in `.env.local`
- [ ] Aptos CLI installed and configured
- [ ] Testnet APT in your wallet
- [ ] Contracts deployed and address saved
- [ ] (Optional) Stripe keys for fiat onramp

## Testing the Platform

### 1. Storage Test
1. Connect wallet
2. Go to Vault tab
3. Upload a file
4. Verify file appears in list
5. Download the file

### 2. Marketplace Test
1. Go to Create tab
2. Upload content file
3. Set pricing tiers
4. Publish content
5. Check transaction on Aptos Explorer

### 3. Purchase Test
1. Switch to different wallet
2. Go to Explore tab
3. Find published content
4. Click purchase
5. Verify access granted

## Deployment Checklist

### Testnet Deployment
- [ ] Contracts deployed to testnet
- [ ] Frontend deployed to Vercel
- [ ] Database migrated
- [ ] Environment variables set
- [ ] Stripe webhook configured (if using)

### Mainnet Deployment (Future)
- [ ] Contracts audited
- [ ] Mainnet APT acquired
- [ ] Contracts deployed to mainnet
- [ ] Frontend updated to mainnet
- [ ] Production database configured

## Next Steps

### Immediate (Testnet)
1. Deploy contracts following SETUP.md
2. Run the application locally
3. Test all features
4. Fix any bugs
5. Deploy to Vercel

### Short Term
1. Add more content types support
2. Implement search functionality
3. Add social features (likes, comments)
4. Create admin dashboard
5. Add analytics for creators

### Long Term
1. Deploy to mainnet
2. Add more wallet support
3. Implement content moderation
4. Add referral program
5. Mobile app (React Native)

## Resources

- **Aptos Docs**: https://aptos.dev
- **Walrus**: https://walrus.space
- **Petra Wallet**: https://petra.app
- **Aptos Explorer**: https://explorer.aptoslabs.com

## Support

For issues:
1. Check SETUP.md for troubleshooting
2. Review error logs
3. Verify environment variables
4. Check Aptos testnet status
5. Open an issue on GitHub

---

**Project Status**: Ready for Testnet Deployment
**Last Updated**: 2026-03-30
**Version**: 1.0.0
