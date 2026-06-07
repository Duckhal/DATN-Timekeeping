import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting database seed execution...');

  // Setup account credentials from environment variables or fallback values
  const hrEmail = process.env.SEED_HR_EMAIL ?? 'hr-admin2@gmail.com';
  const hrPassword = process.env.SEED_HR_PASSWORD ?? '12345678';

  const password_hash = await argon2.hash(hrPassword);

  // 1. Execute safe upsert to fetch target record or register a new one
  let hrUser = await prisma.employee.upsert({
    where: { email: hrEmail },
    // Only update manager_id on existing record by leaving this block empty
    update: {
      manager_id: undefined,
    },
    // Populate the full data model parameters only for newly registered profiles
    create: {
      email: hrEmail,
      password_hash,
      full_name: 'Demo HR User',
      role: 'HR',
      hourly_rate: 60.0,
      rfid_tag: null,
      template_fingerprint: null,
      date_of_birth: new Date('1998-05-20'),
      must_change_password: false,
      is_active: true,
    },
  });

  // 2. Perform safe self-referencing check and assign id to manager_id column
  hrUser = await prisma.employee.update({
    where: { employee_id: hrUser.employee_id },
    data: {
      manager_id: hrUser.employee_id,
    },
  });

  console.log('Seeded target HR user successfully:');
  console.log(`   ID: ${hrUser.employee_id}`);
  console.log(`   Email: ${hrUser.email}`);
  console.log(`   Full Name: ${hrUser.full_name}`);
  console.log(`   Manager ID: ${hrUser.manager_id}`);
}

main()
  .catch((e) => {
    console.error('Failed to seed database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });