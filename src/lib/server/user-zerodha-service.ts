import { supabaseAdmin } from "@/lib/supabase/admin";
import { decrypt, encrypt } from "@/lib/server/encryption";
import { performZerodhaFullLogin } from "@/lib/server/zerodha-auth";
import { getIstEndOfDayExpiryUtcIso } from "@/lib/server/ist-time";

interface UserBrokerAccount {
  id: string;
  user_id: string;
  broker: string;
  api_key: string;
  api_secret: string;
  user_id_broker: string | null;
  password: string | null;
  totp_secret: string | null;
  access_token: string | null;
  token_expires_at: string | null;
  is_connected: boolean;
  is_authorized: boolean;
  auto_login_enabled: boolean;
}

class UserZerodhaService {
  private isAutoLoginRunning = new Set<string>();

  /**
   * Get valid access token for a user, with automatic refresh if expired
   */
  async getUserAccessToken(userId: string): Promise<{ apiKey: string; accessToken: string } | null> {
    const { data: account } = await supabaseAdmin
      .from("user_broker_accounts")
      .select("*")
      .eq("user_id", userId)
      .eq("broker", "zerodha")
      .single();

    if (!account) {
      console.warn(`[UserZerodhaService] No broker account found for user: ${userId}`);
      return null;
    }

    // Check if token is valid
    const isTokenValid = account.access_token && 
                        account.is_connected && 
                        account.is_authorized &&
                        (!account.token_expires_at || new Date(account.token_expires_at) > new Date());

    if (isTokenValid) {
      try {
        return {
          apiKey: decrypt(account.api_key),
          accessToken: decrypt(account.access_token!),
        };
      } catch (e) {
        console.error(`[UserZerodhaService] Failed to decrypt tokens for user ${userId}:`, e);
        return null;
      }
    }

    // Token expired or invalid - attempt auto-login if enabled
    if (account.auto_login_enabled && this.canAttemptAutoLogin(account)) {
      console.log(`[UserZerodhaService] Token expired for user ${userId}, attempting auto-login...`);
      const refreshed = await this.attemptAutoLogin(account);
      
      if (refreshed) {
        return refreshed;
      }
    }

    console.warn(`[UserZerodhaService] No valid token for user ${userId} and auto-login not available`);
    return null;
  }

  /**
   * Check if account has required credentials for auto-login
   */
  private canAttemptAutoLogin(account: UserBrokerAccount): boolean {
    return !!(
      account.api_key &&
      account.api_secret &&
      account.user_id_broker &&
      account.password &&
      account.totp_secret
    );
  }

  /**
   * Attempt automatic login for a user account
   */
  private async attemptAutoLogin(account: UserBrokerAccount): Promise<{ apiKey: string; accessToken: string } | null> {
    // Prevent concurrent auto-login attempts for same user
    if (this.isAutoLoginRunning.has(account.user_id)) {
      console.log(`[UserZerodhaService] Auto-login already in progress for user ${account.user_id}`);
      return null;
    }

    this.isAutoLoginRunning.add(account.user_id);

    try {
      const result = await performZerodhaFullLogin({
        api_key: decrypt(account.api_key),
        api_secret: decrypt(account.api_secret),
        user_id: decrypt(account.user_id_broker!),
        password: decrypt(account.password!),
        totp_secret: decrypt(account.totp_secret!),
      });

      if (result.success && result.accessToken) {
        const tokenExpiry = getIstEndOfDayExpiryUtcIso();

        await supabaseAdmin
          .from("user_broker_accounts")
          .update({
            access_token: encrypt(result.accessToken),
            token_expires_at: tokenExpiry,
            last_connected_at: new Date().toISOString(),
            is_connected: true,
            is_authorized: true,
            last_error: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", account.id);

        console.log(`[UserZerodhaService] Auto-login SUCCESS for user ${account.user_id}`);

        return {
          apiKey: decrypt(account.api_key),
          accessToken: result.accessToken,
        };
      } else {
        console.error(`[UserZerodhaService] Auto-login FAILED for user ${account.user_id}: ${result.error}`);
        
        await supabaseAdmin
          .from("user_broker_accounts")
          .update({
            is_connected: false,
            last_error: `Auto-login failed: ${result.error}`,
            updated_at: new Date().toISOString(),
          })
          .eq("id", account.id);

        return null;
      }
    } catch (err) {
      console.error(`[UserZerodhaService] Error in auto-login for user ${account.user_id}:`, err);
      return null;
    } finally {
      this.isAutoLoginRunning.delete(account.user_id);
    }
  }

  /**
   * Refresh tokens for all users with auto-login enabled and expired tokens
   */
  async refreshExpiredUserTokens(): Promise<{ success: number; failed: number }> {
    const { data: accounts } = await supabaseAdmin
      .from("user_broker_accounts")
      .select("*")
      .eq("broker", "zerodha")
      .eq("auto_login_enabled", true)
      .or("token_expires_at.is.null,token_expires_at.lt." + new Date().toISOString());

    if (!accounts || accounts.length === 0) {
      console.log("[UserZerodhaService] No user accounts need token refresh");
      return { success: 0, failed: 0 };
    }

    console.log(`[UserZerodhaService] Refreshing tokens for ${accounts.length} user accounts...`);

    let success = 0;
    let failed = 0;

    for (const account of accounts) {
      if (!this.canAttemptAutoLogin(account)) {
        console.warn(`[UserZerodhaService] User ${account.user_id} has auto-login enabled but missing credentials`);
        failed++;
        continue;
      }

      const result = await this.attemptAutoLogin(account);
      if (result) {
        success++;
      } else {
        failed++;
      }

      // Add delay between requests to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    console.log(`[UserZerodhaService] Token refresh complete: ${success} success, ${failed} failed`);
    return { success, failed };
  }

  /**
   * Enable auto-login for a user account
   */
  async enableAutoLogin(userId: string): Promise<{ success: boolean; error?: string }> {
    const { data: account } = await supabaseAdmin
      .from("user_broker_accounts")
      .select("*")
      .eq("user_id", userId)
      .eq("broker", "zerodha")
      .single();

    if (!account) {
      return { success: false, error: "No broker account found" };
    }

    if (!this.canAttemptAutoLogin(account)) {
      return { 
        success: false, 
        error: "Missing required credentials (user_id, password, or TOTP secret)" 
      };
    }

    await supabaseAdmin
      .from("user_broker_accounts")
      .update({ 
        auto_login_enabled: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", account.id);

    return { success: true };
  }

  /**
   * Disable auto-login for a user account
   */
  async disableAutoLogin(userId: string): Promise<void> {
    await supabaseAdmin
      .from("user_broker_accounts")
      .update({ 
        auto_login_enabled: false,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .eq("broker", "zerodha");
  }
}

export const userZerodhaService = new UserZerodhaService();
