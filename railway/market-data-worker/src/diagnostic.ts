import { createClient } from "@supabase/supabase-js";
import { createDecipheriv } from "crypto";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config();

const ALGORITHM = "aes-256-gcm";

function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key || key.length !== 64) {
    throw new Error("ENCRYPTION_KEY must be 32 bytes (64 hex characters)");
  }
  return Buffer.from(key, "hex");
}

function decrypt(ciphertext: string): string {
  const [ivHex, authTagHex, encrypted] = ciphertext.split(":");
  if (!ivHex || !authTagHex || !encrypted) {
    throw new Error("Invalid encrypted format");
  }
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const decipher = createDecipheriv(ALGORITHM, getEncryptionKey(), iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log("Supabase URL:", supabaseUrl);
console.log("Supabase Key defined:", !!supabaseServiceKey);
console.log("Encryption Key defined:", !!process.env.ENCRYPTION_KEY);

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function diagnostic() {
  console.log("Checking database connection...");
  const { data: flags, error } = await supabase.from("system_flags").select("*");
  if (error) {
    console.error("Database error:", error);
    return;
  }
  console.log("System flags found:", flags.length);

  console.log("Checking Zerodha configs and decryption...");
  const { data: configs } = await supabase.from("admin_zerodha_configs").select("*").eq("is_active", true);
  if (configs) {
    for (const c of configs) {
      try {
        const apiKey = decrypt(c.api_key);
        console.log(`Config ${c.name}: Decryption successful`);
      } catch (e) {
        console.error(`Config ${c.name}: Decryption failed:`, e.message);
      }
    }
  }
}

diagnostic().then(() => console.log("Done"));
