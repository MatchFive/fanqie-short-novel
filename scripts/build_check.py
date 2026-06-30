"""
构建标记检查 — 比对前端源文件 hash，决定是否需要重新构建。

用法:
    python scripts/build_check.py check   # 检查需要重建则 exit 1
    python scripts/build_check.py update  # 构建成功后更新标记
"""
import hashlib
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
FRONTEND_SRC = PROJECT_ROOT / "frontend" / "src"
BUILD_HASH_FILE = PROJECT_ROOT / "frontend" / "dist" / ".build-hash"

# 纳入 hash 计算的文件类型
SOURCE_GLOBS = ["**/*.tsx", "**/*.ts", "**/*.css"]


def compute_source_hash() -> str:
    """计算 frontend/src/ 下所有源码文件的联合 SHA256"""
    files = []
    for pattern in SOURCE_GLOBS:
        files.extend(FRONTEND_SRC.glob(pattern))

    if not files:
        return ""

    hasher = hashlib.sha256()
    for fp in sorted(files, key=str):
        hasher.update(fp.read_bytes())
        # 把相对路径也纳入计算，避免重命名等纯位置变化被漏掉
        hasher.update(str(fp.relative_to(FRONTEND_SRC)).encode())

    return hasher.hexdigest()


def read_stored_hash() -> str | None:
    try:
        return BUILD_HASH_FILE.read_text().strip() or None
    except (OSError, FileNotFoundError):
        return None


def write_hash(hash_value: str) -> None:
    BUILD_HASH_FILE.parent.mkdir(parents=True, exist_ok=True)
    BUILD_HASH_FILE.write_text(hash_value)


def main() -> int:
    if len(sys.argv) < 2:
        print("[build_check] 用法: check | update")
        return 2

    mode = sys.argv[1]
    current = compute_source_hash()

    if mode == "update":
        write_hash(current)
        print(f"[build_check] OK 构建标记已写入: {current[:12]}...")
        return 0

    # mode == "check"
    stored = read_stored_hash()

    if not stored:
        print("[build_check] NEED_REBUILD 无构建标记，需要重新构建")
        return 1

    if current != stored:
        print(f"[build_check] NEED_REBUILD 源文件已变更，需要重新构建")
        print(f"  当前: {current[:12]}...")
        print(f"  已存: {stored[:12]}...")
        return 1

    print(f"[build_check] SKIP 源文件未变更，跳过构建 ({current[:12]}...)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
