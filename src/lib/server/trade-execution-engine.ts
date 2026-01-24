import { supabaseAdmin } from "@/lib/supabase/admin";
import { decrypt, encrypt } from "@/lib/server/encryption";
import { performZerodhaFullLogin } from "@/lib/server/zerodha-auth";

export interface UserBrokerAccount {
  id: string;
  user_id: string;
  broker: string;
  api_key: string;
  api_secret: string;
  user_id_broker: string;
  access_token: string | null;
  token_expires_at: string | null;
  is_connected: boolean;
  is_active: boolean;
}

export interface OrderParams {
  tradingsymbol: string;
  exchange: string;
  transactionType: "BUY" | "SELL";
  orderType: "MARKET" | "LIMIT" | "SL" | "SL-M";
  product: "CNC" | "MIS" | "NRML";
  quantity: number;
  price?: number;
  triggerPrice?: number;
  tag?: string;
}

export interface OrderResult {
  success: boolean;
  orderId?: string;
  error?: string;
  status?: string;
}

export interface RiskCheckResult {
  allowed: boolean;
  reason?: string;
  adjustedQuantity?: number;
}

class TradeExecutionEngine {
  private static instance: TradeExecutionEngine;

  private constructor() {}

  static getInstance(): TradeExecutionEngine {
    if (!TradeExecutionEngine.instance) {
      TradeExecutionEngine.instance = new TradeExecutionEngine();
    }
    return TradeExecutionEngine.instance;
  }

  async getUserBrokerAccount(userId: string): Promise<UserBrokerAccount | null> {
    const { data } = await supabaseAdmin
      .from("user_broker_accounts")
      .select("*")
      .eq("user_id", userId)
      .eq("is_active", true)
      .single();

    return data;
  }

  async connectUserBroker(
    userId: string,
    credentials: {
      apiKey: string;
      apiSecret: string;
      userIdBroker: string;
      password: string;
      totpSecret: string;
    }
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await performZerodhaFullLogin({
        api_key: credentials.apiKey,
        api_secret: credentials.apiSecret,
        user_id: credentials.userIdBroker,
        password: credentials.password,
        totp_secret: credentials.totpSecret,
      });

      if (!result.success || !result.accessToken) {
        return { success: false, error: result.error || "Login failed" };
      }

      const tokenExpiry = new Date();
      tokenExpiry.setHours(23, 59, 59, 999);

      await supabaseAdmin.from("user_broker_accounts").upsert({
        user_id: userId,
        broker: "zerodha",
        api_key: encrypt(credentials.apiKey),
        api_secret: encrypt(credentials.apiSecret),
        user_id_broker: encrypt(credentials.userIdBroker),
        password: encrypt(credentials.password),
        totp_secret: encrypt(credentials.totpSecret),
        access_token: encrypt(result.accessToken),
        token_expires_at: tokenExpiry.toISOString(),
        is_connected: true,
        last_connected_at: new Date().toISOString(),
        last_error: null,
        is_active: true,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id,broker" });

      return { success: true };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      return { success: false, error: errorMsg };
    }
  }

  async disconnectUserBroker(userId: string): Promise<void> {
    await supabaseAdmin
      .from("user_broker_accounts")
      .update({
        access_token: null,
        is_connected: false,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);
  }

  async refreshUserToken(userId: string): Promise<{ success: boolean; error?: string }> {
    const account = await this.getUserBrokerAccount(userId);
    if (!account) {
      return { success: false, error: "No broker account found" };
    }

    const credentials = {
      apiKey: decrypt(account.api_key),
      apiSecret: decrypt(account.api_secret),
      userIdBroker: decrypt(account.user_id_broker),
      password: account.password ? decrypt(account.password) : "",
      totpSecret: account.totp_secret ? decrypt(account.totp_secret) : "",
    };

    if (!credentials.password || !credentials.totpSecret) {
      return { success: false, error: "Missing credentials for auto-refresh" };
    }

    return this.connectUserBroker(userId, credentials);
  }

  async performRiskCheck(
    userId: string,
    order: OrderParams
  ): Promise<RiskCheckResult> {
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("risk_settings")
      .eq("id", userId)
      .single();

    const riskSettings = profile?.risk_settings || {
      maxPositionSize: 100000,
      maxDailyLoss: 10000,
      maxOrderValue: 50000,
    };

    const orderValue = order.quantity * (order.price || 0);
    
    if (orderValue > riskSettings.maxOrderValue) {
      return {
        allowed: false,
        reason: `Order value ${orderValue} exceeds max ${riskSettings.maxOrderValue}`,
      };
    }

    const { data: todaysOrders } = await supabaseAdmin
      .from("user_orders")
      .select("average_price, filled_quantity, transaction_type")
      .eq("user_id", userId)
      .gte("created_at", new Date().toISOString().split("T")[0])
      .eq("status", "complete");

    let dailyPnL = 0;
    (todaysOrders || []).forEach((o) => {
      const value = (o.average_price || 0) * (o.filled_quantity || 0);
      dailyPnL += o.transaction_type === "BUY" ? -value : value;
    });

    if (dailyPnL < -riskSettings.maxDailyLoss) {
      return {
        allowed: false,
        reason: `Daily loss limit of ${riskSettings.maxDailyLoss} reached`,
      };
    }

    return { allowed: true };
  }

  async placeOrder(
    userId: string,
    order: OrderParams,
    strategyId?: string
  ): Promise<OrderResult> {
    const account = await this.getUserBrokerAccount(userId);
    if (!account || !account.is_connected || !account.access_token) {
      return { success: false, error: "Broker not connected" };
    }

    if (account.token_expires_at && new Date(account.token_expires_at) < new Date()) {
      const refresh = await this.refreshUserToken(userId);
      if (!refresh.success) {
        return { success: false, error: "Token expired and refresh failed" };
      }
    }

    const riskCheck = await this.performRiskCheck(userId, order);
    if (!riskCheck.allowed) {
      return { success: false, error: riskCheck.reason };
    }

    const quantity = riskCheck.adjustedQuantity || order.quantity;

    try {
      const apiKey = decrypt(account.api_key);
      const accessToken = decrypt(account.access_token!);

      const orderParams: Record<string, string> = {
        tradingsymbol: order.tradingsymbol,
        exchange: order.exchange,
        transaction_type: order.transactionType,
        order_type: order.orderType,
        product: order.product,
        quantity: quantity.toString(),
        validity: "DAY",
      };

      if (order.price && order.orderType !== "MARKET") {
        orderParams.price = order.price.toString();
      }

      if (order.triggerPrice && (order.orderType === "SL" || order.orderType === "SL-M")) {
        orderParams.trigger_price = order.triggerPrice.toString();
      }

      if (order.tag) {
        orderParams.tag = order.tag;
      }

      const response = await fetch("https://api.kite.trade/orders/regular", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "X-Kite-Version": "3",
          Authorization: `token ${apiKey}:${accessToken}`,
        },
        body: new URLSearchParams(orderParams),
      });

      const data = await response.json();

      const orderId = data.data?.order_id;
      const status = response.ok ? "placed" : "rejected";

      await supabaseAdmin.from("user_orders").insert({
        user_id: userId,
        broker_account_id: account.id,
        strategy_id: strategyId,
        order_id: orderId,
        tradingsymbol: order.tradingsymbol,
        exchange: order.exchange,
        transaction_type: order.transactionType,
        order_type: order.orderType,
        product: order.product,
        quantity,
        price: order.price,
        trigger_price: order.triggerPrice,
        status,
        status_message: data.message,
        placed_at: new Date().toISOString(),
      });

      if (!response.ok) {
        return { success: false, error: data.message || "Order failed", status };
      }

      return { success: true, orderId, status };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      
      await supabaseAdmin.from("user_orders").insert({
        user_id: userId,
        broker_account_id: account.id,
        strategy_id: strategyId,
        tradingsymbol: order.tradingsymbol,
        exchange: order.exchange,
        transaction_type: order.transactionType,
        order_type: order.orderType,
        product: order.product,
        quantity,
        price: order.price,
        trigger_price: order.triggerPrice,
        status: "error",
        status_message: errorMsg,
      });

      return { success: false, error: errorMsg };
    }
  }

  async modifyOrder(
    userId: string,
    orderId: string,
    modifications: {
      quantity?: number;
      price?: number;
      triggerPrice?: number;
      orderType?: string;
    }
  ): Promise<OrderResult> {
    const account = await this.getUserBrokerAccount(userId);
    if (!account || !account.is_connected || !account.access_token) {
      return { success: false, error: "Broker not connected" };
    }

    try {
      const apiKey = decrypt(account.api_key);
      const accessToken = decrypt(account.access_token!);

      const params: Record<string, string> = {};
      if (modifications.quantity) params.quantity = modifications.quantity.toString();
      if (modifications.price) params.price = modifications.price.toString();
      if (modifications.triggerPrice) params.trigger_price = modifications.triggerPrice.toString();
      if (modifications.orderType) params.order_type = modifications.orderType;

      const response = await fetch(
        `https://api.kite.trade/orders/regular/${orderId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "X-Kite-Version": "3",
            Authorization: `token ${apiKey}:${accessToken}`,
          },
          body: new URLSearchParams(params),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: data.message || "Modification failed" };
      }

      await supabaseAdmin
        .from("user_orders")
        .update({
          quantity: modifications.quantity,
          price: modifications.price,
          trigger_price: modifications.triggerPrice,
          updated_at: new Date().toISOString(),
        })
        .eq("order_id", orderId)
        .eq("user_id", userId);

      return { success: true, orderId };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }

  async cancelOrder(userId: string, orderId: string): Promise<OrderResult> {
    const account = await this.getUserBrokerAccount(userId);
    if (!account || !account.is_connected || !account.access_token) {
      return { success: false, error: "Broker not connected" };
    }

    try {
      const apiKey = decrypt(account.api_key);
      const accessToken = decrypt(account.access_token!);

      const response = await fetch(
        `https://api.kite.trade/orders/regular/${orderId}`,
        {
          method: "DELETE",
          headers: {
            "X-Kite-Version": "3",
            Authorization: `token ${apiKey}:${accessToken}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: data.message || "Cancellation failed" };
      }

      await supabaseAdmin
        .from("user_orders")
        .update({
          status: "cancelled",
          updated_at: new Date().toISOString(),
        })
        .eq("order_id", orderId)
        .eq("user_id", userId);

      return { success: true, orderId, status: "cancelled" };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }

  async getOrderStatus(userId: string, orderId: string): Promise<unknown> {
    const account = await this.getUserBrokerAccount(userId);
    if (!account || !account.is_connected || !account.access_token) {
      return { error: "Broker not connected" };
    }

    try {
      const apiKey = decrypt(account.api_key);
      const accessToken = decrypt(account.access_token!);

      const response = await fetch(
        `https://api.kite.trade/orders/${orderId}`,
        {
          headers: {
            "X-Kite-Version": "3",
            Authorization: `token ${apiKey}:${accessToken}`,
          },
        }
      );

      const data = await response.json();
      return data.data || data;
    } catch (error) {
      return { error: error instanceof Error ? error.message : "Unknown error" };
    }
  }

  async getUserPositions(userId: string): Promise<unknown> {
    const account = await this.getUserBrokerAccount(userId);
    if (!account || !account.is_connected || !account.access_token) {
      return { error: "Broker not connected" };
    }

    try {
      const apiKey = decrypt(account.api_key);
      const accessToken = decrypt(account.access_token!);

      const response = await fetch("https://api.kite.trade/portfolio/positions", {
        headers: {
          "X-Kite-Version": "3",
          Authorization: `token ${apiKey}:${accessToken}`,
        },
      });

      const data = await response.json();
      return data.data || data;
    } catch (error) {
      return { error: error instanceof Error ? error.message : "Unknown error" };
    }
  }

  async getUserHoldings(userId: string): Promise<unknown> {
    const account = await this.getUserBrokerAccount(userId);
    if (!account || !account.is_connected || !account.access_token) {
      return { error: "Broker not connected" };
    }

    try {
      const apiKey = decrypt(account.api_key);
      const accessToken = decrypt(account.access_token!);

      const response = await fetch("https://api.kite.trade/portfolio/holdings", {
        headers: {
          "X-Kite-Version": "3",
          Authorization: `token ${apiKey}:${accessToken}`,
        },
      });

      const data = await response.json();
      return data.data || data;
    } catch (error) {
      return { error: error instanceof Error ? error.message : "Unknown error" };
    }
  }
}

export const tradeExecutionEngine = TradeExecutionEngine.getInstance();
