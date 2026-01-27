"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.supabase = void 0;
const supabase_js_1 = require("@supabase/supabase-js");
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseServiceKey) {
    console.error("[Supabase] Missing credentials");
    process.exit(1);
}
exports.supabase = (0, supabase_js_1.createClient)(supabaseUrl, supabaseServiceKey);
//# sourceMappingURL=supabase.js.map