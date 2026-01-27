"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLatestCandles = getLatestCandles;
exports.getStrategy = getStrategy;
exports.evaluateWithAI = evaluateWithAI;
exports.evaluateWithRules = evaluateWithRules;
exports.checkKillSwitches = checkKillSwitches;
const supabase_1 = require("./utils/supabase");
const logger_1 = require("./utils/logger");
const crypto_1 = require("crypto");
const zairoth_1 = require("../../../src/lib/zairoth");
const redis_1 = require("./utils/redis");
const rl_scorer_1 = require("./rl-scorer");
const market_context_1 = require("./market-context");
const trade_filter_1 = require("./trade-filter");
const ALGORITHM = "aes-256-gcm";
function getEncryptionKey() {
    const key = process.env.ENCRYPTION_KEY;
    if (!key || key.length !== 64) {
        throw new Error("ENCRYPTION_KEY must be 32 bytes (64 hex characters)");
    }
    return Buffer.from(key, "hex");
}
function decrypt(ciphertext) {
    try {
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
    catch (err) {
        logger_1.logger.error("Decryption failed", err);
        return ciphertext; // Fallback to raw if not encrypted (risk)
    }
}
async function getActiveAIConfig() {
    const { data, error } = await supabase_1.supabase
        .from("admin_ai_configs")
        .select("*")
        .eq("is_active", true)
        .order("priority", { ascending: false })
        .limit(1)
        .single();
    if (error || !data)
        return null;
    return {
        ...data,
        api_key: decrypt(data.api_key)
    };
}
async function callAI(config, messages) {
    try {
        let url = "";
        let body = {};
        let headers = {
            "Content-Type": "application/json",
        };
        if (config.provider === "openai") {
            url = "https://api.openai.com/v1/chat/completions";
            headers["Authorization"] = `Bearer ${config.api_key}`;
            body = {
                model: config.model || "gpt-4o",
                messages,
                response_format: { type: "json_object" },
            };
        }
        else if (config.provider === "anthropic") {
            url = "https://api.anthropic.com/v1/messages";
            headers["x-api-key"] = config.api_key;
            headers["anthropic-version"] = "2023-06-01";
            body = {
                model: config.model || "claude-3-5-sonnet-20240620",
                max_tokens: 1024,
                messages: messages.map(m => m.role === "system" ? { role: "user", content: `System Instruction: ${m.content}` } : m),
            };
        }
        else if (config.provider === "groq") {
            url = "https://api.groq.com/openai/v1/chat/completions";
            headers["Authorization"] = `Bearer ${config.api_key}`;
            body = {
                model: config.model || "llama-3.1-70b-versatile",
                messages,
                response_format: { type: "json_object" },
            };
        }
        const response = await fetch(url, {
            method: "POST",
            headers,
            body: JSON.stringify(body),
        });
        const data = await response.json();
        if (config.provider === "anthropic") {
            return data.content?.[0]?.text || null;
        }
        return data.choices?.[0]?.message?.content || null;
    }
    catch (err) {
        logger_1.logger.error(`AI call failed (${config.provider}):`, err);
        return null;
    }
}
/**
 * EXPERT VALIDATION: Discretionary logic to filter "bad" signals
 * Mimics how a human trader looks at a setup.
 */
function validateExpertEntry(candles, action) {
    if (candles.length < 5)
        return { ok: true };
    const last = candles[candles.length - 1];
    const prev = candles[candles.length - 2];
    // 1. Candle Quality Check: Avoid tiny "Doji" entries or massive exhaustion candles
    const bodySize = Math.abs(last.close - last.open);
    const range = last.high - last.low;
    const avgRange = candles.slice(-10).reduce((acc, c) => acc + (c.high - c.low), 0) / 10;
    if (bodySize < range * 0.1)
        return { ok: false, reason: "Doji/Indecision candle at entry" };
    if (range > avgRange * 3)
        return { ok: false, reason: "Exhaustion candle detected" };
    // 2. Volume Check: Institutional moves need volume
    const avgVolume = candles.slice(-10).reduce((acc, c) => acc + c.volume, 0) / 10;
    if (last.volume < avgVolume * 0.5)
        return { ok: false, reason: "Low volume conviction" };
    // 3. Mean Reversion Risk: Don't buy if price is too far from EMA
    const ema20 = last.indicators?.EMA_20 || last.indicators?.EMA_21;
    if (ema20) {
        const dist = ((last.close - ema20) / ema20) * 100;
        if (action === "BUY" && dist > 2)
            return { ok: false, reason: "Price overextended from EMA20 (Long)" };
        if (action === "SELL" && dist < -2)
            return { ok: false, reason: "Price overextended from EMA20 (Short)" };
    }
    return { ok: true };
}
const MIN_CANDLES_FOR_EVALUATION = 20;
const RECOMMENDED_CANDLES = 50;
/**
 * Fetches the latest candles for given instruments and timeframe.
 * Prioritizes Redis for low latency, falls back to Supabase.
 */
async function getLatestCandles(instrumentTokens, timeframe) {
    const allCandles = [];
    for (const token of instrumentTokens) {
        try {
            // 1. Try Redis List (last 100 candles)
            const listKey = redis_1.REDIS_KEYS.CANDLE_LIST(token, timeframe);
            const cachedCandles = await redis_1.redis.lrange(listKey, 0, -1);
            if (cachedCandles && cachedCandles.length > 0) {
                const parsed = cachedCandles.map(c => {
                    const data = JSON.parse(c);
                    return {
                        instrument_token: data.token,
                        timeframe: data.timeframe,
                        bucket_start: new Date(data.bucketStart).toISOString(),
                        open: data.open,
                        high: data.high,
                        low: data.low,
                        close: data.close,
                        volume: data.volume || 0,
                        oi: data.oi || 0,
                        indicators: data.indicators
                    };
                });
                // Add live candle (if exists and newer than last closed candle)
                const liveKey = redis_1.REDIS_KEYS.LIVE_CANDLE(token, timeframe);
                const liveCandleRaw = await redis_1.redis.get(liveKey);
                if (liveCandleRaw) {
                    const data = JSON.parse(liveCandleRaw);
                    const liveCandle = {
                        instrument_token: data.token,
                        timeframe: data.timeframe,
                        bucket_start: new Date(data.bucketStart).toISOString(),
                        open: data.open,
                        high: data.high,
                        low: data.low,
                        close: data.close,
                        volume: data.volume || 0,
                        oi: data.oi || 0,
                        indicators: data.indicators
                    };
                    if (parsed.length === 0 || liveCandle.bucket_start > parsed[parsed.length - 1].bucket_start) {
                        parsed.push(liveCandle);
                    }
                }
                allCandles.push(...parsed);
                continue;
            }
            // 2. Fallback to Supabase
            const { data: dbCandles, error } = await supabase_1.supabase
                .from("live_candles")
                .select("*")
                .eq("instrument_token", token)
                .eq("timeframe", timeframe)
                .order("timestamp", { ascending: false })
                .limit(RECOMMENDED_CANDLES);
            if (dbCandles && !error) {
                const formatted = dbCandles.map(c => ({
                    instrument_token: c.instrument_token,
                    timeframe: c.timeframe,
                    bucket_start: c.timestamp,
                    open: c.open,
                    high: c.high,
                    low: c.low,
                    close: c.close,
                    volume: c.volume,
                    oi: c.oi,
                    indicators: c.indicators
                })).reverse();
                allCandles.push(...formatted);
            }
        }
        catch (err) {
            logger_1.logger.error(`Error fetching candles for ${token}:`, err);
        }
    }
    return allCandles;
}
async function getStrategy(strategyId) {
    const { data, error } = await supabase_1.supabase
        .from("strategies")
        .select("*")
        .eq("id", strategyId)
        .single();
    if (error || !data)
        return null;
    return data;
}
// In-memory persistent state for Signal Memory
const SIGNAL_WINDOW = 5;
async function loadSignalMemory(userId, strategyId, instrumentToken) {
    const { data, error } = await supabase_1.supabase
        .from("railway_signal_memory")
        .select("state")
        .eq("user_id", userId)
        .eq("strategy_id", strategyId)
        .eq("instrument_token", instrumentToken)
        .single();
    if (error || !data)
        return null;
    return data.state;
}
async function saveSignalMemory(userId, strategyId, instrumentToken, state) {
    await supabase_1.supabase
        .from("railway_signal_memory")
        .upsert({
        user_id: userId,
        strategy_id: strategyId,
        instrument_token: instrumentToken,
        state,
        updated_at: new Date().toISOString()
    }, { onConflict: "user_id,strategy_id,instrument_token" });
}
function getSetupKey(userId, strategyId, instrumentToken) {
    return `${userId}:${strategyId}:${instrumentToken}`;
}
function getRuleName(rule) {
    switch (rule.type) {
        case "indicator": return `${rule.name}(${rule.period || 14})`;
        case "price_vs_indicator": return `Price vs ${rule.indicator}(${rule.indicatorPeriod})`;
        case "indicator_vs_indicator": return `${rule.indicator1} vs ${rule.indicator2}`;
        case "trend": return `${rule.indicator} ${rule.direction || ""}`;
        case "pattern": return rule.pattern || "Pattern";
        case "price_action": return rule.action || "Price Action";
        case "volume": return "Volume";
        default: return "Unknown";
    }
}
function classifyRuleRole(rule, ruleIndex, totalRules) {
    if (rule.type === "trend" && rule.indicator === "SUPERTREND")
        return "INTENT";
    if (rule.type === "price_vs_indicator" && (rule.operator === "CROSS_ABOVE" || rule.operator === "CROSS_BELOW"))
        return "INTENT";
    if (rule.type === "indicator_vs_indicator" && (rule.operator === "CROSS_ABOVE" || rule.operator === "CROSS_BELOW"))
        return "INTENT";
    if (rule.type === "indicator" && rule.name === "RSI")
        return "CONFIRMATION";
    if (rule.type === "indicator" && rule.name === "ADX")
        return "CONFIRMATION";
    if (ruleIndex === 0)
        return "INTENT";
    return "CONFIRMATION";
}
async function evaluateWithAI(strategy, candles, userConfig) {
    const instrumentToken = candles.length > 0 ? candles[0].instrument_token : null;
    if (!instrumentToken)
        return null;
    const instrumentCandles = candles
        .filter(c => c.instrument_token === instrumentToken)
        .sort((a, b) => new Date(a.bucket_start).getTime() - new Date(b.bucket_start).getTime());
    // 1. ANALYZE MARKET CONTEXT
    const context = market_context_1.MarketContextEngine.analyze(instrumentCandles);
    logger_1.logger.info(`[CONTEXT] ${instrumentToken}: Regime=${context.regime}, Volatility=${context.volatility}, Structure=${context.marketStructure}`);
    // 2. RL KNOWLEDGE ENGINE PRE-CHECK
    const patternType = (0, rl_scorer_1.extractPatternType)(strategy.zairoth_intent || strategy.name || "");
    const rlScore = await (0, rl_scorer_1.getRLScoreForInstrument)(instrumentToken, patternType, strategy.timeframe, { trend: context.regime.includes("UP") ? "UPTREND" : context.regime.includes("DOWN") ? "DOWNTREND" : "SIDEWAYS", volatility: context.volatility });
    // Block trade if RL score indicates AVOID or STRONG_AVOID
    if (rlScore.recommendation === "STRONG_AVOID") {
        logger_1.logger.warn(`[RL] Blocking trade for ${instrumentToken}: ${rlScore.reasoning}`);
        return null;
    }
    // 3. ZAIROTH SAFETY CHECK
    if (strategy.zairoth_intent) {
        const zairoth = (0, zairoth_1.processZairothSafe)(strategy.zairoth_intent);
        if (zairoth.success) {
            const safety = (0, zairoth_1.evaluateSafety)(zairoth.result.instructions, {
                capital_used: userConfig.capital_used || 0,
                risk_per_trade: userConfig.risk_per_trade
            });
            if (!safety.safe) {
                logger_1.logger.warn(`[ZAIROTH] Safety check failed for ${strategy.name}: ${safety.reason}`);
                return null;
            }
        }
    }
    // 4. RULE-BASED EVALUATION (with context awareness)
    const ruleResult = await evaluateWithRules(strategy, candles, userConfig.user_id, context);
    if (ruleResult) {
        const filter = trade_filter_1.TradeFilter.evaluate(ruleResult, context, rlScore);
        if (filter.allow) {
            ruleResult.confidence = filter.adjustedConfidence;
            ruleResult.reasoning += ` [Filter: ${filter.reason}]`;
            return ruleResult;
        }
        logger_1.logger.info(`[FILTER] Rule-based signal rejected: ${filter.reason}`);
    }
    // 5. SEMANTIC AI EVALUATION (The "Human Eye")
    const aiConfig = await getActiveAIConfig();
    if (!aiConfig)
        return null;
    const recentCandles = instrumentCandles.slice(-25);
    const messages = [
        {
            role: "system",
            content: `ROLE: Institutional Systematic Trader.
OBJECTIVE: Identify high-probability institutional setups.

MARKET CONTEXT:
- Regime: ${context.regime}
- Trend Strength: ${context.trendStrength}/100
- Volatility: ${context.volatility}
- Structure: ${context.marketStructure}
- RSI: ${context.rsi.toFixed(2)}
- EMA Distance: ${context.distanceFromEMA.toFixed(2)}%

INSTITUTIONAL CRITERIA:
1. Don't buy into resistance or sell into support.
2. Avoid chasing vertical moves (high EMA distance).
3. Look for "stop hunts" or liquidity sweeps.
4. Trend alignment: Only trade in the direction of ${context.regime} unless it's a clear exhaustion reversal.

Respond ONLY with JSON:
{
  "signal": "BUY" | "SELL" | "HOLD",
  "confidence": 0-100,
  "tp_sl_ratio": number,
  "reasoning": "Technical justification based on context"
}`,
        },
        {
            role: "user",
            content: `Analyze setup for ${strategy.name}. 
Intent: ${strategy.zairoth_intent || "N/A"}
Candles: ${JSON.stringify(recentCandles.map(c => ({
                t: c.bucket_start,
                o: c.open,
                h: c.high,
                l: c.low,
                c: c.close,
                v: c.volume,
                rsi: c.indicators?.RSI_14,
                ema: c.indicators?.EMA_20
            })))}`,
        },
    ];
    const result = await callAI(aiConfig, messages);
    if (!result)
        return null;
    try {
        const parsed = JSON.parse(result);
        if (parsed.signal === "HOLD")
            return null;
        const tempSignal = {
            action: parsed.signal,
            instrument: `TOKEN_${instrumentToken}`,
            instrumentToken: instrumentToken,
            price: instrumentCandles[instrumentCandles.length - 1].close,
            stopLoss: 0, // Calculated below
            target: 0, // Calculated below
            confidence: parsed.confidence,
            reasoning: parsed.reasoning
        };
        const filter = trade_filter_1.TradeFilter.evaluate(tempSignal, context, rlScore);
        if (!filter.allow) {
            logger_1.logger.info(`[FILTER] AI Signal rejected: ${filter.reason}`);
            return null;
        }
        // Expert Heuristics Check
        const expertCheck = validateExpertEntry(instrumentCandles, parsed.signal);
        if (!expertCheck.ok) {
            logger_1.logger.info(`[EXPERT] AI Signal rejected: ${expertCheck.reason}`);
            return null;
        }
        const last = instrumentCandles[instrumentCandles.length - 1];
        return {
            action: parsed.signal,
            instrument: `TOKEN_${last.instrument_token}`,
            instrumentToken: last.instrument_token,
            price: last.close,
            stopLoss: last.close * (parsed.signal === "BUY" ? 0.99 : 1.01),
            target: last.close * (parsed.signal === "BUY" ? 1.03 : 0.97),
            confidence: filter.adjustedConfidence,
            reasoning: `[SEMANTIC AI] ${parsed.reasoning} [Filter: ${filter.reason}]`,
        };
    }
    catch {
        return null;
    }
}
function evaluateExecutableRule(rule, candles, index, indicatorCache) {
    const candle = candles[index];
    const prevCandle = index > 0 ? candles[index - 1] : null;
    const getIndicator = (name, period) => {
        const key = period ? `${name}_${period}` : name;
        const data = indicatorCache.get(key);
        return data ? data[index] : NaN;
    };
    const compare = (left, op, right, prevLeft, prevRight) => {
        if (isNaN(left) || isNaN(right))
            return false;
        switch (op) {
            case ">": return left > right;
            case "<": return left < right;
            case ">=": return left >= right;
            case "<=": return left <= right;
            case "==": return Math.abs(left - right) < 0.0001;
            case "CROSS_ABOVE":
                return prevLeft !== undefined && prevRight !== undefined && !isNaN(prevLeft) && !isNaN(prevRight) && prevLeft < prevRight && left >= right;
            case "CROSS_BELOW":
                return prevLeft !== undefined && prevRight !== undefined && !isNaN(prevLeft) && !isNaN(prevRight) && prevLeft > prevRight && left <= right;
            default: return false;
        }
    };
    switch (rule.type) {
        case "indicator": {
            const val = getIndicator(rule.name, rule.period);
            const prevVal = index > 0 ? (indicatorCache.get(`${rule.name}_${rule.period || 14}`)?.[index - 1] ?? NaN) : NaN;
            return compare(val, rule.operator, rule.value, prevVal, rule.value);
        }
        case "price_vs_indicator": {
            const price = candle[rule.priceField];
            const indVal = getIndicator(rule.indicator, rule.indicatorPeriod);
            const prevPrice = prevCandle ? prevCandle[rule.priceField] : NaN;
            const prevInd = index > 0 ? (indicatorCache.get(`${rule.indicator}_${rule.indicatorPeriod || 14}`)?.[index - 1] ?? NaN) : NaN;
            return compare(price, rule.operator, indVal, prevPrice, prevInd);
        }
        case "trend": {
            if (rule.indicator === "SUPERTREND") {
                const dir = getIndicator("SUPERTREND_DIR");
                return rule.direction === "BULLISH" ? dir === 1 : dir === -1;
            }
            else if (rule.indicator === "ADX") {
                const adx = getIndicator("ADX", 14);
                return adx > (rule.threshold || 25);
            }
            return false;
        }
        case "pattern": {
            if (rule.pattern === "BULLISH_CANDLE")
                return candle.close > candle.open;
            if (rule.pattern === "BEARISH_CANDLE")
                return candle.close < candle.open;
            return false;
        }
        case "price_action": {
            if (rule.action === "BULLISH_CANDLE")
                return candle.close > candle.open;
            if (rule.action === "BEARISH_CANDLE")
                return candle.close < candle.open;
            if (rule.action === "HIGHER_HIGH")
                return prevCandle ? candle.high > prevCandle.high : false;
            if (rule.action === "LOWER_LOW")
                return prevCandle ? candle.low < prevCandle.low : false;
            return false;
        }
        case "volume": {
            const vol = candle.volume;
            return compare(vol, rule.operator, rule.value || 100000);
        }
        default:
            return false;
    }
}
function calculateSimpleIndicators(candles) {
    const cache = new Map();
    const closes = candles.map(c => c.close);
    const n = candles.length;
    const calcSMA = (period) => {
        const result = new Array(n).fill(NaN);
        for (let i = period - 1; i < n; i++) {
            let sum = 0;
            for (let j = 0; j < period; j++)
                sum += closes[i - j];
            result[i] = sum / period;
        }
        return result;
    };
    const calcEMA = (period) => {
        const result = new Array(n).fill(NaN);
        const mult = 2 / (period + 1);
        let ema = closes[0];
        for (let i = 0; i < n; i++) {
            ema = (closes[i] - ema) * mult + ema;
            if (i >= period - 1)
                result[i] = ema;
        }
        return result;
    };
    const calcRSI = (period) => {
        const result = new Array(n).fill(NaN);
        let avgGain = 0, avgLoss = 0;
        for (let i = 1; i <= period && i < n; i++) {
            const change = closes[i] - closes[i - 1];
            if (change > 0)
                avgGain += change;
            else
                avgLoss += Math.abs(change);
        }
        avgGain /= period;
        avgLoss /= period;
        for (let i = period; i < n; i++) {
            const change = closes[i] - closes[i - 1];
            if (change > 0) {
                avgGain = (avgGain * (period - 1) + change) / period;
                avgLoss = (avgLoss * (period - 1)) / period;
            }
            else {
                avgGain = (avgGain * (period - 1)) / period;
                avgLoss = (avgLoss * (period - 1) + Math.abs(change)) / period;
            }
            const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
            result[i] = 100 - (100 / (1 + rs));
        }
        return result;
    };
    cache.set("RSI_14", calcRSI(14));
    cache.set("SMA_20", calcSMA(20));
    cache.set("SMA_50", calcSMA(50));
    cache.set("EMA_9", calcEMA(9));
    cache.set("EMA_20", calcEMA(20));
    cache.set("EMA_21", calcEMA(21));
    cache.set("EMA_50", calcEMA(50));
    const supertrendDir = new Array(n).fill(0);
    for (let i = 14; i < n; i++) {
        supertrendDir[i] = closes[i] > closes[i - 1] ? 1 : -1;
    }
    cache.set("SUPERTREND_DIR", supertrendDir);
    return cache;
}
async function evaluateWithRules(strategy, candles, userId, context) {
    if (candles.length < 5)
        return null;
    const instrumentToken = candles[0]?.instrument_token;
    const instrumentCandles = candles
        .filter(c => c.instrument_token === instrumentToken)
        .sort((a, b) => new Date(a.bucket_start).getTime() - new Date(b.bucket_start).getTime());
    if (instrumentCandles.length < 5)
        return null;
    const latestIdx = instrumentCandles.length - 1;
    const latest = instrumentCandles[latestIdx];
    if (strategy.executable_strategy) {
        const exec = strategy.executable_strategy;
        const indicatorCache = calculateSimpleIndicators(instrumentCandles);
        // SIGNAL MEMORY WINDOW LOGIC - Persistent via Supabase
        let state = await loadSignalMemory(userId, strategy.id, instrumentToken);
        if (!state) {
            state = {
                memory: [],
                setup: {
                    state: "IDLE",
                    direction: null,
                    intentSignal: null,
                    confirmations: [],
                    setupCandleIndex: -1,
                    reason: "Initialized",
                    context: context // Store context in setup
                }
            };
        }
        else {
            // Update context if provided
            if (context)
                state.setup.context = context;
        }
        // Clean expired signals
        state.memory = state.memory.filter(s => s.expiresAt >= latestIdx);
        if (state.setup.intentSignal && state.setup.intentSignal.expiresAt < latestIdx) {
            state.setup.state = "INVALIDATED";
            state.setup.reason = "Setup expired";
        }
        const buyRules = exec.buy?.rules || [];
        const sellRules = exec.sell?.rules || [];
        let hasMemoryChange = false;
        // Evaluate Buy Rules
        for (let i = 0; i < buyRules.length; i++) {
            const rule = buyRules[i];
            const passed = evaluateExecutableRule(rule, instrumentCandles, latestIdx, indicatorCache);
            const role = classifyRuleRole(rule, i, buyRules.length);
            if (passed) {
                hasMemoryChange = true;
                const signal = {
                    role,
                    ruleName: getRuleName(rule),
                    triggeredAt: latestIdx,
                    expiresAt: latestIdx + SIGNAL_WINDOW,
                    value: latest.close,
                    direction: "LONG"
                };
                // Add to memory
                const existingIdx = state.memory.findIndex(s => s.role === role && s.ruleName === signal.ruleName && s.direction === "LONG");
                if (existingIdx >= 0)
                    state.memory[existingIdx] = signal;
                else
                    state.memory.push(signal);
                if (role === "INTENT" && state.setup.state === "IDLE") {
                    state.setup = {
                        state: "SETUP_DETECTED",
                        direction: "LONG",
                        intentSignal: signal,
                        confirmations: [],
                        setupCandleIndex: latestIdx,
                        reason: `LONG setup: ${signal.ruleName} triggered`
                    };
                }
                else if (role === "CONFIRMATION" && state.setup.state === "SETUP_DETECTED" && state.setup.direction === "LONG") {
                    state.setup.confirmations.push(signal);
                }
            }
        }
        // Evaluate Sell Rules
        for (let i = 0; i < sellRules.length; i++) {
            const rule = sellRules[i];
            const passed = evaluateExecutableRule(rule, instrumentCandles, latestIdx, indicatorCache);
            const role = classifyRuleRole(rule, i, sellRules.length);
            if (passed) {
                hasMemoryChange = true;
                const signal = {
                    role,
                    ruleName: getRuleName(rule),
                    triggeredAt: latestIdx,
                    expiresAt: latestIdx + SIGNAL_WINDOW,
                    value: latest.close,
                    direction: "SHORT"
                };
                const existingIdx = state.memory.findIndex(s => s.role === role && s.ruleName === signal.ruleName && s.direction === "SHORT");
                if (existingIdx >= 0)
                    state.memory[existingIdx] = signal;
                else
                    state.memory.push(signal);
                if (role === "INTENT" && state.setup.state === "IDLE") {
                    state.setup = {
                        state: "SETUP_DETECTED",
                        direction: "SHORT",
                        intentSignal: signal,
                        confirmations: [],
                        setupCandleIndex: latestIdx,
                        reason: `SHORT setup: ${signal.ruleName} triggered`
                    };
                }
                else if (role === "CONFIRMATION" && state.setup.state === "SETUP_DETECTED" && state.setup.direction === "SHORT") {
                    state.setup.confirmations.push(signal);
                }
            }
        }
        // Determine Final Signal
        const intentSignals = state.memory.filter(s => s.role === "INTENT");
        const confirmSignals = state.memory.filter(s => s.role === "CONFIRMATION");
        const longIntent = intentSignals.find(s => s.direction === "LONG");
        const longConfirm = confirmSignals.find(s => s.direction === "LONG");
        const shortIntent = intentSignals.find(s => s.direction === "SHORT");
        const shortConfirm = confirmSignals.find(s => s.direction === "SHORT");
        let finalAction = null;
        let reasoning = "";
        if (exec.buy.logic === "AND") {
            if (longIntent && longConfirm) {
                finalAction = "BUY";
                reasoning = `LONG: Intent (${longIntent.ruleName}) + Confirmation (${longConfirm.ruleName})`;
            }
        }
        else if (longIntent || longConfirm) {
            finalAction = "BUY";
            reasoning = longIntent ? `LONG Intent: ${longIntent.ruleName}` : `LONG Confirm: ${longConfirm.ruleName}`;
        }
        if (!finalAction) {
            if (exec.sell.logic === "AND") {
                if (shortIntent && shortConfirm) {
                    finalAction = "SELL";
                    reasoning = `SHORT: Intent (${shortIntent.ruleName}) + Confirmation (${shortConfirm.ruleName})`;
                }
            }
            else if (shortIntent || shortConfirm) {
                finalAction = "SELL";
                reasoning = shortIntent ? `SHORT Intent: ${shortIntent.ruleName}` : `SHORT Confirm: ${shortConfirm.ruleName}`;
            }
        }
        // Save state back to Supabase
        if (hasMemoryChange || finalAction) {
            if (finalAction) {
                // Reset state after confirmed signal to avoid duplicate entries
                state.setup.state = "IDLE";
                state.memory = [];
            }
            await saveSignalMemory(userId, strategy.id, instrumentToken, state);
        }
        if (finalAction) {
            // Expert Heuristics Check for Rule-Based Signals
            const expertCheck = validateExpertEntry(instrumentCandles, finalAction);
            if (!expertCheck.ok) {
                logger_1.logger.info(`[EXPERT] Rule-based ${finalAction} rejected: ${expertCheck.reason}`);
                return null;
            }
            const sl = (finalAction === "BUY" ? exec.buyExit?.stopLoss?.value : exec.sellExit?.stopLoss?.value) || 2;
            const tgt = (finalAction === "BUY" ? exec.buyExit?.target?.value : exec.sellExit?.target?.value) || 4;
            const sig = {
                action: finalAction,
                instrument: `TOKEN_${latest.instrument_token}`,
                instrumentToken: latest.instrument_token,
                price: latest.close,
                stopLoss: latest.close * (finalAction === "BUY" ? (1 - sl / 100) : (1 + sl / 100)),
                target: latest.close * (finalAction === "BUY" ? (1 + tgt / 100) : (1 - tgt / 100)),
                confidence: 90,
                reasoning: reasoning
            };
            return sig;
        }
        return null;
    }
    const prev = instrumentCandles[instrumentCandles.length - 2];
    const change = (latest.close - prev.close) / prev.close;
    const checkBuy = () => {
        const logic = strategy.buy_entry_logic?.conditions || [];
        if (logic.length === 0)
            return false;
        if (JSON.stringify(logic).toLowerCase().includes("bullish") && latest.close > latest.open)
            return true;
        if (JSON.stringify(logic).toLowerCase().includes("price >") && latest.close > prev.close)
            return true;
        return false;
    };
    const checkSell = () => {
        const logic = strategy.sell_entry_logic?.conditions || [];
        if (logic.length === 0)
            return false;
        if (JSON.stringify(logic).toLowerCase().includes("bearish") && latest.close < latest.open)
            return true;
        if (JSON.stringify(logic).toLowerCase().includes("price <") && latest.close < prev.close)
            return true;
        return false;
    };
    const buyOk = checkBuy();
    const sellOk = checkSell();
    if (buyOk || sellOk) {
        const action = buyOk ? "BUY" : "SELL";
        // Expert Heuristics Check for Legacy Signals
        const expertCheck = validateExpertEntry(instrumentCandles, action);
        if (!expertCheck.ok) {
            logger_1.logger.info(`[EXPERT] Legacy ${action} rejected: ${expertCheck.reason}`);
            return null;
        }
        return {
            action,
            instrument: `TOKEN_${latest.instrument_token}`,
            instrumentToken: latest.instrument_token,
            price: latest.close,
            stopLoss: latest.close * (action === "BUY" ? 0.98 : 1.02),
            target: latest.close * (action === "BUY" ? 1.04 : 0.96),
            confidence: 75,
            reasoning: "Legacy rule-based signal detected",
        };
    }
    return null;
}
async function checkKillSwitches(userId, userConfig) {
    const { data: flags } = await supabase_1.supabase
        .from("system_flags")
        .select("flag_name, flag_value")
        .in("flag_name", ["DISABLE_TRADING", "SAFE_MODE", "MAINTENANCE_MODE"]);
    for (const flag of flags || []) {
        if (flag.flag_value === true || flag.flag_value === "true") {
            return { triggered: true, reason: `System flag: ${flag.flag_name}` };
        }
    }
    return { triggered: false };
}
//# sourceMappingURL=evaluator.js.map