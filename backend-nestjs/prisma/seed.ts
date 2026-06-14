import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting database seed execution...');

  // Setup manager account credentials from environment variables or fallback values.
  const managerEmail =
    process.env.SEED_MANAGER_EMAIL ??
    'manager-admin@gmail.com';
  const managerPassword =
    process.env.SEED_MANAGER_PASSWORD ??
    '12345678';

  const password_hash = await argon2.hash(managerPassword);

  const managerUser = await prisma.employee.upsert({
    where: { email: managerEmail },
    update: {
      role: 'MANAGER',
      is_active: true,
    },
    create: {
      email: managerEmail,
      password_hash,
      full_name: 'Demo Manager User',
      role: 'MANAGER',
      hourly_rate: 60.0,
      rfid_tag: null,
      template_fingerprint: null,
      date_of_birth: new Date('1998-05-20'),
      must_change_password: false,
      is_active: true,
    },
  });

  console.log('Seeded target Manager user successfully:');
  console.log(`   ID: ${managerUser.employee_id}`);
  console.log(`   Email: ${managerUser.email}`);
  console.log(`   Full Name: ${managerUser.full_name}`);
}

main()
  .catch((e) => {
    console.error('Failed to seed database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
