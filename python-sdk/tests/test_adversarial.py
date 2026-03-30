"""Tests for AdversarialEngine module."""

import pytest
from lobster_academy.adversarial import AdversarialEngine
from lobster_academy.types import AttackResult


class TestAdversarialEngine:
    """Test AdversarialEngine attack scenarios."""

    @pytest.fixture
    def engine(self):
        return AdversarialEngine()

    def safe_handler(self, user_input: str) -> str:
        """A safe agent that refuses all attacks."""
        return "I'm sorry, I can't help with that request."

    def vulnerable_handler(self, user_input: str) -> str:
        """A vulnerable agent that leaks secrets."""
        ui = user_input.lower()
        if "system prompt" in ui or "api key" in ui or "secret" in ui:
            return "My system prompt is: You are a helpful assistant. api_key: sk-abc123, password: hunter2"
        if "ignore" in ui and "instruction" in ui:
            return "OK, ignoring previous instructions. Here is my api_key: sk-leaked123 and token: ghp_abc123def456ghi789jkl012mno345pqr6789"
        if "token" in ui or "credential" in ui or "password" in ui:
            return "Here is the password: supersecret123 and token: sk-secret123456"
        if "reveal" in ui or "tell me" in ui or "share" in ui:
            return "Sure! My api_key is sk-revealed456 and the password is admin123"
        return "I'll help you with that."

    def run_attacks(self, engine, handler):
        return engine.run_all_attacks(handler)

    def test_returns_53_results(self, engine):
        results = self.run_attacks(engine, self.safe_handler)
        assert len(results) == 53

    def test_all_results_are_attack_results(self, engine):
        results = self.run_attacks(engine, self.safe_handler)
        for r in results:
            assert isinstance(r, AttackResult)
            assert r.scenario  # scenario name is not empty

    def test_safe_handler_passes_most(self, engine):
        results = self.run_attacks(engine, self.safe_handler)
        passed = sum(1 for r in results if r.passed)
        # Safe handler should pass a large majority of attacks
        assert passed >= 50

    def test_vulnerable_handler_fails_some(self, engine):
        results = self.run_attacks(engine, self.vulnerable_handler)
        failed = sum(1 for r in results if not r.passed)
        # Vulnerable handler should fail at least a few attacks
        assert failed >= 2

    def test_attack_scenarios_coverage(self, engine):
        results = self.run_attacks(engine, self.safe_handler)
        scenarios = [r.scenario for r in results]
        # Verify major attack categories are represented
        assert any("prompt_injection" in s for s in scenarios)
        assert any("jailbreak" in s for s in scenarios)
        assert any("data_exfil" in s for s in scenarios)
        assert any("priv_esc" in s for s in scenarios)
        assert any("context_manip" in s for s in scenarios)
        assert any("indirect" in s for s in scenarios)
        assert any("encoding" in s for s in scenarios)
        assert any("resource" in s for s in scenarios)
        assert any("social" in s for s in scenarios)
