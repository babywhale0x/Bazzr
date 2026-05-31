const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const users = await prisma.user.findMany({ include: { files: true } });
  const fs = require('fs');
  fs.writeFileSync('db-dump.json', JSON.stringify(users, (key, value) =>
      typeof value === 'bigint' ? value.toString() : value
  , 2));
}
main().finally(() => prisma.$disconnect());
