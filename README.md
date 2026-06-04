# Bazzr

A decentralized storage, content monetization, and creator marketplace platform built on the **Sui Network** and **Walrus Protocol**.

## Features

- **Permanent Decentralized Storage**: Files are split, erasure-coded, and stored dynamically on the Walrus decentralized network.
- **Creator Marketplace**: Publish, manage, and monetize creative content.
- **Multiple Access Tiers**: Stream (In-App), Cite (On-Chain Reference), License (Local Use), and Commercial Rights.
- **Direct & Secure Payments**: Direct peer-to-peer payments on-chain with minimal platform fees.
- **Encrypted Vault**: Private client-side encrypted storage for your personal files.
- **On-Chain Certificates**: One-click verification of license agreements, content ownership, and transactions on the Sui and Walrus explorers.

## Tech Stack & Integrations

- **Frontend**: Next.js 14 (App Router), React, TypeScript, Vanilla CSS
- **Blockchain Interface & RPC**: **Tatum Gateway** (Sui RPC)
- **Decentralized Storage**: **Walrus Protocol**
- **Database**: PostgreSQL with Prisma ORM (Supabase)
- **Payments**: Stripe (Fiat Onramp)
- **Wallet Standard**: `@mysten/dapp-kit`

### 1. Tatum Integration
Bazzr integrates Tatum APIs at multiple levels to ensure robust blockchain connectivity and rich user dashboards:
- **Tatum Sui RPC Gateway**: Server-side client calls route directly through Tatum's high-speed endpoints (`https://sui-testnet.gateway.tatum.io`).
- **Secure RPC Proxy**: The frontend interacts with Sui wallets through a custom browser proxy endpoint `/api/sui-rpc` which forwards requests to Tatum. This hides the Tatum API key and prevents client-side CORS issues.
- **Tatum Exchange Rate API**: Hits Tatum's `/v3/tatum/rate/SUI` Data API endpoint via `/api/tatum/exchange-rate` to calculate and display the live fiat USD value of the user's SUI balance on their profile dashboard.
- **Tatum Transaction API**: Uses Tatum RPC (`suix_queryTransactionBlocks`) via `/api/tatum/transactions` to query and display the user's incoming and outgoing transaction history dynamically.

### 2. Walrus Protocol Integration
Files are stored securely and permanently using Walrus:
- **Client-Side Encryption**: Files uploaded to the Vault or Creator Marketplace are encrypted locally using symmetric AES-256-GCM before upload, keeping content private.
- **Walrus Publisher Integration**: Uploads the encrypted blob payload directly to the Walrus network, registering it on-chain and returning a unique `blobId`.
- **Walrus Aggregator Fallbacks**: Fetches and decodes content dynamically via proxy `/api/download/[blobId]`. Leverages reliable testnet aggregators (like `staketab.org`) to work around TLS incompatibilities in standard Node.js clients.
- **Storage Fee Tracking**: Retrieves actual Walrus storage cost and epoch expiry values to display storage usage and file expiration statistics inside the user dashboard.

## Quick Start

### 1. Clone and Install

```bash
git clone https://github.com/babywhale0x/Bazzr.git
cd Bazzr
npm install
```

### 2. Environment Setup

Copy `.env.example` to create your local env file:

```bash
cp .env.example .env.local
```

Edit `.env.local` with your credentials:

```env
# Sui Network
SUI_NETWORK=testnet
NEXT_PUBLIC_SUI_NETWORK=testnet
NEXT_PUBLIC_VERIXA_PACKAGE_ID=your_deployed_sui_package_id

# Walrus & Tatum API (for Sui JSON-RPC gateway)
TATUM_SUI_API_KEY=your_tatum_api_key
SUI_PRIVATE_KEY=suiprivkey_your_server_signing_key
WALRUS_PUBLISHER_URL=https://publisher.walrus-testnet.walrus.space
WALRUS_AGGREGATOR_URL=https://aggregator.walrus-testnet.walrus.space
NEXT_PUBLIC_WALRUS_PUBLISHER_URL=https://publisher.walrus-testnet.walrus.space

# Database (PostgreSQL / Supabase)
DATABASE_URL=postgres://[db-user]:[password]@aws-0-region.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1
DIRECT_URL=postgres://[db-user]:[password]@aws-0-region.pooler.supabase.com:5432/postgres

# Authentication
JWT_SECRET=your-secret-min-32-chars
ENCRYPTION_KEY=your-encryption-key
```

### 3. Database Setup

Ensure your database migrations are applied:

```bash
# Run migrations
npx prisma db push

# Generate Prisma client
npx prisma generate

# Seed initial categories and mockup data
npm run db:seed
```

### 4. Deploy Smart Contracts (Sui Testnet)

Sui Move contracts are located in `sui_contracts/marketplace`.

```bash
# Compile and build the package
cd sui_contracts/marketplace
sui client build

# Publish to testnet
sui client publish --gas-budget 200000000

# Update NEXT_PUBLIC_VERIXA_PACKAGE_ID in your env with the deployed package ID
```

### 5. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
Bazzr/
├── app/                    # Next.js app router pages & endpoints
│   ├── api/               # API endpoints (decryption, profile, storage, stripe)
│   ├── (tabs)/            # Main app tabs (home, explore, create, vault, profile)
│   └── ...
├── components/            # Shared React components (CertificateModal, FiatOnramp, etc.)
│   ├── wallet/           # Sui Dapp Kit wallet providers and connect buttons
│   └── ...
├── sui_contracts/         # Sui Move smart contracts
│   └── marketplace/      # Move package files
├── lib/                  # Backend and utility libraries
│   ├── sui.ts            # Sui client setup & RPC helpers
│   ├── walrus.ts         # Walrus client & publisher/aggregator interface
│   ├── auth.ts           # JWT and symmetric key decryption authorizations
│   └── db/               # Prisma database client
├── scripts/             # Native build scripts & WASM copy steps
└── prisma/              # Prisma Database schema definitions
```

## Smart Contracts (Sui Move)

### Marketplace Contract (`sui_contracts/marketplace/sources/marketplace.move`)
- `publish_content`: Register new digital items with specific tier-based access rights and pricing.
- `purchase_access`: Process a purchase transaction, routing SUI directly to the creator while locking in license credentials.
- `claim_earnings`: Safe extraction of accrued fees and sales directly to wallets.

## License

MIT License - see LICENSE file for details.
