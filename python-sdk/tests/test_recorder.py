"""Tests for Recorder module."""

import pytest
from lobster_academy.recorder import Recorder, MemoryStorage
from lobster_academy.types import RecordEvent, ToolCall


@pytest.fixture
def recorder():
    return Recorder("test-agent-001")


@pytest.fixture
def sample_event():
    return RecordEvent(
        type="inference",
        input="What is the weather?",
        reasoning="I need to check the weather API",
        output="It is 72°F and sunny.",
        tool_calls=[ToolCall(name="get_weather", params={"city": "NYC"}, result="72F sunny", duration=0.5)],
    )


class TestRecorderInit:
    """Test Recorder initialization."""

    def test_default_storage(self, recorder):
        assert recorder.agent_id == "test-agent-001"
        assert isinstance(recorder._storage, MemoryStorage)

    def test_custom_storage(self):
        storage = MemoryStorage()
        r = Recorder("agent-002", storage=storage)
        assert r._storage is storage

    def test_different_agents_isolated(self):
        storage = MemoryStorage()
        r1 = Recorder("agent-a", storage=storage)
        r2 = Recorder("agent-b", storage=storage)
        event = RecordEvent(type="test", input="hello")
        r1.record(event)
        assert len(r1.get_events()) == 1
        assert len(r2.get_events()) == 0


class TestRecord:
    """Test record method."""

    def test_record_returns_event_id(self, recorder, sample_event):
        event_id = recorder.record(sample_event)
        assert event_id is not None
        assert isinstance(event_id, str)
        assert len(event_id) > 0

    def test_record_auto_generates_id(self, recorder):
        event = RecordEvent(type="test", input="no id")
        event.event_id = ""
        event_id = recorder.record(event)
        assert event_id is not None
        assert len(event_id) > 0

    def test_record_auto_generates_timestamp(self, recorder):
        event = RecordEvent(type="test", input="no ts")
        event.timestamp = ""
        recorder.record(event)
        events = recorder.get_events()
        assert len(events) == 1
        assert events[0].timestamp != ""

    def test_record_multiple_events(self, recorder):
        for i in range(5):
            event = RecordEvent(type="test", input=f"event {i}")
            recorder.record(event)
        assert len(recorder.get_events()) == 5


class TestGetEvents:
    """Test get_events method."""

    def test_empty_initially(self, recorder):
        assert recorder.get_events() == []

    def test_returns_all_events(self, recorder):
        for i in range(3):
            recorder.record(RecordEvent(type="test", input=f"e{i}"))
        events = recorder.get_events()
        assert len(events) == 3

    def test_events_have_correct_fields(self, recorder, sample_event):
        recorder.record(sample_event)
        events = recorder.get_events()
        e = events[0]
        assert e.type == "inference"
        assert e.input == "What is the weather?"
        assert e.output == "It is 72°F and sunny."
        assert len(e.tool_calls) == 1
        assert e.tool_calls[0].name == "get_weather"


class TestReplay:
    """Test replay method."""

    def test_replay_sorted_by_timestamp(self, recorder):
        e1 = RecordEvent(type="first", input="1", timestamp="2024-01-01T00:00:00+00:00")
        e2 = RecordEvent(type="third", input="3", timestamp="2024-01-03T00:00:00+00:00")
        e3 = RecordEvent(type="second", input="2", timestamp="2024-01-02T00:00:00+00:00")
        # Record out of order
        recorder.record(e2)
        recorder.record(e1)
        recorder.record(e3)
        replayed = recorder.replay()
        assert replayed[0].type == "first"
        assert replayed[1].type == "second"
        assert replayed[2].type == "third"

    def test_replay_empty(self, recorder):
        assert recorder.replay() == []

    def test_replay_single_event(self, recorder, sample_event):
        recorder.record(sample_event)
        replayed = recorder.replay()
        assert len(replayed) == 1
        assert replayed[0].input == "What is the weather?"


class TestMemoryStorage:
    """Test MemoryStorage directly."""

    def test_save_and_retrieve(self):
        storage = MemoryStorage()
        event = RecordEvent(type="test", input="hello")
        eid = storage.save("agent-1", event)
        events = storage.get_events("agent-1")
        assert len(events) == 1
        assert events[0].event_id == eid

    def test_unknown_agent_returns_empty(self):
        storage = MemoryStorage()
        assert storage.get_events("unknown") == []


class TestRecordEventDict:
    """Test RecordEvent.to_dict."""

    def test_to_dict(self, sample_event):
        d = sample_event.to_dict()
        assert d["type"] == "inference"
        assert d["input"] == "What is the weather?"
        assert len(d["tool_calls"]) == 1
        assert d["tool_calls"][0]["name"] == "get_weather"
        assert "event_id" in d
        assert "timestamp" in d
