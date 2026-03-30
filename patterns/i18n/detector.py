"""I18n Detector - Auto-detect country/locale from text patterns.

Infers likely country of origin for PII data based on format matching.
"""

from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any


@dataclass
class DetectionResult:
    """Result of a locale detection attempt."""
    country_code: str
    country_name: str
    pattern_name: str
    matched_text: str
    confidence: float  # 0.0 - 1.0


@dataclass
class LocaleReport:
    """Aggregated detection report for a text block."""
    text: str
    detected_locales: list[DetectionResult] = field(default_factory=list)
    primary_locale: str | None = None

    @property
    def has_detections(self) -> bool:
        return len(self.detected_locales) > 0

    def top_locales(self, n: int = 3) -> list[tuple[str, float]]:
        """Return top N locale codes with their aggregate confidence."""
        scores: dict[str, float] = {}
        for r in self.detected_locales:
            scores[r.country_code] = scores.get(r.country_code, 0.0) + r.confidence
        sorted_scores = sorted(scores.items(), key=lambda x: x[1], reverse=True)
        return sorted_scores[:n]


class I18nDetector:
    """Detects country/locale from PII patterns in text.

    Loads pattern definitions from patterns.json and uses them
    to identify which country's ID formats appear in the input.
    """

    # Patterns with higher specificity get a confidence boost
    HIGH_SPECIFICITY_PATTERNS = {
        "codice_fiscale", "curp", "nric", "pesel", "cpf", "cnpj",
        "cuit", "emirates_id", "rfc", "dni", "nie", "nif",
        "insee", "siret", "pan", "npwp", "ni_number", "cnh",
    }

    # Patterns too generic on their own (need context)
    LOW_CONFIDENCE_PATTERNS = {
        "phone", "id_number", "passport", "postcode",
    }

    def __init__(self, patterns_path: str | None = None):
        """Initialize detector with pattern definitions.

        Args:
            patterns_path: Path to patterns.json. If None, auto-locate.
        """
        if patterns_path is None:
            patterns_path = str(
                Path(__file__).parent / "patterns.json"
            )
        self._patterns_path = patterns_path
        self._patterns: dict[str, dict[str, Any]] = {}
        self._compiled: dict[str, list[tuple[str, str, str, re.Pattern, float]]] = {}
        self._load_patterns()

    def _load_patterns(self) -> None:
        """Load and compile all patterns from JSON."""
        with open(self._patterns_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        self._patterns = data.get("patterns", {})

        for country_code, country_data in self._patterns.items():
            items = country_data.get("items", {})
            compiled_list = []
            for pattern_name, pattern_def in items.items():
                regex_str = pattern_def.get("regex", "")
                if not regex_str:
                    continue
                try:
                    compiled = re.compile(regex_str)
                except re.error:
                    continue

                # Assign confidence based on specificity
                if pattern_name in self.HIGH_SPECIFICITY_PATTERNS:
                    confidence = 0.9
                elif pattern_name in self.LOW_CONFIDENCE_PATTERNS:
                    confidence = 0.3
                else:
                    confidence = 0.6

                label = pattern_def.get("label", pattern_name)
                compiled_list.append(
                    (country_code, pattern_name, label, compiled, confidence)
                )
            self._compiled[country_code] = compiled_list

    def detect(self, text: str) -> LocaleReport:
        """Detect all possible locale patterns in text.

        Args:
            text: Input text to scan.

        Returns:
            LocaleReport with all detected patterns.
        """
        report = LocaleReport(text=text)

        for country_code, compiled_list in self._compiled.items():
            country_name = self._patterns[country_code].get("name", country_code)
            for code, pname, label, regex, confidence in compiled_list:
                matches = regex.findall(text)
                if matches:
                    for match in matches:
                        matched_text = match if isinstance(match, str) else match[0] if match else ""
                        report.detected_locales.append(DetectionResult(
                            country_code=code,
                            country_name=country_name,
                            pattern_name=pname,
                            matched_text=matched_text,
                            confidence=confidence,
                        ))

        # Sort by confidence descending
        report.detected_locales.sort(key=lambda r: r.confidence, reverse=True)

        # Set primary locale
        top = report.top_locales(1)
        if top:
            report.primary_locale = top[0][0]

        return report

    def detect_locale(self, text: str) -> str | None:
        """Quick detection returning just the best-guess country code.

        Args:
            text: Input text.

        Returns:
            ISO 3166-1 alpha-2 country code or None.
        """
        report = self.detect(text)
        return report.primary_locale

    def get_supported_locales(self) -> list[dict[str, str]]:
        """Return list of supported locale metadata."""
        result = []
        for code, data in self._patterns.items():
            result.append({
                "code": code,
                "name": data.get("name", code),
                "flag": data.get("flag", ""),
                "pattern_count": len(data.get("items", {})),
            })
        return result

    def get_patterns_for_locale(self, locale: str) -> list[tuple[str, str, re.Pattern]]:
        """Get compiled patterns for a specific locale.

        Args:
            locale: ISO country code (e.g. 'US', 'JP').

        Returns:
            List of (pattern_name, label, compiled_regex).
        """
        locale_upper = locale.upper()
        if locale_upper not in self._compiled:
            return []
        return [
            (pname, label, regex)
            for _, pname, label, regex, _ in self._compiled[locale_upper]
        ]
