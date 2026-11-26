"""Prepare source-tracked MSMED pilot from a locally obtained official PDF.
No publishing or automatic legal approval. Requires Poppler pdftotext.
"""
import argparse
import hashlib
import json
import re
import subprocess
from datetime import datetime, timezone
from pathlib import Path

URL = "https://www.indiacode.nic.in/bitstream/123456789/5872/1/a2006-27.pdf"
ALLOWED_URLS = ["https://upload.indiacode.nic.in/showfile?actid=AC_MH_166_1466_00019_00019_1683182806520&filename=msme_act_2006.pdf&type=actfile","https://www.indiacode.nic.in/bitstream/123456789/19412/1/msme_act_2006.pdf","https://www.indiacode.nic.in/bitstream/123456789/5872/1/a2006-27.pdf"]
ROOT = Path(__file__).resolve().parents[1]

def split_sections(pages):
    # Preserve original line content; remove only verified standalone page footer.
    lines = []
    for number, page in zip((9, 10, 11), pages, strict=True):
        content = page.splitlines()
        while content and not content[-1].strip():
            content.pop()
        if not content or content[-1].strip() != str(number):
            raise ValueError(f"Unexpected page footer on page {number}; inspect layout manually")
        lines.extend(content[:-1])
    starts = {}
    for i, line in enumerate(lines):
        match = re.match(r"^\s*(1[5-9]|2[0-5])\.\s*([A-Z].+)$", line)
        if match:
            n = int(match[1])
            if n in starts:
                raise ValueError(f"Ambiguous heading: {n}")
            starts[n] = i
    if list(starts) != list(range(15, 26)):
        raise ValueError(f"Unexpected provision boundaries: {list(starts)}")
    result = []
    for n in range(15, 25):
        group = lines[starts[n]:starts[n+1]]
        while group and not group[-1].strip():
            group.pop()
        # Derive heading from the printed heading before the em dash, including wrapped headings.
        joined = " ".join(line.strip() for line in group)
        heading = re.sub(r"^\d+\.\s*", "", joined).split("—", 1)
        if len(heading) != 2 or not heading[0].strip():
            raise ValueError(f"Could not locate heading separator in section {n}")
        result.append((n, heading[0].strip().rstrip("."), group))
    return result

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("pdf", type=Path)
    ap.add_argument("--source-url", choices=ALLOWED_URLS, default=URL)
    ap.add_argument("--output", type=Path, default=ROOT / ".rr-sources" / "msmed-act-2006")
    args = ap.parse_args()
    pdf = args.pdf.resolve()
    data = pdf.read_bytes()
    if not data.startswith(b"%PDF-"):
        raise ValueError("Input is not a PDF")
    # Check document identity and expected layout; source still needs human authentication.
    meta = subprocess.check_output(["pdftotext", "-f", "3", "-l", "3", "-layout", str(pdf), "-"], text=True, encoding="utf-8")
    identity = " ".join(meta.split())
    if "ACT NO. 27 OF 2006" not in identity or "ENTERPRISES DEVELOPMENT ACT, 2006" not in identity:
        raise ValueError("Unexpected Act identity")
    pages = [subprocess.check_output(["pdftotext", "-f", str(n), "-l", str(n), "-layout", str(pdf), "-"], text=True, encoding="utf-8").replace("\f","") for n in (9,10,11)]
    sections = split_sections(pages)
    out = args.output.resolve()
    if out.exists():
        raise FileExistsError(f"Refusing to overwrite {out}")
    if out == ROOT / "src" or ROOT / "src" in out.parents or out == ROOT / "public" or ROOT / "public" in out.parents:
        raise ValueError("Output must remain outside public site source")
    out.mkdir(parents=True)
    raw = "\f".join(pages)
    (out / "raw-pages.txt").write_text(raw, encoding="utf-8")
    normalized = []
    provisions = []
    for n, heading, group in sections:
        start = len(normalized)+1
        normalized.extend(group)
        end = len(normalized)
        # Commentary taken from the existing independent draft; final review required.
        article = ROOT / "src/content/articles/msmed" / f"msmed-act-section-{n}.md"
        body = article.read_text(encoding="utf-8").split("---",2)[2].split("## Editorial verification pending")[0].strip()
        commentary = re.sub(r"^## ", "", body, flags=re.M)
        page = "9" if n <= 17 else "10–11" if n == 21 else "10" if n <= 20 else "11"
        provisions.append({"slug":f"section-{n}","number":str(n),"kind":"section","heading":heading,"chapter":"chapter-v","commentary":commentary,"versions":[{"id":"recorded","sourceId":"india-code","startLine":start,"endLine":end,"pinpoint":f"Printed page(s) {page}, section {n}"}]})
    (out / "source.txt").write_text("\n".join(normalized)+"\n",encoding="utf-8")
    captured = datetime.now(timezone.utc).date().isoformat()
    manifest = {"slug":"msmed-act-2006","title":"Micro, Small and Medium Enterprises Development Act, 2006","shortTitle":"MSMED Act, 2006","actNumber":"27 of 2006","year":2006,"jurisdiction":"India","areas":["msme-law","commercial-law","arbitration"],"mainSourceId":"india-code","sources":[{"id":"india-code","title":"India Code — MSMED Act 2006","url":args.source_url,"file":"source.txt","capturedAt":captured}],"chapters":[{"slug":"chapter-v","label":"Chapter V","title":"Delayed payments to micro and small enterprises"}],"provisions":provisions,"amendments":[]}
    (out / "manifest.json").write_text(json.dumps(manifest,indent=2,ensure_ascii=False)+"\n", encoding="utf-8")
    (out / "pdf-provenance.json").write_text(json.dumps({"sourceUrl":args.source_url,"pdfSha256":hashlib.sha256(data).hexdigest(),"byteLength":len(data),"processedAt":captured,"pages":[9,10,11],"note":"Local file identity only; official authenticity, text accuracy, amendments and legal review pending. Extracted text retains layout and section headings. No effective dates inferred."},indent=2)+"\n",encoding="utf-8")
    subprocess.run(["node",str(ROOT/"scripts/import-statute.mjs"),str(out/"manifest.json")],cwd=ROOT,check=True)
    print("MSMED draft package prepared; no publication performed.")

if __name__ == "__main__":
    main()
