# 🔒 安全指南 / Security Guide

Lobster Academy SDK 的安全最佳实践和配置指南。
Security best practices and configuration guide for Lobster Academy SDK.

---

## 🛡️ 安全特性 / Security Features

### 1. 密码安全 / Password Security

**PBKDF2 哈希 / PBKDF2 Hashing：**
- 算法 / Algorithm：PBKDF2-SHA512
- 迭代次数 / Iterations：100,000
- 盐长度 / Salt Length：16 字节（随机生成）/ 16 bytes (randomly generated)
- 输出长度 / Output Length：64 字节 / 64 bytes

**时序安全验证 / Timing-Safe Verification：**
```typescript
// 使用 crypto.timingSafeEqual 防止计时攻击
// Use crypto.timingSafeEqual to prevent timing attacks
// 即使密码格式错误也会执行哈希计算
// Hash computation runs even for invalid password formats
```

### 2. 会话管理 / Session Management

**Cookie 配置 / Cookie Configuration：**
```typescript
{
  httpOnly: true,           // 防止 XSS 访问 / Prevent XSS access
  secure: true,             // 仅 HTTPS / HTTPS only
  sameSite: 'lax',          // CSRF 防护 / CSRF protection
  maxAge: 7 * 24 * 60 * 60, // 7 天过期 / 7 days expiry
  path: '/',                // 全站有效 / Valid for entire site
}
```

**会话清理 / Session Cleanup：**
- 自动清理过期会话（24小时）/ Auto-cleanup expired sessions (24 hours)
- 登出时立即删除会话 / Delete session immediately on logout

### 3. CSRF 防护 / CSRF Protection

**Origin/Referer 检查 / Origin/Referer Check：**
```typescript
// 对 POST/PUT/DELETE/PATCH 请求
// For POST/PUT/DELETE/PATCH requests
// 检查 Origin 头是否匹配 Host
// Check if Origin header matches Host
// 如果 Origin 为 null，检查 Referer
// If Origin is null, check Referer
```

### 4. 速率限制 / Rate Limiting

**默认配置 / Default Configuration：**
- 登录 / Login：5 次/分钟/IP / 5 attempts/minute/IP
- 注册 / Register：10 次/分钟/IP / 10 attempts/minute/IP
- API：可配置 / Configurable

**Redis 支持 / Redis Support：**
```typescript
import { createRateLimiter } from 'lobster-academy/rate-limit';

// 使用自定义存储（如 Redis）
// Use custom storage (e.g., Redis)
const limiter = createRateLimiter(redisStore);
```

### 5. 安全响应头 / Security Response Headers

**Content-Security-Policy：**
```
default-src 'self';
script-src 'self' 'unsafe-inline';
style-src 'self' 'unsafe-inline';
img-src 'self' data:;
connect-src 'self';
font-src 'self';
```

**其他头 / Other Headers：**
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`

### 6. 输入消毒 / Input Sanitization

**HTML 转义 / HTML Escaping：**
```typescript
function sanitizeInput(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}
```

### 7. 数据脱敏 / Data Redaction

**自动识别 200+ 种敏感数据 / Auto-detect 200+ sensitive data types：**

| 类别/Category | 示例/Examples | 置信度/Confidence |
|---------------|---------------|-------------------|
| 个人信息/PII | 身份证/ID Card, 护照/Passport, SSN | high |
| 金融数据/Financial | 信用卡/Credit Card, IBAN | high |
| 云密钥/Cloud Keys | AWS, GitHub Token | high |
| AI 密钥/AI Keys | OpenAI, Anthropic | high |

**使用方法 / Usage：**
```typescript
const redactor = new Redactor();

// 脱敏前 / Before redaction
const raw = '我的API密钥是 sk-xxxxxxxxxxxx';
// 脱敏后 / After redaction
const safe = redactor.redactString(raw);
// '我的API密钥是 [REDACTED]'
```

### 8. 数字签名 / Digital Signature

**Ed25519 签名 / Ed25519 Signature：**
- 保证记录不可篡改 / Guarantees tamper-proof records
- 验证数据完整性 / Verifies data integrity
- 非对称加密 / Asymmetric encryption

**使用方法 / Usage：**
```typescript
const keyPair = Signer.generateKeyPair();
const signer = new Signer(keyPair.secretKey);

// 签名 / Sign
const signature = signer.sign(JSON.stringify(record));

// 验证 / Verify
const isValid = Signer.verify(
  JSON.stringify(record),
  signature,
  keyPair.publicKey
);
```

---

## ⚠️ 安全注意事项 / Security Considerations

### 1. 环境变量 / Environment Variables

**永远不要提交 / Never commit：**
```bash
# .gitignore
.env
.env.local
.env.*.local
```

**使用示例 / Example：**
```bash
# .env.example
DATABASE_URL=postgresql://user:pass@localhost:5432/db
SESSION_SECRET=your-secret-here
```

### 2. 生产环境配置 / Production Configuration

**必须设置 / Must configure：**
```typescript
// next.config.js
{
  // 启用 HTTPS / Enable HTTPS
  // 使用环境变量存储密钥 / Use environment variables for secrets
  // 配置适当的 CSP / Configure proper CSP
  // 启用 HSTS / Enable HSTS
}
```

### 3. 数据库安全 / Database Security

**PostgreSQL 配置 / PostgreSQL Configuration：**
```typescript
{
  // 使用连接池 / Use connection pool
  max: 20,
  
  // 连接加密 / Connection encryption
  ssl: {
    rejectUnauthorized: true,
    ca: fs.readFileSync('/path/to/ca-cert.pem'),
  },
  
  // 查询超时 / Query timeout
  statement_timeout: 30000,
}
```

### 4. 文件权限 / File Permissions

**数据目录 / Data Directory：**
```bash
# 确保数据目录权限正确 / Ensure correct data directory permissions
chmod 700 data/
chmod 600 data/*.json
```

### 5. 日志安全 / Log Security

**不要记录 / Do not log：**
- 密码（即使是哈希）/ Passwords (even hashed)
- 会话令牌 / Session tokens
- API 密钥 / API keys
- 个人信息 / Personal information

**正确做法 / Correct approach：**
```typescript
console.log('User logged in:', { userId: user.id }); // ✅
console.log('User logged in:', user); // ❌ 可能包含敏感信息 / May contain sensitive info
```

---

## 🔍 安全审计清单 / Security Audit Checklist

### 部署前检查 / Pre-deployment Check

- [ ] 所有密码已哈希存储 / All passwords hashed
- [ ] Cookie 配置正确 / Cookie configuration correct
- [ ] CSRF 防护已启用 / CSRF protection enabled
- [ ] 速率限制已配置 / Rate limiting configured
- [ ] 安全响应头已设置 / Security headers set
- [ ] 输入已消毒 / Input sanitized
- [ ] 敏感数据已脱敏 / Sensitive data redacted
- [ ] 环境变量未提交 / Environment variables not committed
- [ ] 数据库连接已加密 / Database connection encrypted
- [ ] 文件权限正确 / File permissions correct
- [ ] 日志不包含敏感信息 / Logs don't contain sensitive info

### 定期检查 / Regular Check

- [ ] 更新依赖 / Update dependencies (`npm audit`)
- [ ] 检查已知漏洞 / Check known vulnerabilities
- [ ] 审查访问日志 / Review access logs
- [ ] 轮换密钥和令牌 / Rotate keys and tokens
- [ ] 备份数据 / Backup data

---

## 🚨 漏洞报告 / Vulnerability Report

如果发现安全漏洞，请通过以下方式报告：
If you discover a security vulnerability, please report it via:

1. **不要**在公开 Issue 中披露 / **Do not** disclose in public Issues
2. 发送邮件至 / Send email to：security@lobster-academy.com
3. 包含详细的漏洞描述和复现步骤 / Include detailed vulnerability description and reproduction steps

我们会尽快响应并修复。
We will respond and fix as soon as possible.

---

## 📚 更多资源 / Additional Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js 安全最佳实践 / Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [Next.js 安全指南 / Security Guide](https://nextjs.org/docs/advanced-features/security-headers)
