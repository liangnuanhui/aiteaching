import { auth } from '../lib/auth/config';

async function main() {
  try {
    const session = await auth();
    console.log('session', session);
  } catch (err) {
    console.error('auth error', err);
  }
}

main();
