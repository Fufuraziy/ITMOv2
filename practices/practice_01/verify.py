"""Cross-platform artifact check for practice 1 (replaces POSIX-shell recipe)."""

import sys
from pathlib import Path

BASE = Path(__file__).resolve().parent

REQUIRED = ["README.md", "TRAINING_PR.diff"]
ARTIFACTS = [
    "context.md", "problem.md", "analysis.md", "product_management.md",
    "project_management.md", "adr.md", "tests_unit.md", "tests_integration.md",
    "tests_load.md", "tests_e2e.md", "prompts.md",
]
CONTAINS = {
    "context.md": ["## Context Pack"],
    "problem.md": ["## Метрики"],
    "analysis.md": ["## TO BE"],
    "product_management.md": ["```gherkin"],
    "project_management.md": ["```mermaid"],
    "adr.md": ["## Архитектурная схема"],
    "prompts.md": ["P1-01", "P1-02"],
}


def main():
    errors = []
    for name in REQUIRED:
        if not (BASE / name).is_file():
            errors.append(f"Missing: {name}")
    for name in ARTIFACTS:
        path = BASE / name
        if not path.is_file() or path.stat().st_size == 0:
            errors.append(f"Missing or empty: {name}")
    for name, markers in CONTAINS.items():
        path = BASE / name
        if not path.is_file():
            errors.append(f"Missing: {name}")
            continue
        text = path.read_text(encoding="utf-8")
        for marker in markers:
            if marker not in text:
                errors.append(f"{name}: missing marker {marker!r}")
    if errors:
        print("\n".join(errors))
        sys.exit(1)
    print("Practice 1 artifacts: OK")


if __name__ == "__main__":
    main()
