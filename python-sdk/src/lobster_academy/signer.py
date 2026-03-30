"""Signer - Ed25519 cryptographic signing for agent events.

Provides key generation, signing, and verification using Ed25519.
"""

from __future__ import annotations

import logging

from cryptography.hazmat.primitives.asymmetric.ed25519 import (
    Ed25519PrivateKey,
    Ed25519PublicKey,
)
from cryptography.hazmat.primitives.serialization import (
    Encoding,
    NoEncryption,
    PrivateFormat,
    PublicFormat,
)

from .exceptions import SigningError

logger = logging.getLogger(__name__)

# Ed25519 key and signature sizes in bytes
_ED25519_PRIVATE_KEY_SIZE = 32
_ED25519_PUBLIC_KEY_SIZE = 32
_ED25519_SIGNATURE_SIZE = 64


class Signer:
    """Ed25519 signing and verification for agent event integrity.

    Args:
        secret_key: Ed25519 private key in raw bytes (32 bytes).

    Raises:
        ValueError: If secret_key is not exactly 32 bytes.

    Example:
        >>> private_key, public_key = Signer.generate_key_pair()
        >>> signer = Signer(private_key)
        >>> signature = signer.sign(b"hello world")
        >>> Signer.verify(b"hello world", signature, public_key)
        True
    """

    def __init__(self, secret_key: bytes) -> None:
        """Initialize signer with a raw Ed25519 private key.

        Args:
            secret_key: 32-byte Ed25519 private key.

        Raises:
            ValueError: If secret_key is not exactly 32 bytes.
        """
        if not isinstance(secret_key, bytes):
            raise SigningError(f"secret_key must be bytes, got {type(secret_key).__name__}")
        if len(secret_key) != _ED25519_PRIVATE_KEY_SIZE:
            raise ValueError(
                f"Ed25519 private key must be exactly {_ED25519_PRIVATE_KEY_SIZE} bytes, "
                f"got {len(secret_key)}"
            )
        self._private_key = Ed25519PrivateKey.from_private_bytes(secret_key)
        logger.debug("Signer initialized with Ed25519 private key")

    @staticmethod
    def generate_key_pair() -> tuple[bytes, bytes]:
        """Generate a new Ed25519 key pair.

        Returns:
            Tuple of (private_key_bytes, public_key_bytes), each 32 bytes.
        """
        private_key = Ed25519PrivateKey.generate()
        public_key = private_key.public_key()

        private_bytes = private_key.private_bytes(
            encoding=Encoding.Raw,
            format=PrivateFormat.Raw,
            encryption_algorithm=NoEncryption(),
        )
        public_bytes = public_key.public_bytes(
            encoding=Encoding.Raw,
            format=PublicFormat.Raw,
        )
        logger.debug("Generated new Ed25519 key pair")
        return private_bytes, public_bytes

    def sign(self, data: bytes) -> bytes:
        """Sign data with the private key.

        Args:
            data: Bytes to sign.

        Returns:
            64-byte Ed25519 signature.

        Raises:
            TypeError: If data is not bytes.

        Example:
            >>> signer = Signer(private_key_bytes)
            >>> signature = signer.sign(b"important message")
            >>> len(signature)
            64
        """
        if not isinstance(data, bytes):
            raise SigningError(
                f"data must be bytes, got {type(data).__name__}. "
                "Encode strings with .encode('utf-8') before signing."
            )
        signature = self._private_key.sign(data)
        logger.debug("Signed %d bytes of data", len(data))
        return signature

    @staticmethod
    def verify(data: bytes, signature: bytes, public_key: bytes) -> bool:
        """Verify a signature against data using a public key.

        Args:
            data: Original data that was signed.
            signature: 64-byte Ed25519 signature.
            public_key: 32-byte Ed25519 public key.

        Returns:
            True if signature is valid, False otherwise.

        Example:
            >>> is_valid = Signer.verify(b"msg", signature_bytes, public_key_bytes)
            >>> if not is_valid:
            ...     print("Signature invalid or parameters malformed")
        """
        try:
            if not isinstance(data, bytes):
                logger.debug("Verification failed: data must be bytes, got %s", type(data).__name__)
                return False
            if not isinstance(signature, bytes):
                logger.debug(
                    "Verification failed: signature must be bytes, got %s",
                    type(signature).__name__,
                )
                return False
            if not isinstance(public_key, bytes):
                logger.debug(
                    "Verification failed: public_key must be bytes, got %s",
                    type(public_key).__name__,
                )
                return False
            if len(public_key) != _ED25519_PUBLIC_KEY_SIZE:
                logger.debug(
                    "Invalid public key size: %d (expected %d)",
                    len(public_key),
                    _ED25519_PUBLIC_KEY_SIZE,
                )
                return False
            if len(signature) != _ED25519_SIGNATURE_SIZE:
                logger.debug(
                    "Invalid signature size: %d (expected %d)",
                    len(signature),
                    _ED25519_SIGNATURE_SIZE,
                )
                return False
            pub_key = Ed25519PublicKey.from_public_bytes(public_key)
            pub_key.verify(signature, data)
            return True
        except Exception as e:
            logger.debug("Signature verification failed: %s", e)
            return False
