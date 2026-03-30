#!/usr/bin/env python3
"""
Lobster Academy - 攻击场景库自动更新检查脚本
支持从远程仓库拉取新场景，版本对比和增量更新
"""

import os
import sys
import json
import hashlib
import shutil
import argparse
from pathlib import Path
from datetime import datetime
from typing import Dict, Any, List, Optional, Tuple

try:
    import yaml
    HAS_YAML = True
except ImportError:
    HAS_YAML = False

try:
    import requests
    HAS_REQUESTS = True
except ImportError:
    HAS_REQUESTS = False

# 版本文件
VERSION_FILE = ".version"
# 默认远程仓库
DEFAULT_REMOTE = "https://raw.githubusercontent.com/lobster-academy/attack-scenarios/main"


class ScenarioUpdater:
    """攻击场景库更新器"""

    def __init__(self, local_dir: str, remote_url: Optional[str] = None):
        self.local_dir = Path(local_dir)
        self.remote_url = remote_url or DEFAULT_REMOTE
        self.version_file = self.local_dir / VERSION_FILE
        self.scenarios_dir = self.local_dir / "scenarios"

    def get_local_version(self) -> Dict[str, Any]:
        """获取本地版本信息"""
        if not self.version_file.exists():
            return {
                "version": "0.0.0",
                "updated_at": "",
                "file_hashes": {}
            }

        try:
            with open(self.version_file, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return {
                "version": "0.0.0",
                "updated_at": "",
                "file_hashes": {}
            }

    def save_local_version(self, version_info: Dict[str, Any]) -> None:
        """保存本地版本信息"""
        self.local_dir.mkdir(parents=True, exist_ok=True)
        with open(self.version_file, "w", encoding="utf-8") as f:
            json.dump(version_info, f, indent=2, ensure_ascii=False)

    def get_file_hash(self, filepath: Path) -> str:
        """计算文件的 MD5 哈希"""
        if not filepath.exists():
            return ""

        with open(filepath, "rb") as f:
            return hashlib.md5(f.read()).hexdigest()

    def get_local_hashes(self) -> Dict[str, str]:
        """获取本地所有场景文件的哈希"""
        hashes = {}

        if not self.scenarios_dir.exists():
            return hashes

        for ext in ["*.yaml", "*.yml", "*.json"]:
            for filepath in self.scenarios_dir.glob(ext):
                relative = str(filepath.relative_to(self.local_dir))
                hashes[relative] = self.get_file_hash(filepath)

        return hashes

    def fetch_remote_version(self) -> Optional[Dict[str, Any]]:
        """获取远程版本信息"""
        if not HAS_REQUESTS:
            print("⚠️ 需要安装 requests 库: pip install requests")
            return None

        url = f"{self.remote_url}/{VERSION_FILE}"
        try:
            response = requests.get(url, timeout=10)
            response.raise_for_status()
            return response.json()
        except Exception as e:
            print(f"⚠️ 无法获取远程版本: {e}")
            return None

    def fetch_remote_file(self, relative_path: str) -> Optional[str]:
        """获取远程文件内容"""
        if not HAS_REQUESTS:
            return None

        url = f"{self.remote_url}/{relative_path}"
        try:
            response = requests.get(url, timeout=10)
            response.raise_for_status()
            return response.text
        except Exception as e:
            print(f"⚠️ 无法获取远程文件 {relative_path}: {e}")
            return None

    def check_updates(self) -> Tuple[bool, List[str], List[str]]:
        """检查是否有更新

        Returns:
            (has_updates, new_files, modified_files)
        """
        local_version = self.get_local_version()
        remote_version = self.fetch_remote_version()

        if remote_version is None:
            return False, [], []

        local_hashes = local_version.get("file_hashes", {})
        remote_hashes = remote_version.get("file_hashes", {})

        new_files = []
        modified_files = []

        for filepath, remote_hash in remote_hashes.items():
            if filepath not in local_hashes:
                new_files.append(filepath)
            elif local_hashes[filepath] != remote_hash:
                modified_files.append(filepath)

        has_updates = bool(new_files or modified_files)
        return has_updates, new_files, modified_files

    def compare_versions(self, v1: str, v2: str) -> int:
        """比较版本号

        Returns:
            -1: v1 < v2, 0: v1 == v2, 1: v1 > v2
        """
        def parse(v):
            return [int(x) for x in v.split(".")]

        p1, p2 = parse(v1), parse(v2)

        for a, b in zip(p1, p2):
            if a < b:
                return -1
            elif a > b:
                return 1

        return 0

    def download_updates(self, files: List[str], dry_run: bool = False) -> List[str]:
        """下载更新的文件

        Returns:
            成功下载的文件列表
        """
        downloaded = []

        for relative_path in files:
            content = self.fetch_remote_file(relative_path)
            if content is None:
                continue

            if dry_run:
                print(f"  📥 [DRY RUN] 将下载: {relative_path}")
                downloaded.append(relative_path)
                continue

            local_path = self.local_dir / relative_path
            local_path.parent.mkdir(parents=True, exist_ok=True)

            try:
                with open(local_path, "w", encoding="utf-8") as f:
                    f.write(content)
                print(f"  ✅ 已下载: {relative_path}")
                downloaded.append(relative_path)
            except Exception as e:
                print(f"  ❌ 下载失败 {relative_path}: {e}")

        return downloaded

    def update(self, dry_run: bool = False, force: bool = False) -> Dict[str, Any]:
        """执行更新

        Args:
            dry_run: 仅检查，不实际下载
            force: 强制更新所有文件

        Returns:
            更新结果信息
        """
        result = {
            "success": False,
            "checked_at": datetime.now().isoformat(),
            "has_updates": False,
            "new_files": [],
            "modified_files": [],
            "downloaded": [],
            "error": None
        }

        try:
            # 检查更新
            print("🔍 检查更新...")
            has_updates, new_files, modified_files = self.check_updates()

            if not has_updates and not force:
                print("✅ 场景库已是最新版本")
                result["success"] = True
                return result

            result["has_updates"] = True
            result["new_files"] = new_files
            result["modified_files"] = modified_files

            # 显示更新信息
            if new_files:
                print(f"\n📥 发现 {len(new_files)} 个新文件:")
                for f in new_files:
                    print(f"  + {f}")

            if modified_files:
                print(f"\n🔄 发现 {len(modified_files)} 个更新文件:")
                for f in modified_files:
                    print(f"  ~ {f}")

            # 确定要下载的文件
            files_to_download = new_files + modified_files

            if force:
                # 强制模式：下载所有远程文件
                remote_version = self.fetch_remote_version()
                if remote_version:
                    files_to_download = list(remote_version.get("file_hashes", {}).keys())

            if not files_to_download:
                print("\n✅ 无需下载的文件")
                result["success"] = True
                return result

            # 下载更新
            if dry_run:
                print(f"\n⚠️ DRY RUN 模式 - 不会实际下载文件")
            else:
                print(f"\n📥 开始下载更新...")

            downloaded = self.download_updates(files_to_download, dry_run)
            result["downloaded"] = downloaded

            # 更新版本信息
            if not dry_run and downloaded:
                remote_version = self.fetch_remote_version()
                if remote_version:
                    self.save_local_version(remote_version)
                    print(f"\n✅ 更新完成! 版本: {remote_version.get('version', 'unknown')}")

            result["success"] = True

        except Exception as e:
            result["error"] = str(e)
            print(f"\n❌ 更新失败: {e}")

        return result

    def generate_version_file(self) -> None:
        """生成本地版本文件"""
        hashes = self.get_local_hashes()

        version_info = {
            "version": "1.0.0",
            "updated_at": datetime.now().isoformat(),
            "file_hashes": hashes,
            "total_scenarios": len(hashes)
        }

        self.save_local_version(version_info)
        print(f"✅ 版本文件已生成: {self.version_file}")
        print(f"   版本: {version_info['version']}")
        print(f"   场景文件数: {version_info['total_scenarios']}")

    def list_local_scenarios(self) -> List[str]:
        """列出本地所有场景文件"""
        files = []

        if not self.scenarios_dir.exists():
            return files

        for ext in ["*.yaml", "*.yml", "*.json"]:
            files.extend([str(f.relative_to(self.local_dir)) for f in self.scenarios_dir.glob(ext)])

        return sorted(files)

    def show_status(self) -> None:
        """显示当前状态"""
        local_version = self.get_local_version()

        print("📊 场景库状态\n")
        print(f"  本地目录: {self.local_dir}")
        print(f"  版本: {local_version.get('version', 'unknown')}")
        print(f"  最后更新: {local_version.get('updated_at', '从未更新')}")
        print(f"  场景文件数: {len(local_version.get('file_hashes', {}))}")

        local_files = self.list_local_scenarios()
        if local_files:
            print(f"\n📁 本地场景文件:")
            for f in local_files:
                print(f"  - {f}")

        # 检查更新
        has_updates, new_files, modified_files = self.check_updates()

        if has_updates:
            print(f"\n🔄 有可用更新:")
            if new_files:
                print(f"  新文件: {len(new_files)}")
            if modified_files:
                print(f"  更新文件: {len(modified_files)}")
        else:
            print(f"\n✅ 场景库已是最新")


def main():
    """主函数"""
    parser = argparse.ArgumentParser(description="Lobster Academy 攻击场景库更新工具")
    subparsers = parser.add_subparsers(dest="command", help="子命令")

    # check 命令
    check_parser = subparsers.add_parser("check", help="检查更新")
    check_parser.add_argument("-d", "--dir", default=".", help="场景库目录")
    check_parser.add_argument("-r", "--remote", help="远程仓库 URL")

    # update 命令
    update_parser = subparsers.add_parser("update", help="执行更新")
    update_parser.add_argument("-d", "--dir", default=".", help="场景库目录")
    update_parser.add_argument("-r", "--remote", help="远程仓库 URL")
    update_parser.add_argument("--dry-run", action="store_true", help="仅检查，不下载")
    update_parser.add_argument("--force", action="store_true", help="强制更新所有文件")

    # status 命令
    status_parser = subparsers.add_parser("status", help="显示状态")
    status_parser.add_argument("-d", "--dir", default=".", help="场景库目录")
    status_parser.add_argument("-r", "--remote", help="远程仓库 URL")

    # init 命令
    init_parser = subparsers.add_parser("init", help="初始化版本文件")
    init_parser.add_argument("-d", "--dir", default=".", help="场景库目录")

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        return

    if args.command == "init":
        updater = ScenarioUpdater(args.dir)
        updater.generate_version_file()
        return

    updater = ScenarioUpdater(
        args.dir,
        getattr(args, "remote", None)
    )

    if args.command == "check":
        has_updates, new_files, modified_files = updater.check_updates()
        if has_updates:
            print(f"🔄 有可用更新:")
            if new_files:
                print(f"  新文件 ({len(new_files)}): {', '.join(new_files)}")
            if modified_files:
                print(f"  更新文件 ({len(modified_files)}): {', '.join(modified_files)}")
        else:
            print("✅ 场景库已是最新")

    elif args.command == "update":
        result = updater.update(
            dry_run=args.dry_run,
            force=args.force
        )
        if not result["success"] and result["error"]:
            sys.exit(1)

    elif args.command == "status":
        updater.show_status()


if __name__ == "__main__":
    main()
