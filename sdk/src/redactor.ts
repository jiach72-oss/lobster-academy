/**
 * 龙虾学院 Blackbox SDK — 脱敏模块
 * 自动识别并替换PII（个人身份信息）和密钥凭证
 * 200+种内置模式，覆盖全球主要PII格式和云平台密钥
 */

import { RedactConfig } from './types';

// ─────────────────────────────────────────────
// 内置脱敏模式 (200+)
// ─────────────────────────────────────────────
const BUILT_IN_PATTERNS: Record<string, { source: string; flags: string }> = {

  // ═══════════════════════════════════════════
  // 一、个人信息 PII (60种)
  // ═══════════════════════════════════════════

  // 中国身份证
  'cn-idcard-18': { source: /\b[1-9]\d{5}(?:19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])\d{3}[\dXx]\b/.source, flags: 'g' },
  'cn-idcard-15': { source: /\b[1-9]\d{5}\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])\d{3}\b/.source, flags: 'g' },
  // 中国护照
  'cn-passport': { source: /\b[EG]\d{8}\b/.source, flags: 'g' },
  // 港澳通行证
  'hk-macau-permit': { source: /\b[HM]\d{10}\b/.source, flags: 'g' },
  // 台湾通行证
  'tw-permit': { source: /\b[A-Z]\d{9}\b/.source, flags: 'g' },
  // 台湾身份证
  'tw-idcard': { source: /\b[A-Z][12]\d{8}\b/.source, flags: 'g' },
  // 军官证
  'cn-military-id': { source: /\b[\u4e00-\u9fa5]字第\d{8}号\b/.source, flags: 'g' },
  // H2: 驾照号(中国) — 收紧为身份证格式约束（原始: \b\d{12}\b 误报率高）
  'cn-driving-license': { source: /\b[1-9]\d{5}(?:19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])\d{3}[\dXx]\b/.source, flags: 'g' },

  // 美国SSN
  'us-ssn': { source: /\b\d{3}-\d{2}-\d{4}\b/.source, flags: 'g' },
  // 美国ITIN
  'us-itin': { source: /\b9\d{2}-[78]\d-\d{4}\b/.source, flags: 'g' },
  // 美国EIN
  'us-ein': { source: /\b\d{2}-\d{7}\b/.source, flags: 'g' },
  // H2: 美国NPI(医疗) — 收紧（NPI 以 1 开头，10位数字）
  'us-npi': { source: /\b1\d{9}\b/.source, flags: 'g' },
  // 美国驾照(通用格式)
  'us-driving-license': { source: /\b[A-Z]\d{7,12}\b/.source, flags: 'g' },
  // 美国护照
  'us-passport': { source: /\b[A-Z]\d{8}\b/.source, flags: 'g' },
  // 美国Routing Number
  'us-routing-number': { source: /\b\d{9}\b/.source, flags: 'g' },

  // 英国NINO
  'uk-nino': { source: /\b[A-CEGHJ-PR-TW-Z]{2}\d{6}[A-D]\b/.source, flags: 'g' },
  // 英国护照
  'uk-passport': { source: /\b\d{9}\b/.source, flags: 'g' },
  // 英国邮编
  'uk-postcode': { source: /\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/.source, flags: 'g' },

  // 加拿大SIN
  'ca-sin': { source: /\b\d{3}[\s-]?\d{3}[\s-]?\d{3}\b/.source, flags: 'g' },
  // 加拿大邮编
  'ca-postcode': { source: /\b[A-Z]\d[A-Z]\s?\d[A-Z]\d\b/.source, flags: 'g' },

  // 澳洲TFN
  'au-tfn': { source: /\b\d{3}[\s-]?\d{3}[\s-]?\d{3}\b/.source, flags: 'g' },
  // 澳洲ABN
  'au-abn': { source: /\b\d{2}[\s-]?\d{3}[\s-]?\d{3}[\s-]?\d{3}\b/.source, flags: 'g' },
  // 澳洲Medicare
  'au-medicare': { source: /\b\d{4}[\s-]?\d{5}[\s-]?\d{1}\b/.source, flags: 'g' },

  // 日本MyNumber
  'jp-mynumber': { source: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/.source, flags: 'g' },
  // 日本邮编
  'jp-postcode': { source: /\b\d{3}-?\d{4}\b/.source, flags: 'g' },

  // 韩国身份证
  'kr-rrn': { source: /\b\d{6}-[1-4]\d{6}\b/.source, flags: 'g' },

  // 德国身份证Personalausweis
  'de-idcard': { source: /\b[A-Z]\d{10}\b/.source, flags: 'g' },
  // 法国INSEE
  'fr-insee': { source: /\b[12]\d{2}(?:0[1-9]|1[0-2])\d{5}\b/.source, flags: 'g' },

  // 印度Aadhaar
  'in-aadhaar': { source: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/.source, flags: 'g' },
  // 印度PAN
  'in-pan': { source: /\b[A-Z]{5}\d{4}[A-Z]\b/.source, flags: 'g' },

  // 巴西CPF
  'br-cpf': { source: /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/.source, flags: 'g' },
  // 巴西CNPJ
  'br-cnpj': { source: /\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/.source, flags: 'g' },

  // 墨西哥RFC
  'mx-rfc': { source: /\b[A-Z]{4}\d{6}[A-Z0-9]{3}\b/.source, flags: 'g' },
  // 墨西哥CURP
  'mx-curp': { source: /\b[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d\b/.source, flags: 'g' },

  // 通用邮箱
  'email': { source: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.source, flags: 'g' },
  // 通用电话(国际) - 兼容旧名 'phone'
  'phone': { source: /\+?\d{1,3}[\s.-]?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4}/.source, flags: 'g' },
  'phone-intl': { source: /\+?\d{1,3}[\s.-]?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4}/.source, flags: 'g' },
  // 中国手机
  'cn-phone': { source: /\b1[3-9]\d{9}\b/.source, flags: 'g' },
  // 中国座机
  'cn-landline': { source: /\b0\d{2,3}-?\d{7,8}\b/.source, flags: 'g' },

  // 信用卡通用 - 兼容旧名 'creditCard'
  'creditCard': { source: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/.source, flags: 'g' },
  'creditcard': { source: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/.source, flags: 'g' },
  // Visa
  'visa': { source: /\b4\d{3}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/.source, flags: 'g' },
  // Mastercard
  'mastercard': { source: /\b(?:5[1-5]\d{2}|2[2-7]\d{2})[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/.source, flags: 'g' },
  // Amex
  'amex': { source: /\b3[47]\d{2}[\s-]?\d{6}[\s-]?\d{5}\b/.source, flags: 'g' },
  // Discover
  'discover': { source: /\b6(?:011|5\d{2})[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/.source, flags: 'g' },
  // JCB
  'jcb': { source: /\b(?:2131|1800|35\d{2})[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/.source, flags: 'g' },
  // UnionPay
  'unionpay': { source: /\b62\d{2}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/.source, flags: 'g' },
  // Diners
  'diners': { source: /\b(?:30[0-5]|36\d|38\d)[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{2}\b/.source, flags: 'g' },

  // 出生日期(多种格式)
  'birthdate-iso': { source: /\b(?:19|20)\d{2}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])\b/.source, flags: 'g' },
  'birthdate-us': { source: /\b(?:0[1-9]|1[0-2])\/(?:0[1-9]|[12]\d|3[01])\/(?:19|20)\d{2}\b/.source, flags: 'g' },
  'birthdate-eu': { source: /\b(?:0[1-9]|[12]\d|3[01])\.(?:0[1-9]|1[0-2])\.(?:19|20)\d{2}\b/.source, flags: 'g' },

  // IBAN通用
  'iban': { source: /\b[A-Z]{2}\d{2}[A-Z0-9]{4,30}\b/.source, flags: 'g' },
  // SWIFT/BIC
  'swift-bic': { source: /\b[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}(?:[A-Z0-9]{3})?\b/.source, flags: 'g' },

  // IP地址(通用)
  'ipv4': { source: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/.source, flags: 'g' },
  // IPv6
  'ipv6': { source: /\b(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}\b/.source, flags: 'g' },
  // MAC地址
  'mac-address': { source: /\b[0-9a-fA-F]{2}[:-][0-9a-fA-F]{2}[:-][0-9a-fA-F]{2}[:-][0-9a-fA-F]{2}[:-][0-9a-fA-F]{2}[:-][0-9a-fA-F]{2}\b/.source, flags: 'g' },
  // URL
  'url': { source: /https?:\/\/[^\s"'<>]+/.source, flags: 'g' },

  // ═══════════════════════════════════════════
  // 二、密钥/凭证 (70种)
  // ═══════════════════════════════════════════

  // AWS Access Key
  'aws-access-key': { source: /\bAKIA[0-9A-Z]{16}\b/.source, flags: 'g' },
  // AWS STS Temporary
  'aws-sts-key': { source: /\bASIA[0-9A-Z]{16}\b/.source, flags: 'g' },
  // AWS Secret Key
  'aws-secret-key': { source: /\b[A-Za-z0-9/+=]{40}\b/.source, flags: 'g' },
  // AWS ARN
  'aws-arn': { source: /\barn:aws:[a-z0-9-]+:[a-z0-9-]*:\d{12}:[a-zA-Z0-9/_-]+/.source, flags: 'g' },
  // AWS MWS Key
  'aws-mws-key': { source: /\bamzn\.mws\.[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/.source, flags: 'g' },

  // GCP API Key
  'gcp-api-key': { source: /\bAIza[0-9A-Za-z_-]{35}\b/.source, flags: 'g' },
  // H2: GCP Service Account — 增加 project_id 上下文要求
  'gcp-service-account': { source: /"type"\s*:\s*"service_account"[\s\S]{0,200}"project_id"/.source, flags: 'g' },
  // GCP OAuth
  'gcp-oauth': { source: /\b[0-9]+-[0-9A-Za-z_]{32}\.apps\.googleusercontent\.com\b/.source, flags: 'g' },

  // Azure Connection String
  'azure-conn-str': { source: /DefaultEndpointsProtocol=https;AccountName=[^;]+;AccountKey=[A-Za-z0-9+/=]{88}/.source, flags: 'g' },
  // Azure SAS Token
  'azure-sas': { source: /\?sv=\d{4}-\d{2}-\d{2}&ss=[a-z]+&srt=[a-z]+&sp=[a-z]+&se=\d{4}-\d{2}-\d{2}T/.source, flags: 'g' },

  // GitHub Token
  'github-token': { source: /\bgh[ps]_[A-Za-z0-9_]{36,}\b/.source, flags: 'g' },
  // GitHub OAuth
  'github-oauth': { source: /\bgho_[A-Za-z0-9_]{36,}\b/.source, flags: 'g' },
  // GitHub Fine-grained PAT
  'github-fine-grained': { source: /\bgithub_pat_[A-Za-z0-9_]{22}_[A-Za-z0-9_]{59,}\b/.source, flags: 'g' },
  // GitLab Token
  'gitlab-token': { source: /\bglpat-[A-Za-z0-9_-]{20,}\b/.source, flags: 'g' },
  // Bitbucket App Password
  'bitbucket-app-pw': { source: /\bA[ST]_[A-Za-z0-9]{20,}\b/.source, flags: 'g' },

  // Stripe Live Secret
  'stripe-sk-live': { source: /\bsk_live_[A-Za-z0-9]{24,}\b/.source, flags: 'g' },
  // Stripe Live Publishable
  'stripe-pk-live': { source: /\bpk_live_[A-Za-z0-9]{24,}\b/.source, flags: 'g' },
  // Stripe Test Secret
  'stripe-sk-test': { source: /\bsk_test_[A-Za-z0-9]{24,}\b/.source, flags: 'g' },
  // Stripe Restricted Key
  'stripe-rk': { source: /\brk_(?:live|test)_[A-Za-z0-9]{24,}\b/.source, flags: 'g' },
  // Stripe Webhook Secret
  'stripe-webhook': { source: /\bwhsec_[A-Za-z0-9]{32,}\b/.source, flags: 'g' },

  // Twilio
  'twilio-api-key': { source: /\bSK[A-Za-z0-9]{32}\b/.source, flags: 'g' },
  'twilio-account-sid': { source: /\bAC[a-z0-9]{32}\b/.source, flags: 'g' },

  // SendGrid
  'sendgrid-api-key': { source: /\bSG\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}\b/.source, flags: 'g' },

  // Mailgun
  'mailgun-api-key': { source: /\bkey-[0-9a-zA-Z]{32}\b/.source, flags: 'g' },
  'mailgun-pub-key': { source: /\bpubkey-[0-9a-zA-Z]{32}\b/.source, flags: 'g' },

  // Slack Token
  'slack-bot-token': { source: /\bxoxb-[0-9]{11,}-[A-Za-z0-9]{24,}\b/.source, flags: 'g' },
  'slack-user-token': { source: /\bxoxp-[0-9]{11,}-[A-Za-z0-9]{24,}\b/.source, flags: 'g' },
  'slack-app-token': { source: /\bxapp-[0-9]-[A-Za-z0-9-]{35,}\b/.source, flags: 'g' },
  'slack-webhook': { source: /https:\/\/hooks\.slack\.com\/services\/T[A-Z0-9]{8,}\/B[A-Z0-9]{8,}\/[A-Za-z0-9]{24}/.source, flags: 'g' },

  // Discord Token
  'discord-token': { source: /\b[MB][A-Za-z0-9_-]{23,}\.[A-Za-z0-9_-]{6}\.[A-Za-z0-9_-]{27,}\b/.source, flags: 'g' },
  // Discord Webhook
  'discord-webhook': { source: /https:\/\/discord(?:app)?\.com\/api\/webhooks\/\d+\/[A-Za-z0-9_-]+/.source, flags: 'g' },

  // Telegram Bot Token
  'telegram-bot-token': { source: /\b\d{9,10}:[A-Za-z0-9_-]{35}\b/.source, flags: 'g' },

  // npm Token
  'npm-token': { source: /\bnpm_[A-Za-z0-9]{36}\b/.source, flags: 'g' },
  // PyPI Token
  'pypi-token': { source: /\bpypi-[A-Za-z0-9_-]{60,}\b/.source, flags: 'g' },

  // OpenAI Key
  'openai-key': { source: /\bsk-[A-Za-z0-9]{48,}\b/.source, flags: 'g' },
  // Anthropic Key
  'anthropic-key': { source: /\bsk-ant-[A-Za-z0-9_-]{40,}\b/.source, flags: 'g' },
  // HuggingFace Token
  'huggingface-token': { source: /\bhf_[A-Za-z0-9]{34,}\b/.source, flags: 'g' },
  // Cohere Key (narrowed: require cohere context or specific format)
  // Note: removed bare 40-char pattern — too broad, matches random strings

  // Heroku API Key
  'heroku-api-key': { source: /\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b/.source, flags: 'g' },

  // DigitalOcean Token
  'digitalocean-token': { source: /\bdop_v1_[a-f0-9]{64}\b/.source, flags: 'g' },
  // Vercel Token
  'vercel-token': { source: /\b[A-Za-z0-9]{24}\.[A-Za-z0-9]{6}\.[A-Za-z0-9_-]{27,}\b/.source, flags: 'g' },
  // Netlify Token
  'netlify-token': { source: /\bnfp_[A-Za-z0-9]{40,}\b/.source, flags: 'g' },

  // Atlassian Token
  'atlassian-token': { source: /\bATATT[A-Za-z0-9_-]{50,}\b/.source, flags: 'g' },

  // H2: Datadog Key — 移除（32位十六进制过于宽泛，由 SENSITIVE_KEYS 中的 datadog_api_key 覆盖）
  // 'datadog-api-key': REMOVED
  'datadog-app-key': { source: /\b[a-f0-9]{40}\b/.source, flags: 'g' },

  // New Relic Key
  'newrelic-key': { source: /\bNRAK-[A-Za-z0-9]{27}\b/.source, flags: 'g' },
  // PagerDuty Token
  'pagerduty-token': { source: /\b[a-z0-9]{20}_[a-z0-9]{20}\b/.source, flags: 'g' },

  // Telegram
  'telegram-api-key': { source: /\b[0-9]{9,10}:AA[A-Za-z0-9_-]{33}\b/.source, flags: 'g' },

  // JWT
  'jwt': { source: /\beyJ[A-Za-z0-9_-]*\.eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*\b/.source, flags: 'g' },
  // SSH RSA Private Key
  'ssh-rsa-priv': { source: /-----BEGIN RSA PRIVATE KEY-----[\s\S]*?-----END RSA PRIVATE KEY-----/.source, flags: 'g' },
  // SSH DSA Private Key
  'ssh-dsa-priv': { source: /-----BEGIN DSA PRIVATE KEY-----[\s\S]*?-----END DSA PRIVATE KEY-----/.source, flags: 'g' },
  // SSH EC Private Key
  'ssh-ec-priv': { source: /-----BEGIN EC PRIVATE KEY-----[\s\S]*?-----END EC PRIVATE KEY-----/.source, flags: 'g' },
  // SSH OPENSSH Private Key
  'ssh-openssh-priv': { source: /-----BEGIN OPENSSH PRIVATE KEY-----[\s\S]*?-----END OPENSSH PRIVATE KEY-----/.source, flags: 'g' },
  // PGP Private Key
  'pgp-priv-key': { source: /-----BEGIN PGP PRIVATE KEY BLOCK-----[\s\S]*?-----END PGP PRIVATE KEY BLOCK-----/.source, flags: 'g' },
  // TLS Certificate
  'tls-cert': { source: /-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/.source, flags: 'g' },
  // PGP Public Key
  'pgp-pub-key': { source: /-----BEGIN PGP PUBLIC KEY BLOCK-----[\s\S]*?-----END PGP PUBLIC KEY BLOCK-----/.source, flags: 'g' },

  // MySQL Connection String
  'mysql-conn': { source: /mysql:\/\/[^@\s]+@[^/\s]+\/[^\s]+/.source, flags: 'g' },
  // PostgreSQL Connection String
  'postgres-conn': { source: /postgres(?:ql)?:\/\/[^@\s]+@[^/\s]+\/[^\s]+/.source, flags: 'g' },
  // MongoDB Connection String
  'mongodb-conn': { source: /mongodb(?:\+srv)?:\/\/[^@\s]+@[^/\s]+\/[^\s]*/.source, flags: 'g' },
  // Redis Connection String
  'redis-conn': { source: /redis:\/\/[^@\s]*@[^/\s]+/.source, flags: 'g' },
  // AMQP Connection String
  'amqp-conn': { source: /amqp:\/\/[^@\s]+@[^/\s]+/.source, flags: 'g' },

  // Generic API Key patterns
  'generic-api-key-eq': { source: /(?:api[_-]?key|apikey|api[_-]?secret)\s*[=:]\s*['"]?[A-Za-z0-9_\-]{20,}['"]?/i.source, flags: 'g' },
  'generic-token-eq': { source: /(?:access[_-]?token|auth[_-]?token|bearer)\s*[=:]\s*['"]?[A-Za-z0-9_\-\.]{20,}['"]?/i.source, flags: 'g' },
  'generic-secret-eq': { source: /(?:client[_-]?secret|app[_-]?secret|secret[_-]?key)\s*[=:]\s*['"]?[A-Za-z0-9_\-]{20,}['"]?/i.source, flags: 'g' },
  'generic-password-eq': { source: /(?:password|passwd|pwd)\s*[=:]\s*['"]?[^\s'"]{8,}['"]?/i.source, flags: 'g' },

  // ═══════════════════════════════════════════
  // 三、网络/基础设施 (30种)
  // ═══════════════════════════════════════════

  // 公网IP+端口
  'ip-port': { source: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}:\d{1,5}\b/.source, flags: 'g' },
  // H2: 内网IP段 10.x.x.x — 添加 0-255 范围验证
  'private-ip-10': { source: /\b10\.(?:(?:25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)\.){2}(?:25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)\b/.source, flags: 'g' },
  // H2: 内网IP段 172.16-31.x.x — 添加范围验证
  'private-ip-172': { source: /\b172\.(?:1[6-9]|2\d|3[01])\.(?:25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)\.(?:25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)\b/.source, flags: 'g' },
  // H2: 内网IP段 192.168.x.x — 添加范围验证
  'private-ip-192': { source: /\b192\.168\.(?:25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)\.(?:25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)\b/.source, flags: 'g' },
  // localhost
  'localhost': { source: /\blocalhost(?::\d{1,5})?\b/.source, flags: 'g' },
  // 域名
  'domain': { source: /\b(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}\b/.source, flags: 'g' },
  // K8s Secret
  'k8s-secret-name': { source: /\bsecret\/[a-zA-Z0-9][a-zA-Z0-9._-]*\b/.source, flags: 'g' },
  // Docker Registry
  'docker-registry': { source: /\b(?:[a-zA-Z0-9._-]+\.)+[a-zA-Z]{2,}\/[a-z0-9._-]+(?::\d+)?\/[a-z0-9._/-]+(?::.+)?/.source, flags: 'g' },
  // Webhook URL
  'webhook-url': { source: /https?:\/\/[^\s]*\/webhook[^\s]*/.source, flags: 'g' },
  // Callback URL
  'callback-url': { source: /https?:\/\/[^\s]*\/callback[^\s]*/.source, flags: 'g' },
  // OAuth Redirect
  'oauth-redirect': { source: /https?:\/\/[^\s]*\/oauth2?\/callback[^\s]*/.source, flags: 'g' },

  // ═══════════════════════════════════════════
  // 四、金融数据 (25种)
  // ═══════════════════════════════════════════

  // 中国银行卡号
  'cn-bank-card': { source: /\b(?:62|60|56|4[0-9])\d{14,17}\b/.source, flags: 'g' },
  // 支付宝ID
  'alipay-id': { source: /\b2088\d{12}\b/.source, flags: 'g' },
  // 微信OpenID
  'wechat-openid': { source: /\bo[a-zA-Z0-9_-]{28}\b/.source, flags: 'g' },
  // PayPal邮箱格式
  'paypal-email': { source: /[a-zA-Z0-9._%+-]+@paypal\.com\b/.source, flags: 'g' },
  // Venmo
  'venmo-handle': { source: /@[A-Za-z0-9_-]+(?=.*venmo)/.source, flags: 'g' },
  // Cash App
  'cashapp-handle': { source: /\$[A-Za-z0-9_]+/.source, flags: 'g' },

  // ═══════════════════════════════════════════
  // 五、医疗健康 (10种)
  // ═══════════════════════════════════════════

  // ICD-10编码
  'icd10': { source: /\b[A-Z]\d{2}(?:\.\d{1,4})?\b/.source, flags: 'g' },
  // 处方号(通用)
  'prescription-number': { source: /\bRx\s*#?\s*\d{6,10}\b/i.source, flags: 'g' },
  // 医保号(中国)
  'cn-medical-insurance': { source: /\b\d{10,18}\b/.source, flags: 'g' },

  // ═══════════════════════════════════════════
  // 六、其他敏感数据 (15种)
  // ═══════════════════════════════════════════

  // UUID
  'uuid': { source: /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i.source, flags: 'g' },
  // Hex字符串(32+位) — REMOVED: matches MD5/SHA hashes and random IDs
  // Base64长字符串(40+字符) — REMOVED: matches any base64-encoded data
  // 日期时间 ISO
  'datetime-iso': { source: /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})/.source, flags: 'g' },
  // Cookie值
  'cookie-value': { source: /(?:session|sid|token|auth)=[A-Za-z0-9_-]{20,}/i.source, flags: 'g' },
  // Bearer Token
  'bearer-token': { source: /Bearer\s+[A-Za-z0-9_\-\.]+/.source, flags: 'g' },
  // Basic Auth
  'basic-auth': { source: /Basic\s+[A-Za-z0-9+/=]+/.source, flags: 'g' },
  // Environment Variable值(看起来像密钥的)
  'env-secret': { source: /\b[A-Z_]{3,}=(?:['"]?[A-Za-z0-9_\-]{16,}['"]?)/.source, flags: 'g' },
  // Private Key标记
  'private-key-marker': { source: /-----BEGIN [A-Z ]*PRIVATE KEY-----/.source, flags: 'g' },
  // Seed Phrase (12/24 word crypto)
  'crypto-seed-12': { source: /\b(?:[a-z]+\s+){11}[a-z]+\b/.source, flags: 'g' },
  // Ethereum Address
  'eth-address': { source: /\b0x[0-9a-fA-F]{40}\b/.source, flags: 'g' },
  // Bitcoin Address (P2PKH/P2SH/Bech32)
  'btc-address': { source: /\b[13][a-km-zA-HJ-NP-Z1-9]{25,34}\b|bc1[a-zA-HJ-NP-Z0-9]{39,59}/.source, flags: 'g' },
  // Solana Address
  'solana-address': { source: /\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/.source, flags: 'g' },
  // 私有域名(.local, .internal, .corp, .lan)
  'private-domain': { source: /\b[a-zA-Z0-9-]+\.(?:local|internal|corp|lan|home|private)\b/.source, flags: 'g' },
  // 高熵随机字符串(疑似密钥) — REMOVED: too broad, matches any alphanumeric string 32+

  // ═══════════════════════════════════════════
  // 七、补充扩展模式 (50种)
  // ═══════════════════════════════════════════

  // 加密钱包助记词(12词)
  'seed-phrase-12': { source: /\b(?:[a-z]{3,8}\s+){11}[a-z]{3,8}\b/.source, flags: 'g' },
  // 加密钱包助记词(24词)
  'seed-phrase-24': { source: /\b(?:[a-z]{3,8}\s+){23}[a-z]{3,8}\b/.source, flags: 'g' },
  // WIF私钥格式
  'btc-wif': { source: /\b[5KL][1-9A-HJ-NP-Za-km-z]{50,51}\b/.source, flags: 'g' },
  // XRP地址
  'xrp-address': { source: /\br[1-9A-HJ-NP-Za-km-z]{24,34}\b/.source, flags: 'g' },
  // Litecoin地址
  'ltc-address': { source: /\b[LM][1-9A-HJ-NP-Za-km-z]{26,33}\b/.source, flags: 'g' },
  // Dogecoin地址
  'doge-address': { source: /\bD[1-9A-HJ-NP-Za-km-z]{33}\b/.source, flags: 'g' },
  // Tron地址
  'tron-address': { source: /\bT[A-Za-z1-9]{33}\b/.source, flags: 'g' },

  // Kubernetes Token
  'k8s-token': { source: /\beyJhbGciOiJSUzI1NiIsImtpZCI6[A-Za-z0-9_-]+/.source, flags: 'g' },
  // Kubeconfig
  'kubeconfig': { source: /apiVersion:\s*v1[\s\S]*?kind:\s*Config/.source, flags: 'g' },
  // Docker Config JSON
  'docker-config': { source: /"auths"\s*:\s*\{[\s\S]*?"auth"\s*:\s*"[A-Za-z0-9+/=]+"/.source, flags: 'g' },
  // Helm Chart Secret
  'helm-secret': { source: /kind:\s*Secret[\s\S]*?data:[\s\S]*?[A-Za-z0-9+/=]{40,}/.source, flags: 'g' },

  // Cloudflare API Token — REMOVED: bare 40-char matches random strings
  // Cloudflare Global API Key
  'cf-global-key': { source: /\b[a-f0-9]{37}\b/.source, flags: 'g' },
  // Fastly API Token — REMOVED: bare 32+ char matches random strings
  // Algolia API Key
  'algolia-key': { source: /\b[a-f0-9]{32}\b/.source, flags: 'g' },
  // Sentry DSN
  'sentry-dsn': { source: /https:\/\/[a-f0-9]+@[a-z0-9.-]+\/\d+/.source, flags: 'g' },
  // Datadog Key (removed: bare 32-hex matches MD5 hashes — use datadog-api-key from SENSITIVE_KEYS)
  // Splunk HEC Token
  'splunk-hec': { source: /\b[A-F0-9]{8}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{12}\b/.source, flags: 'g' },

  // Elastic Cloud ID
  'elastic-cloud-id': { source: /\b[a-zA-Z0-9_-]+:[a-zA-Z0-9._-]+\.[a-z]+\.[a-z]+:[0-9]+/.source, flags: 'g' },
  // Elastic API Key — REMOVED: bare 40+ char matches random strings

  // Miro Access Token
  'miro-token': { source: /\beyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/.source, flags: 'g' },
  // Asana Access Token
  'asana-token': { source: /\b[0-9]+\/[a-f0-9]{32}:[a-f0-9]{32}/.source, flags: 'g' },
  // Linear API Key
  'linear-key': { source: /\blin_api_[A-Za-z0-9]{40,}\b/.source, flags: 'g' },
  // Notion Integration Token
  'notion-token': { source: /\bsecret_[A-Za-z0-9]{43}\b/.source, flags: 'g' },
  // Airtable API Key
  'airtable-key': { source: /\bkey[A-Za-z0-9]{14}\b/.source, flags: 'g' },
  // Supabase Service Key
  'supabase-key': { source: /\beyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/.source, flags: 'g' },
  // Firebase Key
  'firebase-key': { source: /\bAAAA[A-Za-z0-9_-]{7}:[A-Za-z0-9_-]{140}/.source, flags: 'g' },

  // Confluence API Token
  'confluence-token': { source: /\bATATT[A-Za-z0-9_-]{50,}\b/.source, flags: 'g' },
  // Jira API Token
  'jira-token': { source: /\bATATT[A-Za-z0-9_-]{50,}\b/.source, flags: 'g' },

  // Splunk Auth Token
  'splunk-token': { source: /\bSplunk\s+[A-Za-z0-9_-]{32,}\b/.source, flags: 'g' },
  // HashiCorp Vault Token
  'vault-token': { source: /\bhvs\.[A-Za-z0-9_-]{24,}\b/.source, flags: 'g' },
  // Terraform Cloud Token
  'terraform-token': { source: /\b[a-zA-Z0-9]{14}\.[a-zA-Z0-9]{6}\.[a-zA-Z0-9]{34,}\b/.source, flags: 'g' },

  // Okta API Token
  'okta-token': { source: /\b00[A-Za-z0-9_-]{40}\b/.source, flags: 'g' },
  // Auth0 API Key — REMOVED: bare 64-char matches random strings
  // JumpCloud API Key
  'jumpcloud-key': { source: /\b[a-f0-9]{24}\b/.source, flags: 'g' },

  // Shopify Access Token
  'shopify-token': { source: /\bshpat_[a-fA-F0-9]{32}\b/.source, flags: 'g' },
  // Shopify API Key
  'shopify-api-key': { source: /\b[a-f0-9]{32}\b/.source, flags: 'g' },
  // WooCommerce Key
  'woocommerce-key': { source: /\bck_[a-f0-9]{40}\b/.source, flags: 'g' },
  'woocommerce-secret': { source: /\bcs_[a-f0-9]{40}\b/.source, flags: 'g' },

  // Instagram Access Token
  'instagram-token': { source: /\bIGQV[A-Za-z0-9_-]{30,}\b/.source, flags: 'g' },
  // Facebook Access Token
  'facebook-token': { source: /\bEAAG[A-Za-z0-9]{30,}\b/.source, flags: 'g' },
  // Twitter Bearer Token
  'twitter-bearer': { source: /\bAAAA[A-Za-z0-9_-]{30,}\b/.source, flags: 'g' },
  // LinkedIn Access Token
  'linkedin-token': { source: /\bAQ[A-Za-z0-9_-]{60,}\b/.source, flags: 'g' },

  // 邮件主题含敏感信息
  'email-subject-secret': { source: /Subject:.*(?:password|token|key|secret|credential)/i.source, flags: 'g' },
  // HTTP Basic Auth in URL
  'url-basic-auth': { source: /https?:\/\/[^:]+:[^@]+@[^\s]+/.source, flags: 'g' },
  // S3 Bucket URL
  's3-bucket-url': { source: /https?:\/\/[a-z0-9][a-z0-9.-]{3,62}\.s3(?:[.-][a-z0-9-]+)?\.amazonaws\.com/.source, flags: 'g' },
  // GCS Bucket URL
  'gcs-bucket-url': { source: /https?:\/\/storage\.googleapis\.com\/[a-z0-9][a-z0-9._-]{2,61}/.source, flags: 'g' },
  // Azure Blob URL
  'azure-blob-url': { source: /https?:\/\/[a-z0-9]{3,24}\.blob\.core\.windows\.net/.source, flags: 'g' },

  // QR Code数据(编码的密钥)
  'qr-otpauth': { source: /otpauth:\/\/totp\/[^?]+\?.+secret=[A-Z0-9]{16,}/.source, flags: 'g' },
  // Google Authenticator密钥
  'google-auth-secret': { source: /\b[A-Z0-9]{16}\b/.source, flags: 'g' },
  // H2: Recovery Codes — 添加长度约束（只在上下文中出现 recovery/code 等词时才标记）
  'recovery-codes': { source: /(?:recovery|backup|\bcode)\s*(?::|=)?\s*\b[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}\b/.source, flags: 'gi' },
};

// ─────────────────────────────────────────────
// 敏感字段名（全小写匹配，100+个）
// ─────────────────────────────────────────────
const SENSITIVE_KEYS = new Set([
  // 通用认证
  'apikey', 'api_key', 'api-key', 'apikeys',
  'password', 'passwd', 'pwd', 'pass',
  'token', 'access_token', 'refresh_token', 'id_token',
  'secret', 'secret_key', 'secretkey', 'secret_token',
  'authorization', 'auth', 'bearer', 'credentials',
  'private_key', 'privatekey', 'priv_key', 'private',
  'session', 'session_id', 'sessionid', 'session_token',

  // 云平台
  'aws_access_key_id', 'aws_secret_access_key', 'aws_session_token',
  'aws_access_key', 'aws_secret_key',
  'gcp_project', 'gcp_service_account', 'gcp_key',
  'azure_subscription', 'azure_tenant', 'azure_client_id', 'azure_client_secret',
  'digitalocean_token', 'do_token',

  // 开发平台
  'github_token', 'gitlab_token', 'bitbucket_token',
  'npm_token', 'pypi_token', 'rubygems_token',
  'docker_password', 'docker_token', 'dockerhub_token',

  // 支付
  'stripe_secret', 'stripe_key', 'stripe_sk', 'stripe_pk',
  'paypal_secret', 'paypal_client_id',
  'square_access_token', 'square_secret',

  // 通讯
  'twilio_auth_token', 'twilio_api_key', 'twilio_sid',
  'sendgrid_api_key', 'sendgrid_key',
  'mailgun_api_key', 'mailgun_key',
  'slack_token', 'slack_bot_token', 'slack_webhook',
  'discord_token', 'discord_bot_token', 'discord_webhook',
  'telegram_token', 'telegram_bot_token',
  'wechat_appid', 'wechat_secret',

  // 数据库
  'database_url', 'db_url', 'db_password', 'db_pass',
  'connection_string', 'conn_str', 'dsn',
  'redis_url', 'redis_password',
  'mongo_uri', 'mongodb_uri', 'mongodb_password',
  'mysql_password', 'postgres_password', 'postgresql_password',

  // AI/ML平台
  'openai_api_key', 'openai_key', 'openai_secret',
  'anthropic_api_key', 'anthropic_key',
  'cohere_api_key', 'huggingface_token', 'hf_token',
  'replicate_api_token', 'together_api_key',

  // 国内 AI 平台
  'deepseek_api_key', 'moonshot_api_key', 'zhipu_api_key',
  'baidu_api_key', 'qianfan_api_key', 'baichuan_api_key',
  'glm_api_key', 'yi_api_key',

  // 新兴平台
  'x_api_key', 'atlassian_api_token', 'linear_api_key',
  'perplexity_api_key', 'groq_api_key', 'together_api_key',
  'fireworks_api_key', 'mistral_api_key',

  // 监控/运维
  'datadog_api_key', 'datadog_app_key',
  'newrelic_key', 'new_relic_key',
  'sentry_dsn', 'sentry_key',
  'pagerduty_token', 'opsgenie_token',
  'grafana_token', 'grafana_api_key',

  // 其他服务
  'heroku_api_key', 'netlify_token', 'vercel_token',
  'cloudflare_api_key', 'cloudflare_token',
  'fastly_api_key', 'algolia_api_key',
  'twilio_account_sid', 'twilio_account_token',

  // 通用模式
  'client_secret', 'client_id', 'app_secret', 'app_key',
  'consumer_key', 'consumer_secret',
  'signing_key', 'encryption_key', 'master_key',
  'access_key', 'access_secret',
  'hook_url', 'webhook_url', 'webhook_secret',
  'callback_url', 'redirect_uri',
  'license_key', 'serial_key', 'product_key',
]);

// H2: PII 匹配结果接口（含置信度）
export interface PIIMatch {
  pattern: string;
  confidence: 'high' | 'medium' | 'low';
}

// 高置信度模式（具有明确前缀或结构的模式）
const HIGH_CONFIDENCE_PATTERNS = new Set([
  'aws-access-key', 'aws-sts-key', 'github-token', 'github-oauth', 'github-fine-grained',
  'gitlab-token', 'stripe-sk-live', 'stripe-pk-live', 'stripe-webhook', 'sendgrid-api-key',
  'slack-bot-token', 'slack-user-token', 'openai-key', 'anthropic-key', 'huggingface-token',
  'npm-token', 'pypi-token', 'ssh-rsa-priv', 'ssh-dsa-priv', 'ssh-ec-priv', 'ssh-openssh-priv',
  'pgp-priv-key', 'us-ssn', 'cn-idcard-18', 'cn-idcard-15', 'email', 'creditCard', 'creditcard',
  'visa', 'mastercard', 'amex', 'jwt', 'bearer-token', 'basic-auth', 'private-key-marker',
  'mysql-conn', 'postgres-conn', 'mongodb-conn', 'redis-conn', 'url-basic-auth',
]);

// 低置信度模式（容易误报的模式）
const LOW_CONFIDENCE_PATTERNS = new Set([
  'phone', 'phone-intl', 'ipv4', 'domain', 'datetime-iso', 'icd10',
  'cn-medical-insurance', 'cashapp-handle', 'google-auth-secret',
  'crypto-seed-12', 'seed-phrase-12', 'seed-phrase-24',
  'cf-global-key', 'algolia-key', 'jumpcloud-key', 'shopify-api-key',
]);

const MAX_REDACT_INPUT = 50_000; // 50KB — 平衡安全与性能
const MAX_REDACT_DEPTH = 10;
const REDACT_TIMEOUT_MS = 5000; // 5 seconds

export class Redactor {
  private patterns: RegExp[];
  private patternNames: string[];  // H2: 存储模式名称（与 patterns 数组一一对应）
  private replacement: string;

  constructor(config?: RedactConfig) {
    this.replacement = config?.replacement ?? '[REDACTED]';
    this.patterns = [];
    this.patternNames = [];

    // 加载内置模式（每次创建新 RegExp 实例，避免状态共享）
    const enabledPatterns = config?.patterns ?? Object.keys(BUILT_IN_PATTERNS);
    for (const name of enabledPatterns) {
      const def = BUILT_IN_PATTERNS[name];
      if (def) {
        this.patterns.push(new RegExp(def.source, def.flags));
        this.patternNames.push(name);
      }
    }

    // 加载自定义模式
    if (config?.custom) {
      for (const regex of config.custom) {
        this.patterns.push(new RegExp(regex.source, regex.flags));
        this.patternNames.push(`custom:${regex.source.substring(0, 20)}`);
      }
    }
  }

  /** 获取所有内置模式名称 */
  static getPatternNames(): string[] {
    return Object.keys(BUILT_IN_PATTERNS);
  }

  /** 获取内置模式数量 */
  static getPatternCount(): number {
    return Object.keys(BUILT_IN_PATTERNS).length;
  }

  /** 脱敏单个字符串 */
  redactString(text: string): string {
    if (typeof text !== 'string') return text;
    // 输入长度限制（防 ReDoS）
    let result = text.length > MAX_REDACT_INPUT ? text.slice(0, MAX_REDACT_INPUT) : text;
    const deadline = Date.now() + REDACT_TIMEOUT_MS;
    for (const pattern of this.patterns) {
      // 超时检查
      if (Date.now() > deadline) {
        console.error('[Redactor] Timeout: redactString exceeded 5s, aborting remaining patterns');
        break;
      }
      // 每次 replace 前重置 lastIndex，防止 g 标志状态残留
      pattern.lastIndex = 0;
      result = result.replace(pattern, this.replacement);
    }
    return result;
  }

  /** 深度脱敏对象（返回全新对象，不修改原始数据） */
  redactObject<T>(obj: T): T {
    return this._redactObjectImpl(obj, 0);
  }

  private _redactObjectImpl<T>(obj: T, depth: number): T {
    if (depth > MAX_REDACT_DEPTH) {
      return '[max depth exceeded]' as T;
    }
    if (obj === null || obj === undefined) {
      return obj;
    }
    if (typeof obj === 'string') {
      return this.redactString(obj) as T;
    }
    if (typeof obj === 'number' || typeof obj === 'boolean' || typeof obj === 'bigint' || typeof obj === 'symbol') {
      return obj;
    }
    if (Array.isArray(obj)) {
      return obj.map(item => this._redactObjectImpl(item, depth + 1)) as T;
    }
    if (typeof obj === 'object') {
      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
        // 跳过敏感字段名
        if (SENSITIVE_KEYS.has(key.toLowerCase())) {
          result[key] = this.replacement;
        } else {
          result[key] = this._redactObjectImpl(value, depth + 1);
        }
      }
      return result as T;
    }
    return obj;
  }

  /** 检查字符串中是否有PII */
  hasPII(text: string): boolean {
    if (typeof text !== 'string') return false;
    for (const pattern of this.patterns) {
      // 重置 lastIndex 防止 g 标志状态污染
      pattern.lastIndex = 0;
      if (pattern.test(text)) {
        return true;
      }
    }
    return false;
  }

  /** H2: 检查字符串中的PII并返回匹配模式及置信度 */
  hasPIIWithConfidence(text: string): PIIMatch[] {
    if (typeof text !== 'string') return [];
    const matches: PIIMatch[] = [];

    for (let i = 0; i < this.patterns.length; i++) {
      const pattern = this.patterns[i];
      const name = this.patternNames[i];
      pattern.lastIndex = 0;
      if (pattern.test(text)) {
        let confidence: 'high' | 'medium' | 'low';
        if (HIGH_CONFIDENCE_PATTERNS.has(name)) {
          confidence = 'high';
        } else if (LOW_CONFIDENCE_PATTERNS.has(name)) {
          confidence = 'low';
        } else {
          confidence = 'medium';
        }
        matches.push({ pattern: name, confidence });
      }
    }

    return matches;
  }
}
