"""Tests for Signer module."""

import pytest
from lobster_academy.signer import Signer


class TestKeyGeneration:
    """Test key pair generation."""

    def test_generate_key_pair(self):
        private_key, public_key = Signer.generate_key_pair()
        assert isinstance(private_key, bytes)
        assert isinstance(public_key, bytes)
        assert len(private_key) == 32
        assert len(public_key) == 32

    def test_generate_unique_keys(self):
        pk1, pub1 = Signer.generate_key_pair()
        pk2, pub2 = Signer.generate_key_pair()
        assert pk1 != pk2
        assert pub1 != pub2


class TestSignAndVerify:
    """Test signing and verification."""

    def test_sign_and_verify(self):
        private_key, public_key = Signer.generate_key_pair()
        signer = Signer(private_key)
        data = b"hello world"
        signature = signer.sign(data)
        assert isinstance(signature, bytes)
        assert len(signature) == 64
        assert Signer.verify(data, signature, public_key) is True

    def test_verify_wrong_data(self):
        private_key, public_key = Signer.generate_key_pair()
        signer = Signer(private_key)
        signature = signer.sign(b"hello world")
        assert Signer.verify(b"tampered data", signature, public_key) is False

    def test_verify_wrong_key(self):
        pk1, _ = Signer.generate_key_pair()
        _, pub2 = Signer.generate_key_pair()
        signer = Signer(pk1)
        signature = signer.sign(b"hello")
        assert Signer.verify(b"hello", signature, pub2) is False

    def test_verify_corrupted_signature(self):
        private_key, public_key = Signer.generate_key_pair()
        signer = Signer(private_key)
        signature = signer.sign(b"data")
        corrupted = bytearray(signature)
        corrupted[0] ^= 0xFF
        assert Signer.verify(b"data", bytes(corrupted), public_key) is False

    def test_invalid_key_length(self):
        with pytest.raises(ValueError, match="32 bytes"):
            Signer(b"too_short")
