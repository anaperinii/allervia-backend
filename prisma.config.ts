import "dotenv/config"
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("DATABASE_URL"),
    // Banco descartável usado apenas por `prisma migrate diff/dev` para calcular
    // o SQL de uma migration. Opcional: ausente, os comandos que não precisam de
    // shadow continuam funcionando.
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL,
  },
});
