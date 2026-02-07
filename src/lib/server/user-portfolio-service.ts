import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { decrypt } from "@/lib/server/encryption";

export interface UserPortfolio {
  balance: {
    total: string;
    available: string;
  };
  pl: {
    total: string;
    day: string;
    isPositive: boolean;
  };
  positions: any[];
  orders: any[];
  isConnected: boolean;
  error?: string;
}

export async function getUserPortfolio(userId: string): Promise<UserPortfolio> {
  try {
    // 1. Get user's broker account
    const { data: account } = await supabaseAdmin
      .from("user_broker_accounts")
      .select("api_key, access_token, is_connected")
      .eq("user_id", userId)
      .eq("broker", "zerodha")
      .single();

    if (!account || !account.is_connected || !account.access_token) {
      return {
        balance: { total: "0.00", available: "0.00" },
        pl: { total: "0.00", day: "0.00", isPositive: true },
        positions: [],
        orders: [],
        isConnected: false
      };
    }

    // 2. Decrypt credentials
    let apiKey: string;
    let accessToken: string;
    
    try {
      apiKey = decrypt(account.api_key);
      accessToken = decrypt(account.access_token);
    } catch (error) {
      console.error("[UserPortfolio] Decryption failed:", error);
      return {
        balance: { total: "0.00", available: "0.00" },
        pl: { total: "0.00", day: "0.00", isPositive: true },
        positions: [],
        orders: [],
        isConnected: false,
        error: "Credential decryption failed"
      };
    }

    // 3. Fetch data from Kite Connect
    const headers = {
      "X-Kite-Version": "3",
      "Authorization": `token ${apiKey}:${accessToken}`
    };

    const [marginsRes, positionsRes, ordersRes] = await Promise.all([
      fetch("https://api.kite.trade/user/margins", { headers }),
      fetch("https://api.kite.trade/portfolio/positions", { headers }),
      fetch("https://api.kite.trade/orders", { headers })
    ]);

    if (!marginsRes.ok || !positionsRes.ok || !ordersRes.ok) {
        // If 403, token might be expired
        if (marginsRes.status === 403 || positionsRes.status === 403) {
            console.error("[UserPortfolio] Token expired for user:", userId);
        }
        return {
            balance: { total: "0.00", available: "0.00" },
            pl: { total: "0.00", day: "0.00", isPositive: true },
            positions: [],
            orders: [],
            isConnected: true, // Still theoretically connected, just failed fetch
            error: "Failed to fetch broker data"
        };
    }

    const margins = await marginsRes.json();
    const positions = await positionsRes.json();
    const orders = await ordersRes.json();

    // 4. Format data
    const equity = margins.data?.equity;
    const available = equity?.net || 0;
    const utilized = equity?.utilized?.debits || 0;
    const total = available + utilized;
    
    // Calculate P&L
    // realized + unrealized
    const realized = equity?.utilized?.m2m_realised || 0;
    const unrealized = equity?.utilized?.m2m_unrealised || 0;
    const totalPnl = realized + unrealized;

    const formattedBalance = {
      total: total.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      available: available.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    };
    
    const formattedPl = {
        total: totalPnl.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        day: realized.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        isPositive: totalPnl >= 0
    };

    const formattedPositions = (positions.data?.net || []).map((p: any) => ({
      id: p.instrument_token, // Use token as ID or generate one
      instrument_token: p.instrument_token,
      symbol: p.tradingsymbol,
      type: p.quantity > 0 ? "BUY" : "SELL",
      qty: Math.abs(p.quantity),
      avgPrice: p.average_price.toFixed(2),
      pl: (p.pnl >= 0 ? "+" : "") + p.pnl.toFixed(2),
      plPercent: "0.00%", // API doesn't give P% directly usually, need calculation: (pnl / (avg * qty)) * 100
      unrealized_pnl: p.pnl, // For M2M calculation
      entry_price: p.average_price
    }));
    
    // Calculate PL percent
    formattedPositions.forEach((p: any) => {
        const invested = p.entry_price * p.qty;
        if (invested > 0) {
            const pct = (parseFloat(p.unrealized_pnl) / invested) * 100;
            p.plPercent = pct.toFixed(2) + "%";
        }
    });

    const formattedOrders = (orders.data || []).slice(0, 10).map((o: any) => ({
      id: o.order_id,
      symbol: o.tradingsymbol,
      type: o.transaction_type,
      qty: o.quantity,
      price: o.price,
      status: o.status,
      created_at: o.order_timestamp
    }));

    return {
      balance: formattedBalance,
      pl: formattedPl,
      positions: formattedPositions,
      orders: formattedOrders,
      isConnected: true
    };

  } catch (error) {
    console.error("[UserPortfolio] Error:", error);
    return {
      balance: { total: "0.00", available: "0.00" },
      pl: { total: "0.00", day: "0.00", isPositive: true },
      positions: [],
      orders: [],
      isConnected: false,
      error: "Internal error"
    };
  }
}
