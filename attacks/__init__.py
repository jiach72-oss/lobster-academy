"""
Lobster Academy - 攻击场景库
用于 AI/LLM 安全教育和红队测试的攻击场景集合
"""

from .registry import (
    AttackScenario,
    ScenarioRegistry,
    create_default_registry,
)

__version__ = "1.0.0"
__all__ = [
    "AttackScenario",
    "ScenarioRegistry",
    "create_default_registry",
]
