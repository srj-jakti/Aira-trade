
import { decrypt } from "./src/lib/server/encryption";
import { performZerodhaFullLogin } from "./src/lib/server/zerodha-auth";
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function testLogin(configId: string) {
  const { data: config, error: fetchError } = await supabaseAdmin
    .from("admin_zerodha_configs")
    .select("*")
    .eq("id", configId)
    .single();

  if (fetchError || !config) {
    console.error("Configuration not found");
    return;
  }

  console.log("Testing login for:", config.user_id);
  
  const result = await performZerodhaFullLogin({
    api_key: decrypt(config.api_key),
    api_secret: decrypt(config.api_secret),
    user_id: decrypt(config.user_id),
    password: decrypt(config.password),
    totp_secret: decrypt(config.totp_secret),
  });

  console.log("Result:", JSON.stringify(result, null, 2));
}

const configId = process.argv[2];
if (configId) {
  testLogin(configId);
} else {
  console.log("Please provide configId");
}
