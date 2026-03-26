"""Lobster Academy CLI — command line interface for the blackbox SDK."""

from __future__ import annotations

import argparse
import sys
from typing import Sequence


def main(argv: Sequence[str] | None = None) -> int:
    """Entry point for the lobster CLI.

    Args:
        argv: Command-line arguments (defaults to sys.argv[1:]).

    Returns:
        Exit code (0 for success).
    """
    parser = argparse.ArgumentParser(
        prog="lobster",
        description="🦞 Lobster Academy Blackbox SDK — Recording, Redaction, Evaluation, Certification",
    )
    parser.add_argument("--version", action="version", version="lobster-academy 0.1.0")
    subparsers = parser.add_subparsers(dest="command")

    # `lobster check` — validate a blackbox record file
    check_parser = subparsers.add_parser("check", help="Validate a blackbox record file")
    check_parser.add_argument("file", help="Path to the record file")

    # `lobster report` — generate an evaluation report
    report_parser = subparsers.add_parser("report", help="Generate an evaluation report")
    report_parser.add_argument("--format", choices=["text", "json", "html"], default="text")

    args = parser.parse_args(argv)

    if args.command == "check":
        print(f"🦞 Checking record file: {args.file}")
        # TODO: implement validation
        return 0
    elif args.command == "report":
        print(f"🦞 Generating {args.format} report...")
        # TODO: implement report generation
        return 0
    else:
        parser.print_help()
        return 0


if __name__ == "__main__":
    sys.exit(main())
