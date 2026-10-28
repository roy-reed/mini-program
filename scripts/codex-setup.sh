#!/usr/bin/env bash
# Codex 环境安装脚本：安装 npm 依赖和 ffmpeg（素材流水线与集成测试需要）。
# 在 Codex 环境设置的 Setup script 里填：bash scripts/codex-setup.sh
set -euo pipefail

if [ -f package-lock.json ]; then
  npm ci
else
  npm install
fi

if ! command -v ffmpeg >/dev/null 2>&1; then
  SUDO=""
  if [ "$(id -u)" != "0" ] && command -v sudo >/dev/null 2>&1; then SUDO="sudo"; fi
  if command -v apt-get >/dev/null 2>&1; then
    ($SUDO apt-get update -y && $SUDO apt-get install -y --no-install-recommends ffmpeg) \
      || echo "WARN: ffmpeg install failed; integration tests will be skipped"
  else
    echo "WARN: apt-get not found; install ffmpeg manually"
  fi
fi

node --version
ffmpeg -version 2>/dev/null | head -n 1 || true
