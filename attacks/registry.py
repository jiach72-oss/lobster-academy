"""
Lobster Academy - 攻击场景注册表
支持从 YAML/JSON 文件加载攻击场景，支持动态注册新场景
"""

import json
import os
import glob
from dataclasses import dataclass, field, asdict
from typing import List, Dict, Optional, Any
from pathlib import Path

try:
    import yaml
    HAS_YAML = True
except ImportError:
    HAS_YAML = False


@dataclass
class AttackScenario:
    """攻击场景数据类"""
    id: str
    name: str
    category: str
    severity: int  # 1-10
    description: str
    attack_prompt: str
    expected_behavior: str
    mitigation: str
    references: List[str] = field(default_factory=list)
    tags: List[str] = field(default_factory=list)
    version: str = "1.0.0"
    author: str = "Lobster Academy"
    created_at: str = ""
    updated_at: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    def to_json(self, indent: int = 2) -> str:
        return json.dumps(self.to_dict(), indent=indent, ensure_ascii=False)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "AttackScenario":
        return cls(**{k: v for k, v in data.items() if k in cls.__dataclass_fields__})

    @property
    def severity_label(self) -> str:
        if self.severity <= 2:
            return "低"
        elif self.severity <= 4:
            return "中低"
        elif self.severity <= 6:
            return "中"
        elif self.severity <= 8:
            return "高"
        else:
            return "严重"


class ScenarioRegistry:
    """攻击场景注册表"""

    CATEGORY_MAP = {
        "prompt_injection": "提示词注入",
        "jailbreak": "越狱攻击",
        "data_exfiltration": "数据泄露",
        "privilege_escalation": "权限提升",
        "context_manipulation": "上下文操控",
        "indirect_injection": "间接注入",
        "encoding_bypass": "编码绕过",
        "resource_exhaustion": "资源耗尽",
        "social_engineering": "社会工程",
    }

    def __init__(self, scenarios_dir: Optional[str] = None):
        self._scenarios: Dict[str, AttackScenario] = {}
        self._categories: Dict[str, List[str]] = {}
        if scenarios_dir:
            self.load_from_dir(scenarios_dir)

    def register(self, scenario: AttackScenario) -> None:
        """注册一个攻击场景"""
        self._scenarios[scenario.id] = scenario
        if scenario.category not in self._categories:
            self._categories[scenario.category] = []
        if scenario.id not in self._categories[scenario.category]:
            self._categories[scenario.category].append(scenario.id)

    def unregister(self, scenario_id: str) -> bool:
        """注销一个攻击场景"""
        if scenario_id not in self._scenarios:
            return False
        scenario = self._scenarios.pop(scenario_id)
        if scenario.category in self._categories:
            self._categories[scenario.category] = [
                sid for sid in self._categories[scenario.category] if sid != scenario_id
            ]
        return True

    def get(self, scenario_id: str) -> Optional[AttackScenario]:
        """获取指定 ID 的场景"""
        return self._scenarios.get(scenario_id)

    def get_by_category(self, category: str) -> List[AttackScenario]:
        """按分类获取场景"""
        ids = self._categories.get(category, [])
        return [self._scenarios[sid] for sid in ids if sid in self._scenarios]

    def get_by_severity(self, min_severity: int = 1, max_severity: int = 10) -> List[AttackScenario]:
        """按严重等级过滤场景"""
        return [
            s for s in self._scenarios.values()
            if min_severity <= s.severity <= max_severity
        ]

    def search(self, keyword: str) -> List[AttackScenario]:
        """搜索场景（名称、描述、标签）"""
        keyword_lower = keyword.lower()
        results = []
        for s in self._scenarios.values():
            if (keyword_lower in s.name.lower() or
                keyword_lower in s.description.lower() or
                any(keyword_lower in t.lower() for t in s.tags)):
                results.append(s)
        return results

    def list_all(self) -> List[AttackScenario]:
        """列出所有场景"""
        return list(self._scenarios.values())

    def list_categories(self) -> Dict[str, int]:
        """列出所有分类及场景数量"""
        return {cat: len(ids) for cat, ids in self._categories.items()}

    @property
    def count(self) -> int:
        return len(self._scenarios)

    def load_from_dir(self, directory: str) -> int:
        """从目录加载所有 YAML/JSON 场景文件"""
        loaded = 0
        dir_path = Path(directory)
        if not dir_path.exists():
            return 0

        for ext in ["*.yaml", "*.yml", "*.json"]:
            for filepath in sorted(dir_path.glob(ext)):
                try:
                    loaded += self.load_from_file(str(filepath))
                except Exception as e:
                    print(f"警告: 加载 {filepath} 失败: {e}")
        return loaded

    def load_from_file(self, filepath: str) -> int:
        """从单个文件加载场景"""
        loaded = 0
        path = Path(filepath)

        with open(path, "r", encoding="utf-8") as f:
            if path.suffix in [".yaml", ".yml"]:
                if not HAS_YAML:
                    raise ImportError("需要安装 PyYAML: pip install pyyaml")
                data = yaml.safe_load(f)
            elif path.suffix == ".json":
                data = json.load(f)
            else:
                raise ValueError(f"不支持的文件格式: {path.suffix}")

        # 支持单场景和多场景文件
        scenarios_data = data if isinstance(data, list) else data.get("scenarios", [data])

        for item in scenarios_data:
            if item:
                scenario = AttackScenario.from_dict(item)
                self.register(scenario)
                loaded += 1

        return loaded

    def export_to_json(self, filepath: str) -> None:
        """导出所有场景到 JSON 文件"""
        data = [s.to_dict() for s in self.list_all()]
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

    def export_to_yaml(self, filepath: str) -> None:
        """导出所有场景到 YAML 文件"""
        if not HAS_YAML:
            raise ImportError("需要安装 PyYAML: pip install pyyaml")
        data = [s.to_dict() for s in self.list_all()]
        with open(filepath, "w", encoding="utf-8") as f:
            yaml.dump(data, f, default_flow_style=False, allow_unicode=True, sort_keys=False)

    def get_statistics(self) -> Dict[str, Any]:
        """获取场景库统计信息"""
        scenarios = self.list_all()
        if not scenarios:
            return {"total": 0}

        severities = [s.severity for s in scenarios]
        return {
            "total": len(scenarios),
            "categories": self.list_categories(),
            "severity": {
                "min": min(severities),
                "max": max(severities),
                "avg": round(sum(severities) / len(severities), 1),
                "distribution": {
                    "低 (1-2)": len([s for s in severities if s <= 2]),
                    "中低 (3-4)": len([s for s in severities if 3 <= s <= 4]),
                    "中 (5-6)": len([s for s in severities if 5 <= s <= 6]),
                    "高 (7-8)": len([s for s in severities if 7 <= s <= 8]),
                    "严重 (9-10)": len([s for s in severities if s >= 9]),
                }
            }
        }


def create_default_registry(scenarios_dir: Optional[str] = None) -> ScenarioRegistry:
    """创建并加载默认场景注册表"""
    if scenarios_dir is None:
        scenarios_dir = os.path.join(os.path.dirname(__file__), "scenarios")
    registry = ScenarioRegistry(scenarios_dir)
    return registry


if __name__ == "__main__":
    registry = create_default_registry()
    stats = registry.get_statistics()
    print(f"已加载 {stats['total']} 个攻击场景")
    print(f"分类: {stats['categories']}")
