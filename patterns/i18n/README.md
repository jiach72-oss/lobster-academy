# I18n Redaction Patterns

International sensitive data detection patterns for the MirrorAI Redactor module.

## Overview

This module extends the base redactor with locale-aware PII detection covering **24 countries/regions** and **70+ pattern types** across Asia, Europe, the Americas, Africa/Middle East, and Oceania.

## Architecture

```
patterns/i18n/
├── README.md          # This file
├── patterns.json      # All country regex pattern definitions
├── detector.py        # Auto-detection of country/locale from data
└── test_i18n.py       # Comprehensive tests per country
```

## Supported Countries

### 🌏 Asia
| Flag | Country | ID Types |
|------|---------|----------|
| 🇯🇵 | Japan | My Number, Phone, Postal Code, Residence Card |
| 🇰🇷 | South Korea | Resident Registration Number, Phone, Passport |
| 🇮🇳 | India | Aadhaar, PAN, Phone, Voter ID, Passport |
| 🇹🇭 | Thailand | National ID, Phone, Tax ID |
| 🇸🇬 | Singapore | NRIC/FIN, Phone |
| 🇮🇩 | Indonesia | NIK, Phone, NPWP |
| 🇻🇳 | Vietnam | Citizen ID (CCCD), Phone, Old ID (CMND) |

### 🌍 Europe
| Flag | Country | ID Types |
|------|---------|----------|
| 🇬🇧 | United Kingdom | NHS Number, NI Number, Postcode, UTR |
| 🇩🇪 | Germany | ID Card, Tax ID, Social Security, Phone, VAT |
| 🇫🇷 | France | INSEE/NIR, SIRET, SIREN, Phone |
| 🇮🇹 | Italy | Codice Fiscale, Partita IVA, Phone |
| 🇪🇸 | Spain | DNI, NIE, NIF, Phone, SSN |
| 🇳🇱 | Netherlands | BSN, RSIN, Phone |
| 🇵🇱 | Poland | PESEL, NIP, Phone |

### 🌎 Americas
| Flag | Country | ID Types |
|------|---------|----------|
| 🇺🇸 | United States | SSN, ITIN, EIN, Phone, Driver License |
| 🇨🇦 | Canada | SIN, Health Card, Phone |
| 🇧🇷 | Brazil | CPF, CNPJ, Phone, RG |
| 🇲🇽 | Mexico | CURP, RFC, Phone, CLABE |
| 🇦🇷 | Argentina | DNI, CUIT, Phone |

### 🌍 Africa / Middle East
| Flag | Country | ID Types |
|------|---------|----------|
| 🇿🇦 | South Africa | ID Number, Phone, Passport |
| 🇦🇪 | United Arab Emirates | Emirates ID, Phone, Trade License |
| 🇸🇦 | Saudi Arabia | Iqama/National ID, Phone, CR Number |

### 🌊 Oceania
| Flag | Country | ID Types |
|------|---------|----------|
| 🇦🇺 | Australia | TFN, Medicare, ABN, Phone |
| 🇳🇿 | New Zealand | IRD, NHI, Phone |

## Usage

### From Python SDK

```python
from lobster_academy.redactor import Redactor

r = Redactor()

# Redact for a specific locale
result = r.redact_with_locale("CPF: 123.456.789-09", locale="BR")
# → "CPF: [REDACTED_BR_CPF]"

# Auto-detect and redact
result = r.auto_detect_and_redact("Codice Fiscale: RSSMRA85M01H501Z")
# → "Codice Fiscale: [REDACTED_IT_CF]"
```

### From Detector Directly

```python
from lobster_academy.redactor import I18nDetector

detector = I18nDetector()

# Detect locale from text
report = detector.detect("SSN: 123-45-6789")
print(report.primary_locale)  # "US"

# Get patterns for a country
patterns = detector.get_patterns_for_locale("JP")
```

## Pattern JSON Format

Each country entry in `patterns.json` follows this structure:

```json
{
  "XX": {
    "name": "Country Name",
    "flag": "🏳️",
    "items": {
      "id_type": {
        "label": "Human-readable name",
        "regex": "\\b\\d{3}[\\s-]?\\d{2}[\\s-]?\\d{4}\\b",
        "placeholder": "[REDACTED_XX_TYPE]"
      }
    }
  }
}
```

## Confidence Scoring

The detector assigns confidence levels during auto-detection:

| Confidence | Pattern Type |
|------------|-------------|
| 0.9 | Highly specific (Codice Fiscale, CURP, NRIC, CPF, etc.) |
| 0.6 | Standard (SIN, EIN, TFN, etc.) |
| 0.3 | Generic (phone, passport, ID number) |

## Adding New Countries

1. Add entry to `patterns.json` with country code, name, flag, and items
2. Each item needs: `label`, `regex`, `placeholder`
3. Run `test_i18n.py` to verify patterns
4. Update this README

## Design Notes

- All placeholders are locale-tagged: `[REDACTED_XX_TYPE]` for auditability
- Regex patterns handle common separators (spaces, dashes, dots)
- Patterns use word boundaries (`\b`) where appropriate to avoid false positives
- The detector scores by specificity — unique formats like Italian CF get higher confidence than generic "ID numbers"
