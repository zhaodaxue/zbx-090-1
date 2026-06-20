import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const adminUsername = process.env.ADMIN_DEFAULT_USERNAME || 'admin';
  const adminPassword = process.env.ADMIN_DEFAULT_PASSWORD || 'admin123';

  const existingAdmin = await prisma.user.findUnique({
    where: { username: adminUsername },
  });

  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash(adminPassword, 10);
    await prisma.user.create({
      data: {
        username: adminUsername,
        passwordHash,
        realName: '系统管理员',
        roomNumber: '000-000',
        role: UserRole.ADMIN,
      },
    });
    console.log(`[Seed] 管理员账号已创建: ${adminUsername} / ${adminPassword}`);
  } else {
    console.log(`[Seed] 管理员账号已存在: ${adminUsername}`);
  }

  const sampleResidents = [
    { username: 'user001', password: '123456', realName: '张三', roomNumber: '1-101' },
    { username: 'user002', password: '123456', realName: '李四', roomNumber: '1-102' },
    { username: 'user003', password: '123456', realName: '王五', roomNumber: '1-201' },
    { username: 'user004', password: '123456', realName: '赵六', roomNumber: '1-202' },
    { username: 'user005', password: '123456', realName: '钱七', roomNumber: '2-101' },
  ];

  for (const r of sampleResidents) {
    const exists = await prisma.user.findUnique({ where: { username: r.username } });
    if (!exists) {
      const passwordHash = await bcrypt.hash(r.password, 10);
      await prisma.user.create({
        data: {
          username: r.username,
          passwordHash,
          realName: r.realName,
          roomNumber: r.roomNumber,
          role: UserRole.RESIDENT,
        },
      });
      console.log(`[Seed] 住户账号已创建: ${r.username} / ${r.password} (${r.realName})`);
    }
  }

  console.log('[Seed] 初始化完成');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
