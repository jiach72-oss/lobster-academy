"""Custom exceptions for Lobster Academy."""

from __future__ import annotations


class LobsterError(Exception):
    """Base exception for all Lobster Academy errors."""


class RecordingError(LobsterError):
    """Raised when event recording fails."""


class RedactionError(LobsterError):
    """Raised when sensitive data redaction fails."""


class EvaluationError(LobsterError):
    """Raised when agent evaluation fails."""


class SigningError(LobsterError):
    """Raised when cryptographic signing or verification fails."""


class StorageError(LobsterError):
    """Raised when a storage backend operation fails."""


class AdversarialError(LobsterError):
    """Raised when an adversarial attack execution fails."""
