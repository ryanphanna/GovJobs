import { createClient } from '@libsql/client';

export function createDb() {
  return createClient({
    url: process.env.TURSO_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN!,
  });
}
