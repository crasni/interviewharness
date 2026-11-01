"""Runs every problem's reference solution against its own tests.json.

    python scripts/check-references.py

Standard library only. Exits non-zero, naming each failing case, if any reference
gets a case wrong. CI runs it on every OS; the normal test run never needs Python.
"""

import importlib.util
import json
import sys
from pathlib import Path

# Keep the content folders clean: no __pycache__ beside the references.
sys.dont_write_bytecode = True

problems = Path(__file__).resolve().parent.parent / "content" / "problems"


def load_reference(folder: Path):
    spec = importlib.util.spec_from_file_location(f"reference_{folder.name.replace('-', '_')}", folder / "reference" / "solution.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def same(got, expected, unordered: bool) -> bool:
    # JSON has no tuples: compare a returned tuple as the list it would be written as.
    got = json.loads(json.dumps(got))
    if unordered and isinstance(got, list) and isinstance(expected, list):
        return sorted(got, key=json.dumps) == sorted(expected, key=json.dumps)
    return got == expected


def check(folder: Path) -> list[str]:
    tests = json.loads((folder / "tests.json").read_text(encoding="utf-8"))
    reference = load_reference(folder)
    unordered = tests.get("unordered", False)
    failures = []
    for case in tests["cases"]:
        try:
            got = getattr(reference, tests["function"])(**case["input"])
        except Exception as error:  # a crash is a failure of that case, not of the check
            failures.append(f"{folder.name} / {case['id']}: raised {error!r}")
            continue
        if not same(got, case["expected"], unordered):
            failures.append(f"{folder.name} / {case['id']}: expected {case['expected']!r}, got {got!r}")
    return failures


def main() -> int:
    folders = sorted(p for p in problems.iterdir() if p.is_dir())
    failures = [failure for folder in folders for failure in check(folder)]
    for failure in failures:
        print(failure)
    print(f"{len(folders)} problems checked, {len(failures)} failing cases.")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
