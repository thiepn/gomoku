"""A9 portable PWA distribution: fixed asset set, reproducible ZIP, exact verification.
Never deploys, uploads, executes arbitrary archive files, or edits game databases.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import pathlib
import stat
import zipfile

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / "analysis9-test-output"
CANDIDATE = OUT / "rc9-candidate.json"
PACKAGE = OUT / "gomoku-analysis3-a9-offline-candidate.zip"
ASSETS = (
    "index.html", "sw.js", "manifest.webmanifest",
    "icons/icon-192.png", "icons/icon-512.png", "icons/maskable-icon-512.png",
    "icons/apple-touch-icon.png", "icons/favicon-32.png",
)
IDENTITY = "qa/build-identity.json"
DATE = (1980, 1, 1, 0, 0, 0)

def checksum(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()

def candidate() -> dict:
    data = json.loads(CANDIDATE.read_text(encoding="utf-8"))
    if data.get("format") != "GomokuAnalysis3Candidate" or data.get("version") != 9:
        raise ValueError("Unknown candidate identity format")
    if len(data.get("sourceSha", "")) != 40:
        raise ValueError("Missing source commit identity")
    for name in ASSETS:
        if not (ROOT / name).is_file():
            raise ValueError(f"Missing offline file: {name}")
        if checksum((ROOT / name).read_bytes()) != data["assets"].get(name):
            raise ValueError(f"Candidate bytes changed: {name}")
    return data

def make_identity(c: dict) -> bytes:
    identity = {
        "format": "GomokuAnalysis3OfflineArtifact",
        "version": 9,
        "sourceSha": c["sourceSha"],
        "cacheVersion": c["cacheVersion"],
        "assets": {n: c["assets"][n] for n in ASSETS},
        "notice": "A9 candidate only. Physical Android approval and production rollout are NOT completed."
    }
    return (json.dumps(identity, indent=2, sort_keys=True, ensure_ascii=False) + "\n").encode()

def write():
    c = candidate()
    OUT.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(PACKAGE, mode="w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as bundle:
        for name in sorted(ASSETS):
            zi = zipfile.ZipInfo(name, DATE)
            zi.compress_type = zipfile.ZIP_DEFLATED
            zi.external_attr = (stat.S_IFREG | 0o644) << 16
            bundle.writestr(zi, (ROOT / name).read_bytes(), compress_type=zipfile.ZIP_DEFLATED, compresslevel=9)
        zi = zipfile.ZipInfo(IDENTITY, DATE)
        zi.compress_type = zipfile.ZIP_DEFLATED
        zi.external_attr = (stat.S_IFREG | 0o644) << 16
        bundle.writestr(zi, make_identity(c), compress_type=zipfile.ZIP_DEFLATED, compresslevel=9)
    verify()
    print(json.dumps({"package": str(PACKAGE), "sha256": checksum(PACKAGE.read_bytes()),
        "files": len(ASSETS) + 1, "sourceSha": c["sourceSha"]}, indent=2))

def verify():
    c = candidate()
    with zipfile.ZipFile(PACKAGE, "r") as archive:
        entries = archive.infolist()
        names = [x.filename for x in entries]
        expected = sorted([*ASSETS, IDENTITY])
        if sorted(names) != expected or len(names) != len(expected):
            raise ValueError("Package contains missing, extra, or duplicate files")
        if archive.testzip() is not None:
            raise ValueError("Damaged ZIP member")
        for info in entries:
            if info.filename.startswith("/") or ".." in pathlib.PurePosixPath(info.filename).parts:
                raise ValueError("Unsafe path in candidate ZIP")
            if stat.S_IFMT(info.external_attr >> 16) != stat.S_IFREG:
                raise ValueError("Unexpected symbolic link or nonregular package entry")
        for name in ASSETS:
            if checksum(archive.read(name)) != c["assets"][name]:
                raise ValueError(f"Corrupted packaged asset: {name}")
        if archive.read(IDENTITY) != make_identity(c):
            raise ValueError("Packaged source identity does not match candidate")
    print("PASS A9 deterministic package: all eight assets, source identity, checksums, and paths")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("action", choices=["create", "verify"])
    args = parser.parse_args()
    (write if args.action == "create" else verify)()
