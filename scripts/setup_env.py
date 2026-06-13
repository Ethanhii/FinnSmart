#!/usr/bin/env python3
"""Bootstrap FinnSmart dev environment (Node.js app). Uses Python stdlib only."""

from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MIN_NODE_MAJOR = 20


def require(cmd: str, install_hint: str) -> None:
    if shutil.which(cmd) is None:
        print(f"Error: '{cmd}' not found.\n{install_hint}")
        sys.exit(1)


def check_node_version() -> None:
    result = subprocess.run(
        ["node", "-v"],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=True,
    )
    version = result.stdout.strip().lstrip("v")
    major = int(version.split(".")[0])
    if major < MIN_NODE_MAJOR:
        print(
            f"Error: Node.js {MIN_NODE_MAJOR}+ required (found v{version}).\n"
            "Install from https://nodejs.org/ or run: nvm install"
        )
        sys.exit(1)
    print(f"Node.js v{version} OK")


def main() -> None:
    print("FinnSmart environment setup\n")

    require("node", "Install Node.js 20+ from https://nodejs.org/")
    require("npm", "npm ships with Node.js — reinstall Node if missing.")
    check_node_version()

    print("Installing npm dependencies…")
    subprocess.run(["npm", "install"], cwd=ROOT, check=True)

    env_local = ROOT / ".env.local"
    env_example = ROOT / ".env.example"
    if not env_local.exists() and env_example.exists():
        shutil.copy(env_example, env_local)
        print("Created .env.local from .env.example — add API keys for live mode.")
    elif env_local.exists():
        print(".env.local already exists — skipped.")
    else:
        print("Warning: .env.example not found — create .env.local manually.")

    print("\nSetup complete. Run:\n  npm run dev\nThen open http://localhost:3000")


if __name__ == "__main__":
    main()
