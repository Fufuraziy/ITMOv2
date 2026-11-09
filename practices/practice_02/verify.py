"""Cross-platform artifact check for practice 2 (replaces POSIX-shell recipe)."""

import sys
from pathlib import Path

BASE = Path(__file__).resolve().parent

REQUIRED = ["README.md", "prompts.md", "slides/practice_02.pptx"]
EXPERIMENTS = [
    "few_shot/experiment.md",
    "rctf/experiment.md",
    "chain_of_verification/experiment.md",
    "tree_of_thoughts/experiment.md",
    "rag/experiment.md",
    "react/experiment.md",
]
PROMPT_MARKERS = [
    "Few-shot", "R.C.T.F.", "Chain of Verification",
    "Tree of Thoughts", "RAG", "ReAct",
]


def main():
    errors = []
    for name in REQUIRED:
        if not (BASE / name).is_file():
            errors.append(f"Missing: {name}")
    for name in EXPERIMENTS:
        path = BASE / name
        if not path.is_file() or path.stat().st_size == 0:
            errors.append(f"Missing or empty: {name}")
    prompts = BASE / "prompts.md"
    if prompts.is_file():
        text = prompts.read_text(encoding="utf-8")
        for marker in PROMPT_MARKERS:
            if marker not in text:
                errors.append(f"prompts.md: missing marker {marker!r}")
    if errors:
        print("\n".join(errors))
        sys.exit(1)
    print("Practice 2 artifacts: OK")


if __name__ == "__main__":
    main()
