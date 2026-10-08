import { NestFactory } from '@nestjs/core';
import { AppModule } from 'src/app.module';
import { PrismaService } from 'src/infra/database/prisma.service';

const email = process.env.SEED_SYSTEM_EMAIL?.trim();

async function main() {
  if (!email) {
    console.error('defina SEED_SYSTEM_EMAIL com o e-mail do usuário-sistema.');
    process.exit(1);
  }
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  const prisma = app.get(PrismaService);

  const existing = await prisma.user.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
    select: { id: true },
  });
  const user =
    existing ??
    (await prisma.user.create({
      data: {
        email,
        password: '!system-user-cannot-login!',
        type: 'PROFESSIONAL',
        isActive: false,
      },
      select: { id: true },
    }));

  console.log(`usuário-sistema: ${user.id}${existing ? ' (já existia)' : ''}`);
  if (process.env.SYSTEM_USER_ID?.trim() !== user.id)
    console.log(`>>> atualize o .env: SYSTEM_USER_ID=${user.id}`);

  await app.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
