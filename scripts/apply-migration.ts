import { Client } from "pg";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

// Load environment variables
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" }); // Fallback

async function applyMigration() {
  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.SUPABASE_DB_URL;

  if (!connectionString) {
    console.error("❌ Error: No database connection string found.");
    console.error("   Please set DATABASE_URL or POSTGRES_URL in .env.local");
    console.error("   Format: postgres://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres");
    process.exit(1);
  }

  console.log("🔌 Connecting to database...");
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }, // Supabase requires SSL
  });

  try {
    await client.connect();
    console.log("✅ Connected.");

    const migrationPath = path.join(process.cwd(), "supabase", "migrations", "006_social_sharing.sql");
    console.log(`📖 Reading migration file: ${migrationPath}`);
    
    const sql = fs.readFileSync(migrationPath, "utf-8");

    console.log("🚀 Executing migration...");
    await client.query(sql);

    console.log("✅ Migration applied successfully!");
    console.log("   - Table 'shared_analysis' created (if not exists)");
    console.log("   - RLS policies enabled");
    console.log("   - Indexes created");

  } catch (error) {
    console.error("❌ Migration failed:", error);
  } finally {
    await client.end();
  }
}

applyMigration();
