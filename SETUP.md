# Verixa Setup Guide

This guide will walk you through setting up Verixa on Aptos Testnet.

## Prerequisites

- Node.js 18+ and npm
- PostgreSQL database
- Aptos CLI installed
- Git

## Step 1: Install Dependencies

```bash
npm install
```

## Step 2: Set Up Environment Variables

```bash
cp .env.example .env.local
```

Edit `.env.local` with your values:

### Required Variables

```env
# Aptos Configuration
NEXT_PUBLIC_APTOS_NETWORK=testnet
NEXT_PUBLIC_VERIXA_MODULE_ADDRESS=  # Will be set after deployment

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/verixa

# Authentication
JWT_SECRET=your-super-secret-jwt-key-min-32-characters-long
ENCRYPTION_KEY=your-encryption-key-for-file-keys
```

### Optional Variables (for Fiat Onramp)

```env
# Stripe
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Treasury wallet for fiat conversions
TREASURY_PRIVATE_KEY=your-treasury-wallet-private-key
```

## Step 3: Set Up Database

### Option A: Local PostgreSQL

```bash
# Create database
createdb verixa

# Run migrations
npx prisma migrate dev --name init

# Generate client
npx prisma generate
```

### Option B: Supabase (Recommended for production)

1. Create a project at https://supabase.com
2. Get your connection string from Settings > Database
3. Update `DATABASE_URL` in `.env.local`

## Step 4: Deploy Smart Contracts

### 4.1 Initialize Aptos CLI

```bash
# Install Aptos CLI if not already installed
# https://aptos.dev/tools/aptos-cli/use-cli/on-chain/

# Initialize
aptos init --network testnet

# This creates a .aptos/config.yaml file with your account
```

### 4.2 Fund Your Account

```bash
# Fund with testnet APT
aptos account fund-with-faucet --account default

# Check balance
aptos account list --query balance
```

### 4.3 Update Contract Configuration

Edit `contracts/Move.toml`:

```toml
[addresses]
verixa = "YOUR_ADDRESS_HERE"  # Replace with your address from .aptos/config.yaml
```

### 4.4 Compile and Deploy

```bash
# Compile
aptos move compile --package-dir contracts --named-addresses verixa=YOUR_ADDRESS

# Publish
aptos move publish --package-dir contracts --named-addresses verixa=YOUR_ADDRESS
```

### 4.5 Save Contract Address

After successful deployment, update `.env.local`:

```env
NEXT_PUBLIC_VERIXA_MODULE_ADDRESS=YOUR_ADDRESS
```

## Step 5: Run the Application

```bash
# Development mode
npm run dev

# Open http://localhost:3000
```

## Step 6: Test the Features

### 1. Connect Wallet
- Click "Connect Wallet" in the header
- Use Petra Wallet or Aptos Connect

### 2. Fund Your Wallet
- Go to Wallet tab
- Click "Add Funds"
- Use testnet faucet or Stripe (if configured)

### 3. Upload Files to Vault
- Go to Vault tab
- Drag and drop files or click to browse
- Files are encrypted and stored on Shelby

### 4. Publish Content
- Go to Create tab
- Upload a file
- Set pricing tiers
- Publish to marketplace

### 5. Purchase Content
- Go to Explore tab
- Find content you like
- Click purchase and confirm transaction

## Troubleshooting

### "Insufficient balance" error
```bash
# Fund your account
aptos account fund-with-faucet --account default
```

### Database connection errors
- Verify PostgreSQL is running
- Check DATABASE_URL format
- Ensure database exists

### Contract deployment fails
- Check you have enough APT (at least 0.5 APT)
- Verify Move.toml address is correct
- Ensure you're on testnet

### Wallet connection issues
- Install Petra Wallet extension
- Or use Aptos Connect (social login)
- Check browser console for errors

## Production Deployment

### 1. Deploy Database
Use a managed PostgreSQL service like:
- Supabase
- Railway
- AWS RDS
- Google Cloud SQL

### 2. Deploy Frontend

**Vercel (Recommended):**
```bash
npm install -g vercel
vercel --prod
```

**Environment Variables on Vercel:**
- Add all variables from `.env.local`
- Set `NEXT_PUBLIC_APTOS_NETWORK=mainnet` for production

### 3. Deploy Contracts to Mainnet

```bash
# Ensure you have mainnet APT
aptos move publish --package-dir contracts --named-addresses verixa=YOUR_ADDRESS --network mainnet
```

### 4. Configure Stripe Webhook

1. In Stripe Dashboard, add webhook endpoint: `https://yourdomain.com/api/stripe/webhook`
2. Select events: `payment_intent.succeeded`
3. Copy webhook secret to `STRIPE_WEBHOOK_SECRET`

## Architecture Overview

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Next.js   │────▶│   Aptos     │────▶│    Move     │
│   Frontend  │     │  Blockchain │     │  Contracts  │
└─────────────┘     └─────────────┘     └─────────────┘
       │
       ▼
┌─────────────┐     ┌─────────────┐
│  PostgreSQL │     │   Shelby    │
│  (Metadata) │     │  (Storage)  │
└─────────────┘     └─────────────┘
```

## Support

For issues and questions:
- Open an issue on GitHub
- Join our Discord community
- Check Aptos documentation: https://aptos.dev
