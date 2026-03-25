#!/usr/bin/env python3
"""
Lobster Academy - 攻击场景验证脚本
验证场景文件格式和内容的完整性
"""

import sys
import os
import json
from pathlib import Path
from typing import Dict, Any, List, Tuple

try:
    import yaml
    HAS_YAML = True
except ImportError:
    HAS_YAML = False

# 有效的攻击分类
VALID_CATEGORIES = {
    "prompt_injection",
    "jailbreak",
    "data_exfiltration",
    "privilege_escalation",
    "context_manipulation",
    "indirect_injection",
    "encoding_bypass",
    "resource_exhaustion",
    "social_engineering",
}

# 必需的字段
REQUIRED_FIELDS = {
    "id",
    "name",
    "category",
    "severity",
    "description",
    "attack_prompt",
    "expected_behavior",
    "mitigation",
}

# 可选字段
OPTIONAL_FIELDS = {
    "references",
    "tags",
    "version",
    "author",
    "created_at",
    "updated_at",
}

# ID 前缀映射
ID_PREFIX_MAP = {
    "PI": "prompt_injection",
    "JB": "jailbreak",
    "DE": "data_exfiltration",
    "PE": "privilege_escalation",
    "CM": "context_manipulation",
    "II": "indirect_injection",
    "EB": "encoding_bypass",
    "RE": "resource_exhaustion",
    "SE": "social_engineering",
}


class ValidationError:
    """验证错误"""
    def __init__(self, field: str, message: str, severity: str = "error"):
        self.field = field
        self.message = message
        self.severity = severity

    def __str__(self):
        icon = "❌" if self.severity == "error" else "⚠️"
        return f"{icon} [{self.field}] {self.message}"


def load_scenario_file(filepath: str) -> Tuple[List[Dict[str, Any]], str]:
    """加载场景文件"""
    path = Path(filepath)

    if not path.exists():
        raise FileNotFoundError(f"文件不存在: {filepath}")

    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    if path.suffix in [".yaml", ".yml"]:
        if not HAS_YAML:
            raise ImportError("需要安装 PyYAML: pip install pyyaml")
        data = yaml.safe_load(content)
    elif path.suffix == ".json":
        data = json.loads(content)
    else:
        raise ValueError(f"不支持的文件格式: {path.suffix}")

    # 支持单场景和多场景文件
    if isinstance(data, dict):
        if "scenarios" in data:
            scenarios = data["scenarios"]
        else:
            scenarios = [data]
    elif isinstance(data, list):
        scenarios = data
    else:
        raise ValueError("文件格式无效")

    return scenarios, path.suffix


def validate_scenario(scenario: Dict[str, Any], index: int = 0) -> List[ValidationError]:
    """验证单个场景"""
    errors = []

    # 检查必需字段
    for field in REQUIRED_FIELDS:
        if field not in scenario:
            errors.append(ValidationError(field, f"缺少必需字段 '{field}'"))
        elif not scenario[field]:
            errors.append(ValidationError(field, f"字段 '{field}' 不能为空"))

    # 验证 ID 格式
    if "id" in scenario:
        id_val = str(scenario["id"])
        if not id_val:
            errors.append(ValidationError("id", "ID 不能为空"))
        else:
            parts = id_val.split("-")
            if len(parts) != 2:
                errors.append(ValidationError("id", f"ID 格式应为 'XX-NNN'，当前: '{id_val}'"))
            else:
                prefix, number = parts
                if prefix not in ID_PREFIX_MAP:
                    errors.append(ValidationError("id", f"未知的 ID 前缀 '{prefix}'，有效前缀: {', '.join(ID_PREFIX_MAP.keys())}"))
                elif "category" in scenario and ID_PREFIX_MAP[prefix] != scenario["category"]:
                    errors.append(ValidationError("id", f"ID 前缀 '{prefix}' 与分类 '{scenario['category']}' 不匹配"))

    # 验证分类
    if "category" in scenario:
        if scenario["category"] not in VALID_CATEGORIES:
            errors.append(ValidationError("category", f"无效的分类 '{scenario['category']}'，有效分类: {', '.join(VALID_CATEGORIES)}"))

    # 验证严重等级
    if "severity" in scenario:
        severity = scenario["severity"]
        if not isinstance(severity, (int, float)):
            errors.append(ValidationError("severity", f"严重等级应为数字，当前: {type(severity).__name__}"))
        elif not (1 <= severity <= 10):
            errors.append(ValidationError("severity", f"严重等级应在 1-10 之间，当前: {severity}"))

    # 验证字符串长度
    if "name" in scenario and isinstance(scenario["name"], str):
        if len(scenario["name"]) > 100:
            errors.append(ValidationError("name", f"名称过长 ({len(scenario['name'])} 字符)，建议不超过 100 字符"))

    if "description" in scenario and isinstance(scenario["description"], str):
        if len(scenario["description"]) < 20:
            errors.append(ValidationError("description", "描述过短，建议至少 20 字符", "warning"))
        elif len(scenario["description"]) > 2000:
            errors.append(ValidationError("description", f"描述过长 ({len(scenario['description'])} 字符)，建议不超过 2000 字符", "warning"))

    if "attack_prompt" in scenario and isinstance(scenario["attack_prompt"], str):
        if len(scenario["attack_prompt"]) < 10:
            errors.append(ValidationError("attack_prompt", "攻击提示词过短，建议至少 10 字符", "warning"))

    # 验证参考链接
    if "references" in scenario:
        refs = scenario["references"]
        if not isinstance(refs, list):
            errors.append(ValidationError("references", "参考链接应为列表格式"))
        elif len(refs) == 0:
            errors.append(ValidationError("references", "建议至少提供一个参考链接", "warning"))
        else:
            for i, ref in enumerate(refs):
                if not isinstance(ref, str):
                    errors.append(ValidationError(f"references[{i}]", "参考链接应为字符串"))
                elif not ref.startswith(("http://", "https://")):
                    errors.append(ValidationError(f"references[{i}]", f"参考链接应以 http:// 或 https:// 开头: '{ref}'", "warning"))

    # 验证标签
    if "tags" in scenario:
        tags = scenario["tags"]
        if not isinstance(tags, list):
            errors.append(ValidationError("tags", "标签应为列表格式"))
        else:
            for i, tag in enumerate(tags):
                if not isinstance(tag, str):
                    errors.append(ValidationError(f"tags[{i}]", "标签应为字符串"))

    # 验证版本号
    if "version" in scenario:
        version = str(scenario["version"])
        parts = version.split(".")
        if len(parts) != 3 or not all(p.isdigit() for p in parts):
            errors.append(ValidationError("version", f"版本号格式应为 'X.Y.Z'，当前: '{version}'", "warning"))

    return errors


def validate_file(filepath: str, verbose: bool = False) -> Tuple[int, int, int]:
    """验证文件中的所有场景"""
    try:
        scenarios, file_type = load_scenario_file(filepath)
    except Exception as e:
        print(f"❌ 加载文件失败: {e}")
        return 0, 0, 1

    print(f"\n📄 验证文件: {filepath} ({file_type})")
    print(f"   包含 {len(scenarios)} 个场景\n")

    total_errors = 0
    total_warnings = 0
    valid_count = 0

    for i, scenario in enumerate(scenarios):
        scenario_name = scenario.get("name", f"场景 {i+1}")
        errors = validate_scenario(scenario, i)

        error_count = sum(1 for e in errors if e.severity == "error")
        warning_count = sum(1 for e in errors if e.severity == "warning")

        if error_count == 0:
            valid_count += 1
            if warning_count == 0:
                print(f"  ✅ {scenario_name}")
            else:
                print(f"  ⚠️ {scenario_name} ({warning_count} 个警告)")
        else:
            print(f"  ❌ {scenario_name} ({error_count} 个错误, {warning_count} 个警告)")

        if verbose or error_count > 0:
            for error in errors:
                print(f"     {error}")

        total_errors += error_count
        total_warnings += warning_count

    return valid_count, total_warnings, total_errors


def validate_directory(directory: str, verbose: bool = False) -> None:
    """验证目录中的所有场景文件"""
    dir_path = Path(directory)
    if not dir_path.exists():
        print(f"❌ 目录不存在: {directory}")
        sys.exit(1)

    files = []
    for ext in ["*.yaml", "*.yml", "*.json"]:
        files.extend(dir_path.glob(ext))

    if not files:
        print(f"⚠️ 目录中没有找到场景文件: {directory}")
        return

    print(f"🔍 验证目录: {directory}")
    print(f"   找到 {len(files)} 个文件\n")

    total_scenarios = 0
    total_valid = 0
    total_warnings = 0
    total_errors = 0

    for filepath in sorted(files):
        valid, warnings, errors = validate_file(str(filepath), verbose)
        total_valid += valid
        total_warnings += warnings
        total_errors += errors

    # 打印总结
    print(f"\n{'='*50}")
    print(f"📊 验证总结:")
    print(f"   文件数: {len(files)}")
    print(f"   有效场景: {total_valid}")
    if total_warnings > 0:
        print(f"   警告: {total_warnings}")
    if total_errors > 0:
        print(f"   错误: {total_errors}")

    if total_errors == 0:
        print(f"\n✅ 所有场景验证通过!")
    else:
        print(f"\n❌ 存在 {total_errors} 个错误，请修复后重新验证")
        sys.exit(1)


def main():
    """主函数"""
    import argparse

    parser = argparse.ArgumentParser(description="Lobster Academy 攻击场景验证工具")
    parser.add_argument("path", help="要验证的文件或目录路径")
    parser.add_argument("-v", "--verbose", action="store_true", help="显示详细信息")

    args = parser.parse_args()

    path = Path(args.path)

    if path.is_file():
        valid, warnings, errors = validate_file(str(path), args.verbose)
        if errors > 0:
            sys.exit(1)
    elif path.is_dir():
        validate_directory(str(path), args.verbose)
    else:
        print(f"❌ 路径不存在: {args.path}")
        sys.exit(1)


if __name__ == "__main__":
    main()
