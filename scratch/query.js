const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.content.findMany().then(c => {
  console.log(c);
  prisma.$disconnect();
});
