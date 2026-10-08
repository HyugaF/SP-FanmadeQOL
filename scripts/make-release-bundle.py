#!/usr/bin/env python3
"""
Creates Stronghold-Protocol-Release-Bundle.zip containing Stronghold-Protocol/ with:
- All source code & scripts (scripts/start-windows.bat, scripts/start.sh, server, shared, tools, data)
- Production node_modules (ws, pixi.js, pixi-spine, preact, htm, three)
- Complete downloaded art/audio/font assets (public/assets, public/fonts, public/vendor)
"""
import os
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT_ZIP = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "public" / "Stronghold-Protocol-v0.1.2-bundle.zip"
PREFIX = "Stronghold-Protocol"

SKIP_TOP = {
    ".git",
    ".cache",
    ".venv-extract",
    "test",
    "logs",
    "released",
}

SKIP_FILES = {
    "Stronghold-Protocol-Release-Bundle.zip",
    "Stronghold-Protocol-v0.1.2-bundle.zip",
    ".DS_Store",
}

PROD_PACKAGES = {
    "ws", "pixi.js", "pixi-spine", "preact", "htm", "three",
    "@pixi", "@pixi-spine", "@types", "call-bind-apply-helpers", "call-bound",
    "dunder-proto", "earcut", "es-define-property", "es-errors", "es-object-atoms",
    "eventemitter3", "function-bind", "get-intrinsic", "get-proto", "gopd",
    "has-symbols", "hasown", "ismobilejs", "math-intrinsics", "object-inspect",
    "punycode", "qs", "side-channel", "side-channel-list", "side-channel-map",
    "side-channel-weakmap", "url"
}

def should_skip(rel_parts):
    if not rel_parts:
        return False
    if rel_parts[0] in SKIP_TOP:
        return True
    if rel_parts[0] == "node_modules":
        if len(rel_parts) > 1 and rel_parts[1] not in PROD_PACKAGES:
            return True
        if ".cache" in rel_parts:
            return True
    for p in rel_parts:
        if p in SKIP_FILES or p.endswith("~") or p.endswith(".tmp") or p.endswith(".zip"):
            return True
    return False

def main():
    OUT_ZIP.parent.mkdir(parents=True, exist_ok=True)
    tmp_zip = OUT_ZIP.with_suffix(".zip.tmp")
    if tmp_zip.exists():
        tmp_zip.unlink()

    already_compressed = {
        ".png", ".jpg", ".jpeg", ".webp", ".avif", ".mp3", ".ogg", ".m4a",
        ".woff2", ".zip", ".gz"
    }

    count = 0
    total_bytes = 0
    print(f"Building release bundle -> {OUT_ZIP} ...")
    with zipfile.ZipFile(tmp_zip, "w", allowZip64=True) as zf:
        for dirpath, dirnames, filenames in os.walk(ROOT):
            rel_dir = Path(dirpath).relative_to(ROOT)
            rel_parts = rel_dir.parts
            dirnames[:] = [
                d for d in sorted(dirnames)
                if not should_skip(rel_parts + (d,))
            ]
            for fname in sorted(filenames):
                fparts = rel_parts + (fname,)
                if should_skip(fparts):
                    continue
                full_path = Path(dirpath) / fname
                if not full_path.is_file() or full_path.is_symlink():
                    continue
                ext = full_path.suffix.lower()
                compress_type = zipfile.ZIP_STORED if ext in already_compressed else zipfile.ZIP_DEFLATED
                arcname = "/".join((PREFIX,) + fparts)
                info = zipfile.ZipInfo.from_file(full_path, arcname)
                info.compress_type = compress_type
                # Ensure scripts/start.sh is executable on macOS/Linux
                if fparts == ("scripts", "start.sh") or ext in {".sh", ".mjs", ".py"}:
                    info.external_attr = (0o755 << 16)
                else:
                    info.external_attr = (0o644 << 16)
                with open(full_path, "rb") as src, zf.open(info, "w") as dst:
                    while True:
                        chunk = src.read(1024 * 1024)
                        if not chunk:
                            break
                        dst.write(chunk)
                count += 1
                total_bytes += full_path.stat().st_size
                if count % 500 == 0:
                    print(f"  packed {count} files ({total_bytes / 1048576:.1f} MB)...")

    tmp_zip.replace(OUT_ZIP)
    zip_size = OUT_ZIP.stat().st_size
    print(f"Done! Packed {count} files ({total_bytes / 1048576:.1f} MB raw -> {zip_size / 1048576:.1f} MB zip) at {OUT_ZIP}")

if __name__ == "__main__":
    main()
