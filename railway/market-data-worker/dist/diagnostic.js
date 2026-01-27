"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const supabase_js_1 = require("@supabase/supabase-js");
const crypto_1 = require("crypto");
const dotenv = __importStar(require("dotenv"));
dotenv.config();
const ALGORITHM = "aes-256-gcm";
function getEncryptionKey() {
    const key = process.env.ENCRYPTION_KEY;
    if (!key || key.length !== 64) {
        throw new Error("ENCRYPTION_KEY must be 32 bytes (64 hex characters)");
    }
    return Buffer.from(key, "hex");
}
function decrypt(ciphertext) {
    const [ivHex, authTagHex, encrypted] = ciphertext.split(":");
    if (!ivHex || !authTagHex || !encrypted) {
        throw new Error("Invalid encrypted format");
    }
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    const decipher = (0, crypto_1.createDecipheriv)(ALGORITHM, getEncryptionKey(), iv);
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
const supabase = (0, supabase_js_1.createClient)(supabaseUrl, supabaseServiceKey);
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
            }
            catch (e) {
                console.error(`Config ${c.name}: Decryption failed:`, e.message);
            }
        }
    }
}
diagnostic().then(() => console.log("Done"));
//# sourceMappingURL=diagnostic.js.map