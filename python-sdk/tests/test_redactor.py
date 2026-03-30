"""Tests for Redactor module."""

import pytest
from lobster_academy.redactor import Redactor


@pytest.fixture
def redactor():
    return Redactor()


class TestRedactString:
    """Test redact_string method."""

    def test_email(self, redactor):
        text = "Contact user@example.com for details"
        result = redactor.redact_string(text)
        assert "user@example.com" not in result
        assert "[REDACTED]" in result

    def test_us_phone(self, redactor):
        text = "Call me at +1-555-123-4567"
        result = redactor.redact_string(text)
        assert "555-123-4567" not in result
        assert "[REDACTED]" in result

    def test_china_phone(self, redactor):
        text = "My number is 13812345678"
        result = redactor.redact_string(text)
        assert "13812345678" not in result
        assert "[REDACTED]" in result

    def test_china_id(self, redactor):
        text = "ID: 110101199003077758"
        result = redactor.redact_string(text)
        assert "110101199003077758" not in result
        assert "[REDACTED]" in result

    def test_credit_card(self, redactor):
        text = "Card: 4111-1111-1111-1111"
        result = redactor.redact_string(text)
        assert "4111-1111-1111-1111" not in result
        assert "[REDACTED]" in result

    def test_ssn(self, redactor):
        text = "SSN: 123-45-6789"
        result = redactor.redact_string(text)
        assert "123-45-6789" not in result
        assert "[REDACTED]" in result

    def test_aws_key(self, redactor):
        text = "Key: AKIAIOSFODNN7EXAMPLE"
        result = redactor.redact_string(text)
        assert "AKIAIOSFODNN7EXAMPLE" not in result
        assert "[REDACTED]" in result

    def test_openai_key(self, redactor):
        text = "API: sk-abc123def456ghi789jkl012mno345pqr678"
        result = redactor.redact_string(text)
        assert "sk-abc123def456ghi789jkl012mno345pqr678" not in result
        assert "[REDACTED]" in result

    def test_github_token(self, redactor):
        text = "Token: ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef123456"
        result = redactor.redact_string(text)
        assert "ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef123456" not in result
        assert "[REDACTED]" in result

    def test_jwt(self, redactor):
        text = "Token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abc123"
        result = redactor.redact_string(text)
        assert "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9" not in result
        assert "[REDACTED]" in result

    def test_private_key(self, redactor):
        text = "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASC\n-----END PRIVATE KEY-----"
        result = redactor.redact_string(text)
        assert "BEGIN PRIVATE KEY" not in result
        assert "[REDACTED]" in result

    def test_empty_string(self, redactor):
        assert redactor.redact_string("") == ""
        assert redactor.redact_string(None) is None

    def test_no_sensitive_data(self, redactor):
        text = "Hello world, this is a normal message."
        assert redactor.redact_string(text) == text

    def test_multiple_sensitive_values(self, redactor):
        text = "Email: a@b.com Phone: 13812345678 Key: AKIAIOSFODNN7EXAMPLE"
        result = redactor.redact_string(text)
        assert "a@b.com" not in result
        assert "13812345678" not in result
        assert "AKIAIOSFODNN7EXAMPLE" not in result
        assert result.count("[REDACTED]") == 3


class TestRedactObject:
    """Test redact_object method."""

    def test_dict_with_password(self, redactor):
        obj = {"username": "admin", "password": "secret123", "host": "localhost"}
        result = redactor.redact_object(obj)
        assert result["username"] == "admin"
        assert result["password"] == "[REDACTED]"
        assert result["host"] == "localhost"

    def test_dict_with_api_key(self, redactor):
        obj = {"api_key": "sk-abc123def456", "data": "normal"}
        result = redactor.redact_object(obj)
        assert result["api_key"] == "[REDACTED]"
        assert result["data"] == "normal"

    def test_nested_dict(self, redactor):
        obj = {"user": {"name": "test", "secret": "hidden"}, "config": {"port": 8080}}
        result = redactor.redact_object(obj)
        assert result["user"]["name"] == "test"
        assert result["user"]["secret"] == "[REDACTED]"
        assert result["config"]["port"] == 8080

    def test_list_of_dicts(self, redactor):
        obj = [{"token": "abc123"}, {"name": "safe"}]
        result = redactor.redact_object(obj)
        assert result[0]["token"] == "[REDACTED]"
        assert result[1]["name"] == "safe"

    def test_string_value(self, redactor):
        result = redactor.redact_object("Contact user@test.com please")
        assert "user@test.com" not in result
        assert "[REDACTED]" in result

    def test_primitive_passthrough(self, redactor):
        assert redactor.redact_object(42) == 42
        assert redactor.redact_object(3.14) == 3.14
        assert redactor.redact_object(True) is True
        assert redactor.redact_object(None) is None

    def test_sensitive_key_variants(self, redactor):
        obj = {
            "api-key": "secret1",
            "api_key": "secret2",
            "APIKEY": "secret3",
            "access-key": "secret4",
            "AUTHORIZATION": "secret5",
        }
        result = redactor.redact_object(obj)
        for key in obj:
            assert result[key] == "[REDACTED]"

    def test_deeply_nested(self, redactor):
        obj = {"level1": {"level2": {"level3": {"password": "deep_secret"}}}}
        result = redactor.redact_object(obj)
        assert result["level1"]["level2"]["level3"]["password"] == "[REDACTED]"

    def test_sensitive_key_detection(self, redactor):
        assert redactor._is_sensitive_key("password")
        assert redactor._is_sensitive_key("api_key")
        assert redactor._is_sensitive_key("user_password_hash")
        assert redactor._is_sensitive_key("AUTH_TOKEN")
        assert not redactor._is_sensitive_key("username")
        assert not redactor._is_sensitive_key("email_address")
        assert not redactor._is_sensitive_key("count")
