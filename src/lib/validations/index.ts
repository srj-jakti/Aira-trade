import { z } from 'zod';

// Credential Schemas
export const credentialsSchema = z.object({
  zerodha_api_key: z.string().min(1).max(100).optional(),
  zerodha_api_secret: z.string().min(1).max(200).optional(),
  zerodha_access_token: z.string().max(500).optional(),
  openai_api_key: z.string().min(1).max(200).optional(),
  anthropic_api_key: z.string().min(1).max(200).optional(),
});

// Trading Settings Schemas
export const tradingSettingsSchema = z.object({
  auto_trading_enabled: z.boolean().optional(),
  risk_appetite: z.enum(["low", "medium", "high"]).optional(),
  preferred_markets: z.array(z.string()).optional(),
  daily_profit_limit: z.number().min(0).optional(),
  daily_loss_limit: z.number().min(0).optional(),
});

// Profile Schema
export const profileSchema = z.object({
  full_name: z.string().min(1).max(100).optional(),
  phone: z.string().max(20).optional(),
  avatar_url: z.string().url().optional().nullable(),
});

// Admin Schemas
export const userApprovalSchema = z.object({
  userId: z.string().uuid(),
  approved: z.boolean(),
});

export const adminConfigSchema = z.object({
  key: z.string().min(1).max(100),
  value: z.string(),
  encrypted: z.boolean().default(false),
});

// Generic ID Schema
export const uuidSchema = z.string().uuid();
