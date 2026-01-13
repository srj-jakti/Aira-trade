import { supabaseAdmin } from "../src/lib/supabase/admin";
import { performZerodhaFullLogin } from "../src/lib/server/zerodha-auth";
import { decrypt, encrypt } from "../src/lib/server/encryption";

async function forceLogin() {
  console.log("Fetching admin Zerodha configs...");
  const { data: configs, error } = await supabaseAdmin
    .from("admin_zerodha_configs")
    .select("*")
    .eq("is_active", true);

  if (error) {
    console.error("Error fetching configs:", error);
    return;
  }

  for (const config of configs) {
    console.log(`Processing ${config.name}...`);
    try {
      const result = await performZerodhaFullLogin({
        api_key: decrypt(config.api_key),
        api_secret: decrypt(config.api_secret),
        user_id: decrypt(config.user_id),
        password: decrypt(config.password),
        totp_secret: decrypt(config.totp_secret),
      });

      if (result.success && result.accessToken) {
        const tokenExpiry = new Date();
        tokenExpiry.setHours(23, 59, 59, 999);

        await supabaseAdmin
          .from("admin_zerodha_configs")
          .update({
            access_token: encrypt(result.accessToken),
            token_expires_at: tokenExpiry.toISOString(),
            last_login_at: new Date().toISOString(),
            connection_status: "connected",
            last_error: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", config.id);

        console.log(`Successfully logged in ${config.name}`);
      } else {
        console.error(`Failed to login ${config.name}:`, result.error);
      }
    } catch (e) {
      console.error(`Error processing ${config.name}:`, e);
    }
  }
}

forceLogin().then(() => console.log("Done"));
