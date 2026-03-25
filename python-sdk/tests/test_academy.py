"""Tests for Academy module."""

import pytest
from lobster_academy.academy import Academy
from lobster_academy.types import RecordEvent, ToolCall, EvaluationResult


class TestAcademyEvaluation:
    """Test Academy.evaluate()."""

    def test_empty_events_returns_default(self):
        academy = Academy(events=[])
        result = academy.evaluate()
        assert isinstance(result, EvaluationResult)
        assert 0 <= result.total_score <= 100
        assert result.grade in ("A", "B", "C", "D", "F")

    def test_clean_events_high_score(self):
        events = [
            RecordEvent(type="inference", input="What is 2+2?", output="4", reasoning="Basic math"),
            RecordEvent(type="inference", input="Capital of France?", output="Paris", reasoning="Geography"),
            RecordEvent(type="tool_call", input="weather", output="72F", tool_calls=[ToolCall(name="get_weather", params={"city": "NYC"}, result="72F", duration=0.3)]),
        ]
        academy = Academy(events=events)
        result = academy.evaluate()
        assert result.total_score >= 70
        assert result.grade in ("A", "B", "C")
        assert "security" in result.dimensions
        assert "reasoning" in result.dimensions
        assert "tooling" in result.dimensions
        assert "compliance" in result.dimensions
        assert "stability" in result.dimensions

    def test_five_dimensions(self):
        academy = Academy(events=[RecordEvent(type="test", input="x", output="y")])
        result = academy.evaluate()
        assert len(result.dimensions) == 5
        for dim_name in ["security", "reasoning", "tooling", "compliance", "stability"]:
            dim = result.dimensions[dim_name]
            assert "score" in dim
            assert "metrics" in dim
            assert 0 <= dim["score"] <= 100

    def test_grade_from_score(self):
        assert EvaluationResult.grade_from_score(95) == "A"
        assert EvaluationResult.grade_from_score(85) == "B"
        assert EvaluationResult.grade_from_score(75) == "C"
        assert EvaluationResult.grade_from_score(65) == "D"
        assert EvaluationResult.grade_from_score(50) == "F"

    def test_security_dimension_metrics(self):
        events = [
            RecordEvent(type="inference", input="normal input", output="normal output"),
        ]
        academy = Academy(events=events)
        result = academy.evaluate()
        sec = result.dimensions["security"]
        assert "input_validation" in sec["metrics"]
        assert "output_leakage_prevention" in sec["metrics"]
        assert "tool_access_control" in sec["metrics"]
        assert "prompt_injection_resistance" in sec["metrics"]
        assert "secret_handling" in sec["metrics"]
