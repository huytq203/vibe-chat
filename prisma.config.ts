// Prisma v6 config — dùng cho prisma CLI (migrate, db push, db pull)
// DATABASE_URL env var cần được set khi chạy CLI commands
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
});
