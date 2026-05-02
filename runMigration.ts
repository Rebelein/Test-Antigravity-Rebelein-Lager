import { initializeDatabase } from './utils/dbInit';

async function run() {
  console.log("Running migration...");
  await initializeDatabase(false);
  console.log("Migration complete.");
  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
