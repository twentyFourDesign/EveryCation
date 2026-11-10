import pg from 'pg';
import { totpCode } from '../modules/admin/totp.js';

/** Development helper: prints the current authenticator code for a staff account. Usage: admin-code <email> */
if (process.env.NODE_ENV === 'production') { console.error('Not available in production.'); process.exit(1); }
const client = new pg.Client({ connectionString: process.env.DATABASE_URL }); await client.connect();
const { rows } = await client.query('SELECT totp_secret FROM admins WHERE email = $1', [process.argv[2]?.toLowerCase()]);
await client.end();
console.log(rows[0] ? totpCode(rows[0].totp_secret) : 'No staff account with that email.');
