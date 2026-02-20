const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://postgres:jBZr1SqcNt26nolO@db.nuzhtqxfasucecfmkwfw.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false }
});
client.connect().then(() => client.query('SELECT * FROM readings WHERE farm_id = 4 ORDER BY date DESC LIMIT 1')).then(res => {
    console.log(res.rows[0]);
    process.exit(0);
});
