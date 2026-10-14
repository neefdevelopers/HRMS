import { prisma } from '../config/prisma.js';

async function main() {
  const brands = await prisma.brand.findMany({
    include: {
      company: { select: { id: true, name: true, code: true } },
      _count: { select: { employees: true, branches: true } }
    }
  });
  console.log('Total Brands in Database:', brands.length);
  for (const b of brands) {
    console.log(`- [${b.code}] ${b.name}: companyId = ${b.companyId} (${b.company?.name || 'NO COMPANY'}), Employees: ${b._count.employees}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
