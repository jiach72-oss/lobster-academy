"""Lobster Academy - Open-Source AI Agent Security Evaluation Framework.

Provides standardized tools for evaluating AI agent security, reliability,
and compliance. Core modules:
- Recorder: Record agent events with Ed25519 signing
- Redactor: Redact 200+ types of sensitive data (PII, credentials, tokens)
- Academy: Evaluate agents across 5 dimensions with 25 metrics
- Adversarial: Test agents against 53 attack scenarios
- Signer: Cryptographic integrity verification
"""

from .recorder import Recorder
from .redactor import Redactor
from .academy import Academy
from .adversarial import AdversarialEngine
from .signer import Signer
from .types import RecordEvent, ToolCall, EvaluationResult, AttackResult

__version__ = "0.1.0"

__all__ = [
    "Recorder",
    "Redactor",
    "Academy",
    "AdversarialEngine",
    "Signer",
    "RecordEvent",
    "ToolCall",
    "EvaluationResult",
    "AttackResult",
]
