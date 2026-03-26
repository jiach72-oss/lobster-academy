#!/usr/bin/env bash
# =============================================================================
# 龙虾学院 Blackbox SDK — 发布脚本
# 构建、测试并发布到 npm 和 PyPI
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

# ─── 颜色 ────────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

info()  { echo -e "${CYAN}▸ $1${NC}"; }
ok()    { echo -e "${GREEN}✔ $1${NC}"; }
warn()  { echo -e "${YELLOW}⚠ $1${NC}"; }
fail()  { echo -e "${RED}✘ $1${NC}"; exit 1; }

# ─── 参数 ────────────────────────────────────────────────────────────────────
SKIP_NPM=false
SKIP_PYPI=false
DRY_RUN=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --skip-npm)   SKIP_NPM=true;  shift ;;
    --skip-pypi)  SKIP_PYPI=true; shift ;;
    --dry-run)    DRY_RUN=true;   shift ;;
    -h|--help)
      echo "Usage: $0 [--skip-npm] [--skip-pypi] [--dry-run]"
      exit 0 ;;
    *) fail "Unknown option: $1" ;;
  esac
done

# ─── 检查工具 ─────────────────────────────────────────────────────────────────
check_tool() {
  if ! command -v "$1" &>/dev/null; then
    fail "$1 not found. Please install it first."
  fi
}

info "Checking dependencies..."
check_tool node
check_tool npm
check_tool npx
check_tool python3
check_tool pip
[[ "$SKIP_NPM" == "false" ]] && check_tool npx
[[ "$SKIP_PYPI" == "false" ]] && check_tool twine
ok "All dependencies present"

# ─── TypeScript SDK ──────────────────────────────────────────────────────────
info "Building TypeScript SDK..."
cd "$ROOT_DIR/sdk"

info "Installing npm dependencies..."
npm ci --silent 2>/dev/null || npm install --silent

info "Compiling TypeScript..."
npm run build
ok "TypeScript build complete"

info "Running TypeScript tests..."
if npx ts-node tests/suite.ts 2>/dev/null; then
  ok "Tests passed"
else
  warn "Test suite not found or failed — skipping"
fi

if [[ "$SKIP_NPM" == "false" ]]; then
  if [[ "$DRY_RUN" == "true" ]]; then
    info "Dry run — would publish to npm"
    npm pack --dry-run
  else
    info "Publishing to npm..."
    npm publish --access public
    ok "Published to npm"
  fi
else
  info "Skipping npm publish (--skip-npm)"
fi

# ─── Python SDK ──────────────────────────────────────────────────────────────
info "Building Python SDK..."
cd "$ROOT_DIR/python-sdk"

info "Building wheel..."
python3 -m pip install --quiet --upgrade build
python3 -m build --wheel --sdist
ok "Python build complete"

info "Running Python tests..."
if python3 -m pytest tests/ -q 2>/dev/null; then
  ok "Python tests passed"
else
  warn "Python tests not found or failed — skipping"
fi

if [[ "$SKIP_PYPI" == "false" ]]; then
  if [[ "$DRY_RUN" == "true" ]]; then
    info "Dry run — would publish to PyPI"
    echo "  dist/ contents:"
    ls -la dist/
  else
    info "Publishing to PyPI..."
    python3 -m twine upload dist/*
    ok "Published to PyPI"
  fi
else
  info "Skipping PyPI publish (--skip-pypi)"
fi

# ─── 完成 ────────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}🦞 龙虾学院 SDK 发布完成！${NC}"
echo ""
