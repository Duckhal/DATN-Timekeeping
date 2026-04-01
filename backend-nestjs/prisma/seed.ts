import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  const hrEmail = 'test123@gmail.com';
  const hrPassword = '12345678';

  const password_hash = await argon2.hash(hrPassword);

  const hrUser = await prisma.employee.upsert({
    where: { email: hrEmail },
    update: {
      password_hash,
      role: 'HR',
      full_name: 'Test HR User',
      hourly_rate: 60.0,
      rfid_tag: 'RFID-HR-001',
      fingerprint_id: 'FP-HR-001',
      date_of_birth: new Date('1998-05-20'),
    },
    create: {
      email: hrEmail,
      password_hash,
      full_name: 'Test HR User',
      role: 'HR',
      hourly_rate: 60.0,
      rfid_tag: 'RFID-HR-001',
      fingerprint_id: 'FP-HR-001',
      date_of_birth: new Date('1998-05-20'),
    },
  });

  console.log(`Seeded test HR user:`);
  console.log(`   Email: ${hrUser.email}`);
  console.log(`   Password: ${hrPassword}`);
  console.log(`   Role: ${hrUser.role}`);
}

main()
  .catch((e) => {
    console.error('Failed to seed database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
