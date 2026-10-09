"""A10 physical-device handoff. Prepopulate candidate SHAs only, never passed tests."""
from pathlib import Path
import argparse,json
from urllib.parse import urlsplit
ROOT=Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser();p.add_argument("--candidate",default="analysis10-test-output/a10-verified-preview.json")
p.add_argument("--url",default=None)
p.add_argument("--out",default="analysis10-test-output/a10-physical-worksheet.json")
args=p.parse_args()
r=json.loads((ROOT/args.candidate).read_text())
original=json.loads((ROOT/"analysis3/A9-PHYSICAL-DEVICE.template.json").read_text())
lock=json.loads((ROOT/"analysis3/a10-source-lock.json").read_text())
if r["sourceSha"]!=lock["sourceSha"] or r["offlineZipSha256"]!=lock["offlineZipSha256"]:
    raise ValueError("Cannot prepare device worksheet for unverified source")
if args.url:
    parts=urlsplit(args.url)
    if (parts.scheme!="https" or not parts.hostname or not parts.hostname.endswith(".vercel.app")
        or parts.path!="/" or parts.query or parts.fragment or parts.username or parts.password):
        raise ValueError("Physical worksheet preview URL must be the dedicated HTTPS Vercel preview root")
original["format"]="GomokuAnalysis3A10PhysicalHandoffWorksheet"
original["version"]=10
original["sourceSha"]=r["sourceSha"]
original["indexSha256"]=r["assets"]["index.html"]
original["serviceWorkerSha256"]=r["assets"]["sw.js"]
original["manifestSha256"]=r["assets"]["manifest.webmanifest"]
original["candidatePreviewUrl"]=args.url
original["instructions"]="UNVERIFIED: no physical test result is populated. Test the exact A10 HTTPS preview on actual Android Chrome, Samsung Internet and an installed standalone PWA; record every observation. A10 does not authorize production deployment."
for _,e in original["physicalEvidence"].items():
    e["sha"]=r["sourceSha"]
    e["artifactHash"]=r["assets"]["index.html"]
    e["testedUrl"]=args.url
    for c in e["testCases"]:
        c["status"]="not_tested"
        c["observation"]=None
out=ROOT/args.out;out.parent.mkdir(parents=True,exist_ok=True)
out.write_text(json.dumps(original,indent=2,ensure_ascii=False)+"\n")
print(f"PASS A10 untested device matrix generated: {len(original['physicalEvidence'])} device types / {sum(len(x['testCases']) for x in original['physicalEvidence'].values())} mandatory human-only checks")
