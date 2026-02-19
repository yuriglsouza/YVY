const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://postgres:jBZr1SqcNt26nolO@db.nuzhtqxfasucecfmkwfw.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false }
});
client.connect()
  .then(() => client.query('SELECT id, name, latitude, longitude, size_ha FROM farms WHERE id = 7'))
  .then(res => {
    console.log(res.rows[0]);
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
