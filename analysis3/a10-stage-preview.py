"""A10: verify canonical A9 workflow artifact and stage byte-identical preview.
No network, no account credentials, no deployment, no production mutation.
"""
from pathlib import Path
import argparse,hashlib,json,shutil,stat,zipfile
ROOT=Path(__file__).resolve().parents[1]
LOCK=json.loads((ROOT/"analysis3/a10-source-lock.json").read_text())
ASSETS=("index.html","sw.js","manifest.webmanifest","icons/icon-192.png","icons/icon-512.png","icons/maskable-icon-512.png","icons/apple-touch-icon.png","icons/favicon-32.png")
ID="qa/build-identity.json"
def hash_bytes(v):return hashlib.sha256(v).hexdigest()
def stage(source,destination):
    source=Path(source);destination=Path(destination)
    receipt=source/"analysis9-test-output/rc9-candidate.json"
    zip_path=source/"analysis9-test-output"/LOCK["offlineZip"]
    if not receipt.is_file() or not zip_path.is_file():raise ValueError("Missing original A9 CI receipt or archive")
    if hash_bytes(zip_path.read_bytes())!=LOCK["offlineZipSha256"]:raise ValueError("Original A9 ZIP SHA-256 differs from pinned successful run")
    r=json.loads(receipt.read_text())
    if r.get("format")!="GomokuAnalysis3Candidate" or r.get("version")!=9 or r.get("sourceSha")!=LOCK["sourceSha"] or r.get("workflowRunId")!=LOCK["githubRunId"] or r.get("sourceBranch")!=LOCK["upstreamBranch"]:
        raise ValueError("A9 CI source/run identity mismatch")
    required={"sources","tactical","benchmark","reproducibility","browser","offline","package"}
    if set(r.get("stages",{}))!=required:raise ValueError("Original A9 required CI stages missing")
    for name in required:
        stage_row=r["stages"][name]
        if (stage_row.get("status")!="passed" or stage_row.get("sourceSha")!=LOCK["sourceSha"] or
          stage_row.get("workflowRunId")!=LOCK["githubRunId"] or
          stage_row.get("indexSha256")!=r["assets"]["index.html"]):
            raise ValueError("Original A9 evidence invalid: "+name)
    with zipfile.ZipFile(zip_path) as z:
        names=z.namelist()
        if len(names)!=9 or set(names)!={*ASSETS,ID}:raise ValueError("Unexpected packaged file set or duplicates")
        if z.testzip() is not None:raise ValueError("Damaged A9 archive")
        identity=json.loads(z.read(ID))
        if identity.get("sourceSha")!=LOCK["sourceSha"] or identity.get("assets")!=r["assets"]:
            raise ValueError("A9 packaged provenance does not match source receipt")
        content={}
        for n in ASSETS:
            info=z.getinfo(n)
            if info.filename.startswith("/") or ".." in Path(info.filename).parts or stat.S_IFMT(info.external_attr>>16)!=stat.S_IFREG:
                raise ValueError("Unsafe archive entry "+n)
            blob=z.read(n)
            if hash_bytes(blob)!=r["assets"].get(n):raise ValueError("A9 asset hash differs: "+n)
            content[n]=blob
    destination.mkdir(parents=True,exist_ok=True)
    for n,b in content.items():
        p=destination/n;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(b)
    result={"sourceSha":LOCK["sourceSha"],"githubRunId":LOCK["githubRunId"],
      "offlineZipSha256":LOCK["offlineZipSha256"],"assets":{n:hash_bytes(content[n]) for n in ASSETS},
      "origin":"A9 passed CI artifact, no rebuilt shell","destination":"A10 isolated preview"}
    output=ROOT/"analysis10-test-output"
    output.mkdir(exist_ok=True)
    (output/"a10-verified-preview.json").write_text(json.dumps(result,indent=2)+"\n")
    print(json.dumps({"status":"verified","sourceSha":result["sourceSha"],"assetCount":len(content),
      "zipSha256":result["offlineZipSha256"],"staging":str(destination)}))
if __name__=="__main__":
    p=argparse.ArgumentParser();p.add_argument("source");p.add_argument("destination")
    a=p.parse_args();stage(a.source,a.destination)
