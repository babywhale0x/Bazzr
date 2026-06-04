'use client';

import { createNetworkConfig, SuiClientProvider, WalletProvider as SuiWalletProvider } from '@mysten/dapp-kit';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PropsWithChildren, useState } from 'react';
import '@mysten/dapp-kit/dist/index.css';

// Browser-side: point to our Next.js proxy which forwards to Tatum (avoids CORS)
const { networkConfig } = createNetworkConfig({
  testnet: { url: '/api/sui-rpc', network: 'testnet' },
  mainnet: { url: '/api/sui-rpc', network: 'mainnet' },
});

export function WalletProvider({ children }: PropsWithChildren) {
  const [queryClient] = useState(() => new QueryClient());
  const defaultNetwork = process.env.NEXT_PUBLIC_SUI_NETWORK === 'mainnet' ? 'mainnet' : 'testnet';

  return (
    <QueryClientProvider client={queryClient}>
      <SuiClientProvider networks={networkConfig} defaultNetwork={defaultNetwork as any}>
        <SuiWalletProvider autoConnect>
          {children}
        </SuiWalletProvider>
      </SuiClientProvider>
    </QueryClientProvider>
  );
}