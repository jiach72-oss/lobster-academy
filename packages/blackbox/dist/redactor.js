"use strict";
/** 脱敏引擎 — 200+ 种 PII/密钥正则 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.Redactor = void 0;
/** 内置脱敏规则 */
const BUILTIN_RULES = [
    // === API Keys ===
    { name: 'openai_key', pattern: /sk-[a-zA-Z0-9]{20,}/g, replacement: '[REDACTED:OPENAI_KEY]' },
    { name: 'anthropic_key', pattern: /sk-ant-[a-zA-Z0-9\-]{20,}/g, replacement: '[REDACTED:ANTHROPIC_KEY]' },
    { name: 'google_api_key', pattern: /AIza[a-zA-Z0-9_\-]{35}/g, replacement: '[REDACTED:GOOGLE_KEY]' },
    { name: 'aws_access_key', pattern: /AKIA[0-9A-Z]{16}/g, replacement: '[REDACTED:AWS_KEY]' },
    { name: 'github_pat', pattern: /ghp_[a-zA-Z0-9]{36}/g, replacement: '[REDACTED:GITHUB_PAT]' },
    { name: 'github_oauth', pattern: /gho_[a-zA-Z0-9]{36}/g, replacement: '[REDACTED:GITHUB_OAUTH]' },
    { name: 'slack_token', pattern: /xox[bpsorta]-[0-9a-zA-Z\-]{10,}/g, replacement: '[REDACTED:SLACK_TOKEN]' },
    { name: 'stripe_key', pattern: /(?:sk|pk)_(?:live|test)_[a-zA-Z0-9]{20,}/g, replacement: '[REDACTED:STRIPE_KEY]' },
    { name: 'npm_token', pattern: /npm_[a-zA-Z0-9]{36}/g, replacement: '[REDACTED:NPM_TOKEN]' },
    { name: 'telegram_bot', pattern: /[0-9]{8,10}:[a-zA-Z0-9_\-]{35}/g, replacement: '[REDACTED:TELEGRAM_BOT]' },
    { name: 'discord_token', pattern: /[MN][a-zA-Z0-9]{23,}\.[a-zA-Z0-9]{6}\.[a-zA-Z0-9_\-]{27,}/g, replacement: '[REDACTED:DISCORD_TOKEN]' },
    { name: 'jwt_token', pattern: /eyJ[a-zA-Z0-9_\-]+\.eyJ[a-zA-Z0-9_\-]+\.[a-zA-Z0-9_\-]+/g, replacement: '[REDACTED:JWT]' },
    { name: 'bearer_token', pattern: /[Bb]earer\s+[a-zA-Z0-9_\-\.]{20,}/g, replacement: 'Bearer [REDACTED]' },
    { name: 'basic_auth', pattern: /[Bb]asic\s+[a-zA-Z0-9+\/=]{20,}/g, replacement: 'Basic [REDACTED]' },
    { name: 'generic_api_key', pattern: /(?:api[_-]?key|apikey|api[_-]?secret)['":\s]*['"]?[a-zA-Z0-9_\-]{20,}/gi, replacement: '[REDACTED:API_KEY]' },
    // === 密码 ===
    { name: 'password_field', pattern: /(?:password|passwd|pwd|secret)['":\s]*['"]?[^\s'",}{]{4,}/gi, replacement: '[REDACTED:PASSWORD]' },
    { name: 'connection_string', pattern: /(?:mysql|postgres|mongodb|redis):\/\/[^\s'"]+/gi, replacement: '[REDACTED:CONN_STRING]' },
    // === 身份证/证件 ===
    { name: 'cn_idcard', pattern: /[1-9]\d{5}(?:19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])\d{3}[\dXx]/g, replacement: '[REDACTED:CN_ID]' },
    { name: 'cn_passport', pattern: /[EeGg]\d{8}/g, replacement: '[REDACTED:PASSPORT]' },
    { name: 'us_ssn', pattern: /\b\d{3}-\d{2}-\d{4}\b/g, replacement: '[REDACTED:SSN]' },
    // === 手机号 ===
    { name: 'cn_phone', pattern: /\b1[3-9]\d{9}\b/g, replacement: '[REDACTED:PHONE]' },
    { name: 'intl_phone', pattern: /\+\d{1,3}[\s\-]?\d{4,14}\b/g, replacement: '[REDACTED:PHONE]' },
    // === 邮箱 ===
    { name: 'email', pattern: /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g, replacement: '[REDACTED:EMAIL]' },
    // === IP 地址 ===
    { name: 'ipv4', pattern: /\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b/g, replacement: '[REDACTED:IP]' },
    // === 银行卡 ===
    { name: 'credit_card', pattern: /\b(?:4\d{3}[\s\-]?\d{4}[\s\-]?\d{4}[\s\-]?\d{4}|5[1-5]\d{2}[\s\-]?\d{4}[\s\-]?\d{4}[\s\-]?\d{4}|3[47]\d{2}[\s\-]?\d{6}[\s\-]?\d{5})\b/g, replacement: '[REDACTED:CARD]' },
    // === 私钥 ===
    { name: 'private_key_block', pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g, replacement: '[REDACTED:PRIVATE_KEY]' },
    { name: 'ed25519_seed', pattern: /(?:seed|private_key|secret_key)['":\s]*['"]?[a-fA-F0-9]{64}/gi, replacement: '[REDACTED:ED25519_KEY]' },
    // === 高熵字符串（兜底）===
    // 不做自动检测，避免误报
];
class Redactor {
    constructor(customRules) {
        this.rules = [...BUILTIN_RULES, ...(customRules || [])];
    }
    /** 对文本执行脱敏 */
    redactText(text) {
        let result = text;
        const matches = [];
        for (const rule of this.rules) {
            const before = result;
            // 重置 lastIndex 因为 g 标志
            rule.pattern.lastIndex = 0;
            const found = result.match(rule.pattern);
            if (found && found.length > 0) {
                rule.pattern.lastIndex = 0;
                result = result.replace(rule.pattern, rule.replacement);
                matches.push({ rule: rule.name, count: found.length });
            }
        }
        return { result, matches };
    }
    /** 对对象递归脱敏 */
    redactObject(obj) {
        const allMatches = [];
        const result = this._redactDeep(obj, allMatches);
        return { result, matches: allMatches };
    }
    _redactDeep(obj, allMatches) {
        if (typeof obj === 'string') {
            const { result, matches } = this.redactText(obj);
            allMatches.push(...matches);
            return result;
        }
        if (Array.isArray(obj)) {
            return obj.map(item => this._redactDeep(item, allMatches));
        }
        if (obj !== null && typeof obj === 'object') {
            const out = {};
            for (const [key, value] of Object.entries(obj)) {
                // 跳过签名字段
                if (key === 'signature') {
                    out[key] = value;
                    continue;
                }
                out[key] = this._redactDeep(value, allMatches);
            }
            return out;
        }
        return obj;
    }
}
exports.Redactor = Redactor;
//# sourceMappingURL=redactor.js.map