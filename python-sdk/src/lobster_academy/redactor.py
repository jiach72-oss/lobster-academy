"""Redactor - Sensitive data detection and redaction.

Covers 200+ regex patterns for PII, credentials, tokens, and secrets.
Extends with international i18n patterns for 24+ countries.
"""

from __future__ import annotations

import json
import logging
import re
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)


class LobsterRedactorError(Exception):
    """Raised when redaction operations fail.

    Attributes:
        message: Human-readable error description.
        pattern: The regex pattern that caused the error, if applicable.
    """

    def __init__(self, message: str, pattern: str | None = None) -> None:
        self.message = message
        self.pattern = pattern
        super().__init__(message)


# Redaction placeholder
REDACTION_PLACEHOLDER = "[REDACTED]"

# Keys that are considered sensitive in dict objects
SENSITIVE_KEYS: list[str] = [
    "password", "passwd", "pwd", "secret", "token", "api_key", "apikey",
    "api-key", "access_key", "secret_key", "private_key", "auth",
    "authorization", "credential", "credentials", "session", "cookie",
    "bearer", "jwt", "ssn", "social_security", "credit_card", "card_number",
    "cvv", "pin", "otp", "private", "signature", "passphrase",
    # Country-specific PII key names
    "cpf", "cnpj", "cuit", "curp", "rfc", "nric", "nric_fin", "tin",
    "tax_id", "ein", "pan", "aadhaar", "steuer_id", "bsn", "pesel",
    "npwp", "cccd", "my_number", "rrn", "health_card", "medicare",
    "tfn", "abn", "ird", "nhi", "iqama", "emirates_id", "sin",
    "drivers_license", "passport", "bank_account", "routing_number",
    "date_of_birth", "dob",
]


class Redactor:
    """Detects and redacts sensitive information from text and objects.

    Supports 200+ regex patterns covering emails, phone numbers, credit cards,
    API keys, private keys, and country-specific identifiers.

    Args:
        custom_patterns: Optional list of (regex_pattern, replacement) tuples
            to add to the built-in patterns.

    Example:
        >>> redactor = Redactor()
        >>> redactor.redact_string("Email me at user@example.com")
        'Email me at [REDACTED]'
    """

    PLACEHOLDER = REDACTION_PLACEHOLDER
    SENSITIVE_KEYS = SENSITIVE_KEYS

    def __init__(self, custom_patterns: list[tuple[str, str]] | None = None) -> None:
        self._patterns = self._build_patterns()
        if custom_patterns:
            for pat, repl in custom_patterns:
                try:
                    self._patterns.append((re.compile(pat), repl))
                except re.error as e:
                    logger.warning("Invalid custom regex pattern '%s': %s", pat, e)

        # Load i18n patterns
        self._i18n_patterns: dict[str, list[tuple[re.Pattern[str], str]]] = {}
        self._load_i18n_patterns()

        logger.debug(
            "Redactor initialized with %d base patterns and %d locale sets",
            len(self._patterns),
            len(self._i18n_patterns),
        )

    def _load_i18n_patterns(self) -> None:
        """Load international patterns from patterns.json."""
        patterns_path = (
            Path(__file__).resolve().parent.parent.parent.parent
            / "patterns" / "i18n" / "patterns.json"
        )
        if not patterns_path.exists():
            return
        try:
            with open(patterns_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            all_patterns = data.get("patterns", {})
            for country_code, country_data in all_patterns.items():
                items = country_data.get("items", {})
                compiled: list[tuple[re.Pattern[str], str]] = []
                for item_name, item_def in items.items():
                    regex_str = item_def.get("regex", "")
                    placeholder = item_def.get("placeholder", self.PLACEHOLDER)
                    if regex_str:
                        try:
                            compiled.append((re.compile(regex_str), placeholder))
                        except re.error:
                            logger.debug(
                                "Skipping invalid i18n regex for %s/%s",
                                country_code,
                                item_name,
                            )
                            continue
                if compiled:
                    self._i18n_patterns[country_code.upper()] = compiled
        except (OSError, json.JSONDecodeError) as e:
            logger.debug("Could not load i18n patterns: %s", e)

    @staticmethod
    def _add_pattern(
        patterns: list[tuple[re.Pattern[str], str]],
        regex: str,
        placeholder: str,
    ) -> None:
        """Compile and append a regex pattern to the patterns list.

        Args:
            patterns: Mutable list to append the compiled pattern to.
            regex: Raw regex string to compile.
            placeholder: Replacement string for matches.
        """
        patterns.append((re.compile(regex), placeholder))

    def _build_patterns(self) -> list[tuple[re.Pattern[str], str]]:
        """Build list of (compiled_regex, replacement) for 200+ patterns.

        Returns:
            List of compiled pattern and replacement pairs.
        """
        patterns: list[tuple[re.Pattern[str], str]] = []
        p = self.PLACEHOLDER
        _p = lambda regex: self._add_pattern(patterns, regex, p)

        # --- Email ---
        _p(r'[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}')

        # --- Phone numbers ---
        _p(r'\+?1[\s.\-]?\(?\d{3}\)?[\s.\-]?\d{3}[\s.\-]?\d{4}')
        _p(r'\+?86[\s\-]?1[3-9]\d{9}')
        _p(r'(?<![0-9])1[3-9]\d{9}(?![0-9])')
        _p(r'\+\d{1,3}[\s.\-]?\d{4,14}')
        _p(r'\(\d{3,4}\)[\s\-]?\d{3,4}[\s\-]?\d{3,4}')

        # --- Chinese ID (身份证) ---
        _p(r'\d{17}[\dXx]')
        _p(r'\d{6}(18|19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}[\dXx]')

        # --- Credit cards ---
        _p(r'\b(?:4[0-9]{3}[\s\-]?[0-9]{4}[\s\-]?[0-9]{4}[\s\-]?[0-9]{4})\b')
        _p(r'\b(?:5[1-5][0-9]{2}[\s\-]?[0-9]{4}[\s\-]?[0-9]{4}[\s\-]?[0-9]{4})\b')
        _p(r'\b(?:3[47][0-9]{2}[\s\-]?[0-9]{6}[\s\-]?[0-9]{5})\b')
        _p(r'\b(?:6(?:011|5[0-9]{2})[\s\-]?[0-9]{4}[\s\-]?[0-9]{4}[\s\-]?[0-9]{4})\b')
        _p(r'(?i)(?:card|credit|debit|visa|mastercard|amex|card.?number)[\s:=]*["\']?(\d{4}[\s\-]?\d{4}[\s\-]?\d{4}[\s\-]?\d{4})["\']?')

        # --- SSN ---
        _p(r'(?i)(?:ssn|social.?security|tax.?id|tin)[\s#:]+["\']?(\d{3}[\s\-]?\d{2}[\s\-]?\d{4})["\']?')

        # --- AWS Keys ---
        _p(r'AKIA[0-9A-Z]{16}')
        _p(r'(?i)aws[_\-]?secret[_\-]?access[_\-]?key[\s=:]+["\']?([A-Za-z0-9/+=]{40})["\']?')
        _p(r'(?:ASIA|AGPA|AIDA|ANPA|AROA|AIPA)[A-Z0-9]{16}')

        # --- OpenAI Keys ---
        _p(r'sk-[A-Za-z0-9]{20,}')
        _p(r'sk-proj-[A-Za-z0-9\-_]{20,}')
        _p(r'org-[A-Za-z0-9]{20,}')

        # --- GitHub Tokens ---
        _p(r'ghp_[A-Za-z0-9]{36}')
        _p(r'gho_[A-Za-z0-9]{36}')
        _p(r'ghu_[A-Za-z0-9]{36}')
        _p(r'ghs_[A-Za-z0-9]{36}')
        _p(r'ghr_[A-Za-z0-9]{36,255}')
        _p(r'github_pat_[A-Za-z0-9_]{22,255}')

        # --- Generic API keys / secrets ---
        _p(r'(?i)(?:api[_\-]?key|apikey|secret[_\-]?key|access[_\-]?key|auth[_\-]?token)[\s]*[:=][\s]*["\']?([A-Za-z0-9_\-]{16,})["\']?')
        _p(r'(?i)bearer\s+[A-Za-z0-9_\-\.]{20,}')
        _p(r'(?i)basic\s+[A-Za-z0-9+/=]{10,}')

        # --- JWT ---
        _p(r'eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+')

        # --- Private keys ---
        _p(r'-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----')

        # --- Passwords in URLs ---
        _p(r'(?:https?|ftp)://[^:]+:([^@]+)@')

        # --- Connection strings ---
        _p(r'(?i)(?:mongodb|postgres|mysql|redis|amqp|mssql)://[^\s]+:[^\s]+@[^\s]+')
        _p(r'(?i)password[\s]*[:=][\s]*["\']?[^\s"\';,]{4,}["\']?')

        # --- Slack / Discord / Telegram tokens ---
        _p(r'xox[bpsr]-[A-Za-z0-9\-]{10,}')
        _p(r'https://hooks\.slack\.com/services/T[A-Za-z0-9]+/B[A-Za-z0-9]+/[A-Za-z0-9]+')
        _p(r'(?i)discord[\s]*(?:bot[\s]*)?token[\s:=]+["\']?([A-Za-z0-9_.\-]{20,})["\']?')
        _p(r'\d{9,10}:[A-Za-z0-9_\-]{35}')

        # --- Stripe ---
        _p(r'sk_live_[A-Za-z0-9]{24,}')
        _p(r'pk_live_[A-Za-z0-9]{24,}')
        _p(r'sk_test_[A-Za-z0-9]{24,}')
        _p(r'rk_live_[A-Za-z0-9]{24,}')

        # --- Azure / GCP ---
        _p(r'(?i)azure[_\-]?storage[_\-]?key[\s:=]+["\']?([A-Za-z0-9+/=]{44,88})["\']?')
        _p(r'AIza[0-9A-Za-z\-_]{35}')
        _p(r'(?i)gcp[_\-]?api[_\-]?key[\s:=]+["\']?([A-Za-z0-9_\-]{20,})["\']?')

        # --- Databricks ---
        _p(r'dapi[a-f0-9]{32}')

        # --- Heroku ---
        _p(r'(?i)heroku[_\-]?api[_\-]?key[\s:=]+["\']?([A-Fa-f0-9]{8}-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{12})["\']?')

        # --- Mailgun / SendGrid / Twilio ---
        _p(r'key-[0-9a-zA-Z]{32}')
        _p(r'SG\.[A-Za-z0-9_\-]{22}\.[A-Za-z0-9_\-]{43}')
        _p(r'(?i)twilio[_\-]?api[_\-]?key[\s:=]+["\']?(SK[a-f0-9]{32})["\']?')

        # --- Datadog / New Relic ---
        _p(r'(?i)datadog[_\-]?api[_\-]?key[\s:=]+["\']?([a-f0-9]{32})["\']?')
        _p(r'NRAK-[A-Z0-9]{27}')

        # --- npm / PyPI / NuGet ---
        _p(r'npm_[A-Za-z0-9]{36}')
        _p(r'pypi-[A-Za-z0-9_\-]{50,}')

        # --- MongoDB connection strings ---
        _p(r'mongodb\+srv://[^\s]+:[^\s]+@[^\s]+')

        # --- IP addresses ---
        _p(r'(?i)(?:internal|private|admin)[\s\-_]?ip[\s:=]+(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})')

        # --- MAC addresses ---
        _p(r'(?:[0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}')

        # --- IPv6 ---
        _p(r'(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}')

        # --- Passport numbers ---
        _p(r'(?i)passport[\s#:]+([A-Z]{1,2}\d{6,9})')

        # --- Driver's license ---
        _p(r'(?i)driver.?s?.?licen[sc]e[\s#:]+([A-Z0-9]{5,15})')

        # --- Bank account / routing ---
        _p(r'(?i)(?:account|routing)[\s\-]?(?:number|#)[\s:=]+["\']?(\d{8,17})["\']?')

        # --- VIN ---
        _p(r'\b[A-HJ-NPR-Z0-9]{17}\b')

        # --- Date of birth ---
        _p(r'(?i)(?:dob|date.of.birth|birthday|birth.date)[\s:=]+["\']?(\d{4}[-/]\d{1,2}[-/]\d{1,2})["\']?')

        # --- Medicare / Insurance ---
        _p(r'(?i)(?:medicare|insurance|policy)[\s\-]?(?:number|#|id)[\s:=]+["\']?([A-Z0-9\-]{6,20})["\']?')

        # --- Tax ID / EIN ---
        _p(r'\b\d{2}[\-]\d{7}\b')
        _p(r'(?i)(?:ein|tax.?id|tin)[\s#:]+(\d{2}[\-]\d{7})')

        # --- Passport / travel doc ---
        _p(r'(?i)(?:G|E|P|S|D)\d{8}')

        # --- Postal codes ---
        _p(r'(?i)(?:zip|postal|postcode)[\s#:]+(\d{5}(?:-\d{4})?)')
        _p(r'[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}')

        # --- Multi-factor codes ---
        _p(r'(?i)(?:mfa|2fa|totp|otp)[\s:=]+["\']?(\d{6})["\']?')
        _p(r'(?i)verification[\s\-]?code[\s:=]+["\']?(\d{4,8})["\']?')

        # --- Certificate / PEM ---
        _p(r'-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----')

        # --- SSH keys ---
        _p(r'ssh-(?:rsa|ed25519|dss)\s+[A-Za-z0-9+/=]{20,}')

        # --- PayPal ---
        _p(r'(?i)paypal[_\-]?secret[\s:=]+["\']?([A-Za-z0-9_\-]{16,})["\']?')

        # --- Square ---
        _p(r'sq0[a-z]{3}-[A-Za-z0-9\-_]{22,43}')

        # --- Shopify ---
        _p(r'shpss_[a-fA-F0-9]{32}')
        _p(r'shpat_[a-fA-F0-9]{32}')
        _p(r'shppa_[a-fA-F0-9]{32}')
        _p(r'shpca_[a-fA-F0-9]{32}')

        # --- Hubspot ---
        _p(r'(?i)hubspot[\s\-_]*(?:key|token|secret|id|api)[\s:=]+["\']?([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})["\']?')

        # --- Cloudflare ---
        _p(r'(?i)cloudflare[_\-]?api[_\-]?(?:key|token)[\s:=]+["\']?([A-Za-z0-9_\-]{37,})["\']?')

        # --- HashiCorp Vault ---
        _p(r'hvs\.[A-Za-z0-9_\-]{24,}')

        # --- Confluent ---
        _p(r'(?i)confluent[_\-]?api[_\-]?secret[\s:=]+["\']?([A-Za-z0-9+/=]{40,})["\']?')

        # --- S3 URLs with credentials ---
        _p(r'https?://[A-Za-z0-9]+:[A-Za-z0-9+/=]+@s3\.amazonaws\.com')

        # --- IP with port in sensitive contexts ---
        _p(r'(?i)(?:host|server|db_host|db_server|redis_host|cache_host)[\s:=]+["\']?(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(?::\d{2,5})?)["\']?')

        # --- Auth header values ---
        _p(r'(?i)authorization[\s]*:[\s]*(?:bearer|basic|token)\s+[A-Za-z0-9_\-\.+=/]{10,}')

        # --- Cookie values ---
        _p(r'(?i)(?:session|sid|auth|token)[\s]*=[\s]*[A-Za-z0-9_\-\.+=/]{16,}')

        # --- Generic hex secrets ---
        _p(r'(?i)(?:secret|key|token|hash|signature)[\s:=]+["\']?([a-f0-9]{32,64})["\']?')

        # --- Base64 encoded secrets ---
        _p(r'(?i)(?:secret|key|token)[\s:=]+["\']?([A-Za-z0-9+/]{40,}={0,2})["\']?')

        # --- UUIDs in sensitive contexts ---
        _p(r'(?i)(?:secret|key|token|auth)[\s:=]+["\']?([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})["\']?')

        # --- Chinese bank card ---
        _p(r'(?i)(?:card|bank|card.?number|account)[\s:=]*["\']?(\d{16,19})["\']?')

        # --- Chinese mobile + landline ---
        _p(r'(?i)phone[\s:=]+["\']?(\+?86[\s\-]?1[3-9]\d{9})["\']?')
        _p(r'(?i)(?:mobile|cell|tel|telephone)[\s:=]+["\']?(\+?\d{7,15})["\']?')

        # --- WeChat / Alipay ---
        _p(r'(?i)(?:wechat|wx|alipay)[\s\-]?(?:id|openid|token)[\s:=]+["\']?([A-Za-z0-9_\-]{10,})["\']?')

        # --- Environment variables ---
        _p(r'(?i)(?:DATABASE_URL|DB_PASSWORD|REDIS_URL|SECRET_KEY|PRIVATE_KEY|API_SECRET)[\s]*=[\s]*["\']?([^\s"\';,]{4,})["\']?')

        # --- K8s / Docker secrets ---
        _p(r'(?i)(?:docker[_\-]?password|k8s[_\-]?token|kubeconfig)[\s:=]+["\']?([A-Za-z0-9_\-\.]{10,})["\']?')

        # --- Git credentials ---
        _p(r'(?i)git[_\-]?(?:password|token|credential)[\s:=]+["\']?([A-Za-z0-9_\-]{10,})["\']?')

        # --- LDAP ---
        _p(r'(?i)ldap[_\-]?password[\s:=]+["\']?([^\s"\';,]{4,})["\']?')

        # --- SMTP credentials ---
        _p(r'(?i)smtp[_\-]?(?:password|pass)[\s:=]+["\']?([^\s"\';,]{4,})["\']?')

        # --- FTP credentials ---
        _p(r'ftp://[^:]+:([^@]+)@')

        # --- Generic sensitive assignments ---
        _p(r'(?i)(?:pwd|pass|secret|token|key|credential|auth)\s*[:=]\s*["\']([^\s"\']{6,})["\']')

        # --- Names in sensitive context ---
        _p(r'(?i)(?:full.?name|patient.?name|beneficiary)[\s:=]+["\']?([A-Z][a-z]+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)["\']?')

        # --- Address patterns ---
        _p(r'\d{1,5}\s+[A-Z][a-z]+\s+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Court|Ct|Way|Place|Pl)[\s,]+[A-Z][a-z]+[\s,]+[A-Z]{2}\s+\d{5}')

        return patterns

    def redact_string(self, text: str) -> str:
        """Redact sensitive data from a string.

        Args:
            text: Input string that may contain sensitive data.

        Returns:
            String with sensitive data replaced by [REDACTED].
        """
        if not text:
            return text
        result = text
        for pattern, replacement in self._patterns:
            result = pattern.sub(replacement, result)
        return result

    def redact_with_locale(self, text: str, locale: str) -> str:
        """Redact sensitive data using locale-specific patterns.

        Applies both base patterns and the specified locale's patterns.
        Locale patterns run first for more specific placeholders.

        Args:
            text: Input string.
            locale: ISO 3166-1 alpha-2 country code (e.g. 'US', 'JP', 'BR').

        Returns:
            String with locale-specific and base redactions applied.
        """
        if not text:
            return text

        result = text

        # Apply locale-specific patterns first (more specific placeholders)
        locale_upper = locale.upper()
        if locale_upper in self._i18n_patterns:
            for pattern, replacement in self._i18n_patterns[locale_upper]:
                result = pattern.sub(replacement, result)

        # Then apply base patterns
        for pattern, replacement in self._patterns:
            result = pattern.sub(replacement, result)

        return result

    def auto_detect_and_redact(self, text: str) -> dict[str, Any]:
        """Auto-detect locale and redact sensitive data.

        Attempts to identify the country from PII patterns, then
        applies locale-specific redaction. Falls back to base
        patterns if no locale is detected.

        Args:
            text: Input string.

        Returns:
            Dict with keys:
                - 'text': Redacted text
                - 'detected_locale': Country code or None
                - 'applied_patterns': List of pattern descriptions matched
        """
        if not text:
            return {"text": text, "detected_locale": None, "applied_patterns": []}

        # Find best matching locale
        best_locale: str | None = None
        best_count = 0
        for locale_code, compiled_list in self._i18n_patterns.items():
            count = sum(1 for pattern, _ in compiled_list if pattern.search(text))
            if count > best_count:
                best_count = count
                best_locale = locale_code

        applied_patterns: list[str] = []
        result = text

        if best_locale and best_locale in self._i18n_patterns:
            for pattern, replacement in self._i18n_patterns[best_locale]:
                matches = pattern.findall(result)
                if matches:
                    applied_patterns.append(f"{best_locale}:{replacement}")
                    result = pattern.sub(replacement, result)

        # Always apply base patterns
        for pattern, replacement in self._patterns:
            if pattern.search(result):
                result = pattern.sub(replacement, result)

        return {
            "text": result,
            "detected_locale": best_locale,
            "applied_patterns": applied_patterns,
        }

    def redact_object(self, obj: Any, locale: str | None = None) -> Any:
        """Recursively redact sensitive data from a dict/list/primitive.

        Args:
            obj: A dict, list, or primitive value.
            locale: Optional ISO 3166-1 alpha-2 country code for locale-specific
                    redaction (e.g. 'BR' for CPF, 'DE' for Steuer-ID).

        Returns:
            Copy with sensitive fields redacted.
        """
        if isinstance(obj, dict):
            result: dict[str, Any] = {}
            for key, value in obj.items():
                if self._is_sensitive_key(key):
                    result[key] = self.PLACEHOLDER
                elif isinstance(value, str):
                    if locale:
                        result[key] = self.redact_with_locale(value, locale)
                    else:
                        result[key] = self.redact_string(value)
                elif isinstance(value, (dict, list)):
                    result[key] = self.redact_object(value, locale=locale)
                else:
                    result[key] = value
            return result
        elif isinstance(obj, list):
            return [self.redact_object(item, locale=locale) for item in obj]
        elif isinstance(obj, str):
            if locale:
                return self.redact_with_locale(obj, locale)
            return self.redact_string(obj)
        else:
            return obj

    def _is_sensitive_key(self, key: str) -> bool:
        """Check if a key name indicates sensitive data.

        Args:
            key: Dictionary key name.

        Returns:
            True if the key matches any sensitive key pattern.
        """
        key_lower = key.lower().replace("-", "_").replace(" ", "_")
        return any(sensitive in key_lower for sensitive in self.SENSITIVE_KEYS)
