import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const files = await prisma.file.findMany({
    where: {
      storageFee: null,
    },
  });

  console.log(`Found ${files.length} files without storage fees. Backfilling...`);

  for (const file of files) {
    const fileSizeGB = Number(file.size) / 1073741824;
    const feePerGBYear = 0.012; // SUSD
    const calculatedFee = Math.max(fileSizeGB * feePerGBYear, 0.0001); // min floor

    await prisma.file.update({
      where: { id: file.id },
      data: {
        storageFee: parseFloat(calculatedFee.toFixed(8)),
      },
    });
  }

  console.log('Backfill complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
