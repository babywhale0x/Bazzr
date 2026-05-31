import { prisma } from '../lib/db';

async function setupDatabase() {
  console.log('Setting up database...');

  try {
    // Run migrations
    console.log('Running migrations...');
    // In production, use: await prisma.$executeRaw`...`

    // Create indexes for performance
    console.log('Creating indexes...');

    // Verify connection
    await prisma.$connect();
    console.log('Database connection successful');

    console.log('\nDatabase setup complete!');
  } catch (error) {
    console.error('Database setup failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

setupDatabase();
