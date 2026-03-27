import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  const hrUsername = 'hr_admin';
  const hrPassword = 'Password123!';

  // Check if HR user already exists
  const existingUser = await prisma.employee.findUnique({
    where: { account_username: hrUsername },
  });

  if (existingUser) {
    console.log(`✅ HR user "${hrUsername}" already exists. Skipping seed.`);
    return;
  }

  const password_hash = await argon2.hash(hrPassword);

  const hrUser = await prisma.employee.create({
    data: {
      account_username: hrUsername,
      password_hash,
      full_name: 'System HR Administrator',
      role: 'HR',
      hourly_rate: 50.0,
      // fingerprint_id doesn't need to be set for HR, but they are a valid employee record
    },
  });

  console.log(`✅ Created test HR user:`);
  console.log(`   Username: ${hrUser.account_username}`);
  console.log(`   Password: ${hrPassword}`);
  console.log(`   Role: ${hrUser.role}`);
}

main()
  .catch((e) => {
    console.error('❌ Failed to seed database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
