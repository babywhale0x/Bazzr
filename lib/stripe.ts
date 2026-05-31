import Stripe from 'stripe';
import { suiToMist, suiClient } from './sui';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

export async function createFiatOnrampIntent(
  amountUsd: number,
  walletAddress: string,
  userId: string
) {
  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(amountUsd * 100), // Convert to cents
    currency: 'usd',
    automatic_payment_methods: { enabled: true },
    metadata: {
      walletAddress,
      userId,
      type: 'wallet_funding',
    },
  });

  return {
    clientSecret: paymentIntent.client_secret,
    paymentIntentId: paymentIntent.id,
  };
}

export async function handleWebhook(payload: string, signature: string) {
  const event = stripe.webhooks.constructEvent(
    payload,
    signature,
    process.env.STRIPE_WEBHOOK_SECRET!
  );

  if (event.type === 'payment_intent.succeeded') {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;
    const { walletAddress, userId, type } = paymentIntent.metadata;

    if (type === 'wallet_funding') {
      // Convert USD to SUI
      const suiAmount = await convertUsdToSui(paymentIntent.amount / 100);

      // Fund user wallet
      await fundUserWallet(walletAddress, suiAmount);

      // Update database
      await updateUserStorageBalance(userId, suiAmount);
    }
  }

  return event;
}

async function convertUsdToSui(usdAmount: number): Promise<number> {
  // Fetch SUI price from CoinGecko or similar
  try {
    const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=sui&vs_currencies=usd');
    const data = await response.json();
    const suiPrice = data.sui.usd;
    const suiAmount = usdAmount / suiPrice;
    return suiToMist(suiAmount);
  } catch (e) {
    // Fallback if price fetch fails
    return suiToMist(usdAmount); 
  }
}

async function fundUserWallet(address: string, amountMist: number) {
  const { Transaction } = await import('@mysten/sui/transactions');
  const { Ed25519Keypair } = await import('@mysten/sui/keypairs/ed25519');
  const { decodeSuiPrivateKey } = await import('@mysten/sui/cryptography');

  const privKey = process.env.TREASURY_PRIVATE_KEY;
  if (!privKey) return; // Mocking the fund if treasury isn't set up

  try {
    const decoded = decodeSuiPrivateKey(privKey);
    const treasuryKeypair = Ed25519Keypair.fromSecretKey(decoded.secretKey);

    const tx = new Transaction();
    const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(amountMist)]);
    tx.transferObjects([coin], tx.pure.address(address));

    const result = await suiClient.signAndExecuteTransaction({
      signer: treasuryKeypair,
      transaction: tx,
    });
    await suiClient.waitForTransaction({ digest: result.digest });
  } catch (e) {
    console.error('Failed to fund user wallet:', e);
  }
}

async function updateUserStorageBalance(userId: string, amountMist: number) {
  const { prisma } = await import('./db');

  await prisma.storageBalance.update({
    where: { userId },
    data: {
      walletBalance: {
        increment: amountMist / 1_000_000_000, // Convert to SUI for storage
      },
    },
  });
}

export { stripe };
