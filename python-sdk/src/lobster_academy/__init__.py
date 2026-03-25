"""Lobster Academy - AI Agent Behavior Evidence Platform.

Provides 5 core modules:
- Recorder: Record agent events
- Redactor: Redact sensitive data
- Academy: Evaluate agent behavior
- Adversarial: Run adversarial attack scenarios
- Signer: Cryptographic signing with Ed25519
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
