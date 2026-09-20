"""Exercise the shipped helper on a PDF whose selected figure is bitmap-only."""

import json
import subprocess
import sys
import tempfile
from pathlib import Path

import pymupdf


root = Path(__file__).resolve().parents[1]
work = Path(tempfile.mkdtemp(prefix="pdf-image-region-audit-"))
pdf_path = work / "bitmap-figure.pdf"
doc = pymupdf.open()
page = doc.new_page(width=612, height=792)
image = pymupdf.Pixmap(pymupdf.csRGB, pymupdf.IRect(0, 0, 2400, 1200), False)
image.clear_with(255)
page.insert_image(pymupdf.Rect(80, 80, 480, 280), pixmap=image)
doc.save(pdf_path)
doc.close()

result = subprocess.run(
    [
        sys.executable,
        str(root / "content" / "helper" / "pdf_image_extract.py"),
        str(pdf_path),
        "--out-dir",
        str(work),
        "--report",
        str(work / "report.json"),
        "--raster-region",
        "0:0.147059,0.113636,0.637255,0.340909",
    ],
    capture_output=True,
    text=True,
    encoding="utf-8",
)
assert result.returncode == 0, result.stderr or result.stdout
report = json.loads((work / "report.json").read_text(encoding="utf-8"))
assert report["status"] == "ok", report
payload = report["raster"]
assert payload["format"] == "png", payload
assert payload["width"] > 2000 and payload["height"] > 900, payload
assert 0 < payload["byte_count"] <= 1536 * 1024, payload
assert Path(payload["file_path"]).read_bytes().startswith(b"\x89PNG\r\n\x1a\n")
print("bitmap region raster capture ok")

bitmap_vector_result = subprocess.run(
    [sys.executable, str(root / "content" / "helper" / "pdf_image_extract.py"),
     str(pdf_path), "--out-dir", str(work), "--report", str(work / "bitmap-vector-report.json"),
     "--vector-region", "0:0.147059,0.113636,0.637255,0.340909"],
    capture_output=True, text=True, encoding="utf-8",
)
assert bitmap_vector_result.returncode == 10, bitmap_vector_result.stderr or bitmap_vector_result.stdout
bitmap_vector_report = json.loads((work / "bitmap-vector-report.json").read_text(encoding="utf-8"))
assert bitmap_vector_report["status"] == "bitmap_only" and bitmap_vector_report["vector"] is None, bitmap_vector_report
print("bitmap region rejected by vector-only gate")

mixed_pdf = work / "mixed-figure.pdf"
doc = pymupdf.open()
page = doc.new_page(width=612, height=792)
page.insert_image(pymupdf.Rect(80, 80, 480, 280), pixmap=image)
page.draw_line((100, 120), (400, 210), color=(0, 0, 0), width=3)
doc.save(mixed_pdf)
doc.close()
mixed_result = subprocess.run(
    [sys.executable, str(root / "content" / "helper" / "pdf_image_extract.py"),
     str(mixed_pdf), "--out-dir", str(work), "--report", str(work / "mixed-report.json"),
     "--vector-region", "0:0.147059,0.113636,0.637255,0.340909"],
    capture_output=True, text=True, encoding="utf-8",
)
assert mixed_result.returncode == 10, mixed_result.stderr or mixed_result.stdout
mixed_report = json.loads((work / "mixed-report.json").read_text(encoding="utf-8"))
assert mixed_report["status"] == "mixed_raster" and mixed_report["vector"] is None, mixed_report
print("mixed raster/vector region rejected by vector-only gate")

vector_pdf = work / "vector-figure.pdf"
doc = pymupdf.open()
page = doc.new_page(width=612, height=792)
page.draw_line((100, 120), (400, 210), color=(0, 0, 0), width=3)
page.insert_text((120, 180), "Vector source", fontsize=18)
doc.save(vector_pdf)
doc.close()
vector_result = subprocess.run(
    [sys.executable, str(root / "content" / "helper" / "pdf_image_extract.py"),
     str(vector_pdf), "--out-dir", str(work), "--report", str(work / "vector-report.json"),
     "--vector-region", "0:0.147059,0.113636,0.735294,0.303030"],
    capture_output=True, text=True, encoding="utf-8",
)
assert vector_result.returncode == 0, vector_result.stderr or vector_result.stdout
vector_report = json.loads((work / "vector-report.json").read_text(encoding="utf-8"))
assert vector_report["vector"]["has_vector_content"] is True, vector_report
assert vector_report["vector"]["has_raster_content"] is False, vector_report
vector_svg = Path(vector_report["vector"]["file_path"]).read_text(encoding="utf-8")
assert "<path" in vector_svg and "<svg" in vector_svg and "<image" not in vector_svg
print("vector region SVG capture ok")
