import crypto from 'node:crypto';
import readline from 'node:readline/promises';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

const password = await rl.question('Admin password to hash: ');
rl.close();

const salt = crypto.randomBytes(16);
const derived = crypto.scryptSync(password, salt, 64);

console.log('\nPaste these into server/.env:\n');
console.log(`ADMIN_PASSWORD_SALT=${salt.toString('hex')}`);
console.log(`ADMIN_PASSWORD_HASH=${derived.toString('hex')}\n`);

