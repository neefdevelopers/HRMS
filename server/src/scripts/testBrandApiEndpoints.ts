import { prisma } from '../config/prisma.js';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'secret';

function assert(condition: any, message: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exit(1);
  }
  console.log(`✅ PASS: ${message}`);
}

async function testHttpEndpoints() {
  console.log('--- Testing Brand Management Endpoints via HTTP ---');

  // Fetch superadmin user
  const superAdmin = await prisma.user.findFirst({
    where: { email: 'superadmin@hrms.local' }
  });
  assert(superAdmin !== null, 'Superadmin user found');

  // Fetch brand HR user
  const brandHr = await prisma.user.findFirst({
    where: { email: 'apex.hr@hrms.local' }
  });
  assert(brandHr !== null, 'Brand HR user found');

  const superAdminToken = jwt.sign(
    { userId: superAdmin!.id, role: superAdmin!.role, email: superAdmin!.email },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  const brandHrToken = jwt.sign(
    { userId: brandHr!.id, role: brandHr!.role, email: brandHr!.email },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  const baseUrl = 'http://localhost:5000/api';

  // 1. GET /api/brands as Superadmin
  const resGet = await fetch(`${baseUrl}/brands`, {
    headers: { Authorization: `Bearer ${superAdminToken}` }
  });
  const dataGet = await resGet.json();
  assert(resGet.status === 200, '1. GET /api/brands returns 200 OK');
  assert(Array.isArray(dataGet.data), '2. Brands returned as array');
  assert(dataGet.data.length > 0, `3. Found ${dataGet.data.length} brands`);
  assert(
    dataGet.data.every((b: any) => b.company && b.company.name),
    '4. All brands contain company information'
  );

  // 2. Attempt brand creation as Brand HR (MUST BE 403 FORBIDDEN)
  const resBrandHrCreate = await fetch(`${baseUrl}/brands`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${brandHrToken}`
    },
    body: JSON.stringify({
      name: 'Unauthorized Brand',
      code: 'UNAUTH',
      companyId: 'apex-corp-001'
    })
  });
  assert(
    resBrandHrCreate.status === 403,
    `5. Brand HR forbidden from creating brands (HTTP ${resBrandHrCreate.status})`
  );

  // 3. Attempt brand deactivation as Brand HR (MUST BE 403 FORBIDDEN)
  const anyBrand = dataGet.data[0];
  const resBrandHrToggle = await fetch(`${baseUrl}/brands/${anyBrand.id}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${brandHrToken}`
    },
    body: JSON.stringify({ isActive: false })
  });
  assert(
    resBrandHrToggle.status === 403,
    `6. Brand HR forbidden from deactivating brands (HTTP ${resBrandHrToggle.status})`
  );

  // 4. Update brand as Superadmin
  const resUpdate = await fetch(`${baseUrl}/brands/${anyBrand.id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${superAdminToken}`
    },
    body: JSON.stringify({
      phone: '+91 99999 88888'
    })
  });
  const dataUpdate = await resUpdate.json();
  assert(resUpdate.status === 200, '7. Superadmin can update brand via PUT /api/brands/:id');
  assert(dataUpdate.data.phone === '+91 99999 88888', '8. Brand phone updated successfully');

  // 5. Toggle brand status as Superadmin
  const resDeactivate = await fetch(`${baseUrl}/brands/${anyBrand.id}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${superAdminToken}`
    },
    body: JSON.stringify({ isActive: false })
  });
  const dataDeactivate = await resDeactivate.json();
  assert(resDeactivate.status === 200, '9. Superadmin can deactivate brand via PATCH /api/brands/:id/status');
  assert(dataDeactivate.data.isActive === false, '10. Brand isActive toggled to false');

  // Reactivate
  const resReactivate = await fetch(`${baseUrl}/brands/${anyBrand.id}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${superAdminToken}`
    },
    body: JSON.stringify({ isActive: true })
  });
  const dataReactivate = await resReactivate.json();
  assert(resReactivate.status === 200, '11. Brand reactivated back to active');
  assert(dataReactivate.data.isActive === true, '12. Brand isActive toggled back to true');

  console.log('\n🎉 ALL HTTP ENDPOINT AUTHORIZATION & BEHAVIOR TESTS PASSED!\n');
}

testHttpEndpoints()
  .catch((e) => {
    console.error('HTTP test failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
