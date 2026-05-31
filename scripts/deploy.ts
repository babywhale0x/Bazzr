import { Aptos, AptosConfig, Network } from '@aptos-labs/ts-sdk';
import * as fs from 'fs';
import * as path from 'path';

const config = new AptosConfig({ network: Network.TESTNET });
const aptos = new Aptos(config);

async function deployContract() {
  // Load private key from environment
  const privateKey = process.env.DEPLOYER_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error('DEPLOYER_PRIVATE_KEY not set');
  }

  // Create deployer account
  const deployer = await aptos.deriveAccountFromPrivateKey({
    privateKey,
  });

  console.log('Deploying from address:', deployer.accountAddress.toString());

  // Check balance
  const balance = await aptos.getAccountAPTAmount({
    accountAddress: deployer.accountAddress,
  });
  console.log('Deployer balance:', balance / 100000000, 'APT');

  if (balance < 100000000) {
    throw new Error('Insufficient balance for deployment');
  }

  // Read Move.toml and update address
  const moveTomlPath = path.join(__dirname, '../contracts/Move.toml');
  let moveToml = fs.readFileSync(moveTomlPath, 'utf8');

  // Replace placeholder with actual address
  moveToml = moveToml.replace(
    'verixa = "_"',
    `verixa = "${deployer.accountAddress.toString()}"`
  );

  fs.writeFileSync(moveTomlPath, moveToml);
  console.log('Updated Move.toml with deployer address');

  // Publish the package
  console.log('Publishing package...');

  // Note: In production, use aptos CLI to publish
  // This is a simplified version
  const transaction = await aptos.publishPackageTransaction({
    account: deployer.accountAddress,
    metadataBytes: fs.readFileSync(path.join(__dirname, '../contracts/build/package-metadata.bcs')),
    moduleBytecode: [
      fs.readFileSync(path.join(__dirname, '../contracts/build/verixa.mv')),
    ],
  });

  const pendingTxn = await aptos.signAndSubmitTransaction({
    signer: deployer,
    transaction,
  });

  const response = await aptos.waitForTransaction({
    transactionHash: pendingTxn.hash,
  });

  console.log('Contract deployed successfully!');
  console.log('Transaction hash:', response.hash);
  console.log('Contract address:', deployer.accountAddress.toString());

  // Save deployment info
  const deploymentInfo = {
    network: 'testnet',
    address: deployer.accountAddress.toString(),
    transactionHash: response.hash,
    timestamp: new Date().toISOString(),
  };

  fs.writeFileSync(
    path.join(__dirname, '../deployment.json'),
    JSON.stringify(deploymentInfo, null, 2)
  );

  console.log('\nDeployment info saved to deployment.json');
  console.log('\nNext steps:');
  console.log('1. Update .env.local with:');
  console.log(`   NEXT_PUBLIC_VERIXA_MODULE_ADDRESS=${deployer.accountAddress.toString()}`);
  console.log('2. Fund your wallet with testnet APT');
  console.log('3. Run the app: npm run dev');
}

deployContract().catch((error) => {
  console.error('Deployment failed:', error);
  process.exit(1);
});
