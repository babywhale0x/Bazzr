'use client';

import { useCurrentAccount, useDisconnectWallet, useConnectWallet, useWallets } from '@mysten/dapp-kit';
import { useState, useRef, useEffect } from 'react';
import { Wallet, ChevronDown, LogOut, Copy, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';

export function ConnectButton() {
  const account = useCurrentAccount();
  const { mutate: disconnect } = useDisconnectWallet();
  const { mutate: connect } = useConnectWallet();
  const wallets = useWallets();

  const [showDropdown, setShowDropdown] = useState(false);
  const [showWalletPicker, setShowWalletPicker] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
        setShowWalletPicker(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const copyAddress = () => {
    if (account?.address) {
      navigator.clipboard.writeText(account.address);
      toast.success('Address copied!');
      setShowDropdown(false);
    }
  };

  if (account) {
    return (
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className="flex items-center gap-2 px-4 py-2 bg-surface border border-border rounded-lg hover:bg-bg transition-colors"
        >
          <div className="w-2 h-2 bg-success rounded-full" />
          <span className="font-medium text-text-primary">
            {formatAddress(account.address)}
          </span>
          <ChevronDown className="w-4 h-4 text-text-secondary" />
        </button>

        {showDropdown && (
          <div className="absolute right-0 mt-2 w-56 bg-surface border border-border rounded-xl  z-50 overflow-hidden">
            <div className="px-4 py-3 bg-bg border-b border-border">
              <p className="text-xs text-text-secondary">Connected wallet</p>
              <p className="text-sm font-mono font-medium text-text-primary truncate">
                {account.address.slice(0, 16)}...
              </p>
            </div>
            <div className="p-1">
              <button
                onClick={copyAddress}
                className="flex items-center gap-3 w-full px-3 py-2 text-sm text-left hover:bg-bg rounded-lg transition-colors"
              >
                <Copy className="w-4 h-4 text-text-secondary" />
                <span>Copy Address</span>
              </button>
              <a
                href={`https://suiscan.xyz/testnet/account/${account.address}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 w-full px-3 py-2 text-sm text-left hover:bg-bg rounded-lg transition-colors"
                onClick={() => setShowDropdown(false)}
              >
                <ExternalLink className="w-4 h-4 text-text-secondary" />
                <span>View on Explorer</span>
              </a>
              <div className="border-t border-border my-1" />
              <button
                onClick={() => { disconnect(); setShowDropdown(false); }}
                className="flex items-center gap-3 w-full px-3 py-2 text-sm text-left hover:bg-red-50 dark:hover:bg-red-950/30 text-red-600 dark:text-red-400 rounded-lg transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span>Disconnect</span>
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setShowWalletPicker(!showWalletPicker)}
        className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors font-medium"
      >
        <Wallet className="w-4 h-4" />
        <span>Connect wallet</span>
        <ChevronDown className="w-4 h-4" />
      </button>

      {showWalletPicker && (
        <div className="absolute right-0 mt-2 w-64 bg-surface border border-border rounded-xl  z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <p className="font-medium text-text-primary">Connect a wallet</p>
            <p className="text-xs text-text-secondary mt-0.5">Choose your preferred wallet</p>
          </div>
          <div className="p-2">
            {wallets && wallets.length > 0 ? (
              wallets.map((wallet) => (
                <button
                  key={wallet.name}
                  onClick={() => { connect({ wallet }); setShowWalletPicker(false); }}
                  className="flex items-center gap-3 w-full px-3 py-3 text-left hover:bg-bg rounded-lg transition-colors"
                >
                  {wallet.icon ? (
                    <img src={wallet.icon} alt={wallet.name} className="w-8 h-8 rounded-lg" />
                  ) : (
                    <div className="w-8 h-8 bg-primary-light rounded-lg flex items-center justify-center">
                      <Wallet className="w-4 h-4 text-text-primary" />
                    </div>
                  )}
                  <div>
                    <p className="font-medium text-text-primary">{wallet.name}</p>
                    <p className="text-xs text-text-secondary">
                      Available
                    </p>
                  </div>
                </button>
              ))
            ) : (
              <div className="px-3 py-4 text-center text-sm text-text-secondary">
                <p>No wallets detected.</p>
                <a
                  href="https://suiwallet.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-text-primary hover:underline mt-1 block"
                >
                  Install Sui Wallet
                </a>
              </div>
            )}
          </div>
          <div className="px-4 py-3 bg-bg border-t border-border">
            <p className="text-xs text-text-secondary text-center">
              Powered by Sui • Testnet
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
