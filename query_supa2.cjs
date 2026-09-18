require('dotenv').config();
const { Client } = require('pg');

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required. Configure it in a local .env file.');
}

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

client.connect()
  .then(() => client.query('SELECT * FROM readings WHERE farm_id = $1 ORDER BY date DESC LIMIT 1', [4]))
  .then(res => console.log(res.rows[0]))
  .finally(() => client.end());
