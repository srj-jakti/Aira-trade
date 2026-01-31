import { z } from "zod";

export const credentialsSchema = z.object({
  zerodha_api_key: z.string().min(1).max(100).optional(),
  zerodha_api_secret: z.string().min(1).max(200).optional(),
  zerodha_access_token: z.string().max(500).optional(),
  openai_api_key: z.string().min(1).max(200).optional(),
  anthropic_api_key: z.string().min(1).max(200).optional(),
});

export const tradingSettingsSchema = z.object({
  auto_trading_enabled: z.boolean().optional(),
  risk_appetite: z.enum(["low", "medium", "high"]).optional(),
  preferred_markets: z.array(z.string()).optional(),
  daily_profit_limit: z.number().min(0).optional(),
  daily_loss_limit: z.number().min(0).optional(),
});

export const profileSchema = z.object({
  full_name: z.string().min(1).max(100).optional(),
  avatar_url: z.string().url().optional().nullable(),
});

export const userApprovalSchema = z.object({
  userId: z.string().uuid(),
  approved: z.boolean(),
});

export const adminConfigSchema = z.object({
  key: z.string().min(1).max(100),
  value: z.string(),
  encrypted: z.boolean().default(false),
});

export const uuidSchema = z.string().uuid();

export const paginationSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(10),
});

export const generateStrategySchema = z.object({
  userInput: z.string().min(10, "Strategy description must be at least 10 characters").max(2000).optional(),
  referenceInstrument: z.string().min(2).max(50).optional(),
  mode: z.enum(["traditional", "neural"]).default("traditional"),
});

