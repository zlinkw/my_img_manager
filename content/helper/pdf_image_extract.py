#!/usr/bin/env python3
"""Optional helper: extract original embedded image bytes from a PDF."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
import time
import traceback
from dataclasses import dataclass
from pathlib import Path
from typing import Any


SCHEMA_VERSION = "zotero-pdf-image-saver/v1"
MIN_PIXEL_EDGE = 16
MAX_IMAGE_BYTES = 25 * 1024 * 1024
MAX_TOTAL_BYTES = 150 * 1024 * 1024


@dataclass(frozen=True)
class Rect:
    x0: float
    y0: float
    x1: float
    y1: float

    @property
    def width(self) -> float:
        return max(0.0, self.x1 - self.x0)

    @property
    def height(self) -> float:
        return max(0.0, self.y1 - self.y0)

    @property
    def area(self) -> float:
        return self.width * self.height


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("pdf", type=Path)
    parser.add_argument("--out-dir", type=Path, required=True)
    parser.add_argument("--report", type=Path, required=True)
    parser.add_argument("--page-index", type=int)
    parser.add_argument("--min-area", type=float, default=0.004)
    parser.add_argument("--max-images", type=int, default=80)
    parser.add_argument("--attachment-key", default="")
    parser.add_argument("--document-id", default="")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    started = time.perf_counter()
    args.out_dir.mkdir(parents=True, exist_ok=True)
    args.report.parent.mkdir(parents=True, exist_ok=True)

    try:
        import fitz  # type: ignore
    except ImportError as exc:
        write_report(
            args.report,
            {
                "schema_version": SCHEMA_VERSION,
                "status": "missing_pymupdf",
                "images": [],
                "warnings": [
                    "Optional PyMuPDF helper unavailable. Default reader preview mode still works."
                ],
                "error": str(exc),
                "elapsed_ms": elapsed_ms(started),
            },
        )
        return 20

    try:
        report = extract_images(fitz, args, started)
        write_report(args.report, report)
        return 0 if report["status"] == "ok" else 10
    except Exception as exc:
        write_report(
            args.report,
            {
                "schema_version": SCHEMA_VERSION,
                "status": "failed",
                "images": [],
                "warnings": [],
                "error": str(exc),
                "traceback": traceback.format_exc(limit=8),
                "elapsed_ms": elapsed_ms(started),
            },
        )
        return 11


def extract_images(fitz: Any, args: argparse.Namespace, started: float) -> dict[str, Any]:
    pdf_path = args.pdf.resolve()
    if not pdf_path.exists():
        raise FileNotFoundError(f"PDF not found: {pdf_path}")

    doc = fitz.open(pdf_path)
    try:
        page_indexes = resolve_page_indexes(doc, args.page_index)
        images: list[dict[str, Any]] = []
        warnings: list[str] = []
        seen_occurrences: set[str] = set()
        total_bytes = 0

        for page_index in page_indexes:
            if len(images) >= args.max_images:
                warnings.append(f"Stopped after max image count: {args.max_images}")
                break
            page = doc[page_index]
            page_rect = Rect(
                float(page.rect.x0),
                float(page.rect.y0),
                float(page.rect.x1),
                float(page.rect.y1),
            )
            page_area = max(1.0, page_rect.area)
            for occurrence, image_info in enumerate(get_page_image_infos(page)):
                if len(images) >= args.max_images:
                    break
                xref = int(image_info.get("xref") or 0)
                bbox_raw = image_info.get("bbox")
                if xref <= 0 or not bbox_raw:
                    continue
                bbox = coerce_rect(bbox_raw)
                if bbox.area / page_area < args.min_area:
                    continue
                key = f"{page_index}:{xref}:{round(bbox.x0, 2)}:{round(bbox.y0, 2)}:{round(bbox.x1, 2)}:{round(bbox.y1, 2)}"
                if key in seen_occurrences:
                    continue
                seen_occurrences.add(key)

                extracted = doc.extract_image(xref)
                image_bytes = extracted.get("image")
                if not image_bytes:
                    continue
                image_byte_count = len(image_bytes)
                if image_byte_count > MAX_IMAGE_BYTES:
                    warnings.append(
                        f"Skipped xref {xref} on page {page_index + 1}: image exceeds byte cap"
                    )
                    continue
                if total_bytes + image_byte_count > MAX_TOTAL_BYTES:
                    warnings.append("Stopped before exceeding total helper byte cap")
                    break
                width = int(extracted.get("width") or image_info.get("width") or 0)
                height = int(extracted.get("height") or image_info.get("height") or 0)
                if width < MIN_PIXEL_EDGE or height < MIN_PIXEL_EDGE:
                    continue

                ext = clean_extension(extracted.get("ext") or "bin")
                digest = hashlib.sha256(image_bytes).hexdigest()
                image_id = f"p{page_index + 1:04d}-xref{xref}-occ{occurrence + 1:02d}-{digest[:10]}"
                file_name = f"{image_id}.{ext}"
                output_path = args.out_dir / file_name
                output_path.write_bytes(image_bytes)
                total_bytes += image_byte_count
                images.append(
                    {
                        "id": image_id,
                        "source": "embedded_image",
                        "file_path": str(output_path),
                        "file_name": file_name,
                        "page_index": page_index,
                        "page_number": page_index + 1,
                        "xref": xref,
                        "occurrence": occurrence + 1,
                        "bbox_pdf": rect_to_list(bbox),
                        "bbox_normalized": normalize_rect(bbox, page_rect),
                        "width": width,
                        "height": height,
                        "extension": ext,
                        "content_type": content_type_for_ext(ext),
                        "byte_count": image_byte_count,
                        "sha256": digest,
                        "colorspace": extracted.get("colorspace"),
                        "bpc": extracted.get("bpc"),
                    }
                )

        return {
            "schema_version": SCHEMA_VERSION,
            "status": "ok",
            "source_pdf": str(pdf_path),
            "attachment_key": args.attachment_key,
            "document_id": args.document_id,
            "request": {
                "page_index": args.page_index,
                "min_area": args.min_area,
                "max_images": args.max_images,
            },
            "page_count": len(doc),
            "images": images,
            "total_image_bytes": total_bytes,
            "warnings": warnings,
            "elapsed_ms": elapsed_ms(started),
        }
    finally:
        doc.close()


def resolve_page_indexes(doc: Any, requested_page: int | None) -> list[int]:
    if requested_page is None:
        return list(range(len(doc)))
    if requested_page < 0 or requested_page >= len(doc):
        raise ValueError(f"Page index out of range: {requested_page}")
    return [requested_page]


def get_page_image_infos(page: Any) -> list[dict[str, Any]]:
    try:
        infos = page.get_image_info(xrefs=True)
    except TypeError:
        infos = page.get_image_info()
    if infos:
        return [dict(info) for info in infos]

    fallback: list[dict[str, Any]] = []
    for image in page.get_images(full=True):
        xref = int(image[0])
        for rect in page.get_image_rects(xref):
            fallback.append(
                {
                    "xref": xref,
                    "bbox": [rect.x0, rect.y0, rect.x1, rect.y1],
                    "width": int(image[2] or 0),
                    "height": int(image[3] or 0),
                }
            )
    return fallback


def coerce_rect(value: Any) -> Rect:
    parts = [float(part) for part in value]
    if len(parts) != 4:
        raise ValueError(f"Invalid bbox: {value}")
    x0, y0, x1, y1 = parts
    return Rect(min(x0, x1), min(y0, y1), max(x0, x1), max(y0, y1))


def normalize_rect(rect: Rect, page_rect: Rect) -> list[float]:
    page_width = max(1.0, page_rect.width)
    page_height = max(1.0, page_rect.height)
    return [
        round((rect.x0 - page_rect.x0) / page_width, 6),
        round((rect.y0 - page_rect.y0) / page_height, 6),
        round((rect.x1 - page_rect.x0) / page_width, 6),
        round((rect.y1 - page_rect.y0) / page_height, 6),
    ]


def rect_to_list(rect: Rect) -> list[float]:
    return [round(rect.x0, 3), round(rect.y0, 3), round(rect.x1, 3), round(rect.y1, 3)]


def clean_extension(value: str) -> str:
    ext = re.sub(r"[^a-z0-9]+", "", value.lower())
    return ext or "bin"


def content_type_for_ext(ext: str) -> str:
    return {
        "png": "image/png",
        "jpg": "image/jpeg",
        "jpeg": "image/jpeg",
        "jpx": "image/jp2",
        "jp2": "image/jp2",
        "webp": "image/webp",
        "tif": "image/tiff",
        "tiff": "image/tiff",
        "bmp": "image/bmp",
    }.get(ext, "application/octet-stream")


def elapsed_ms(started: float) -> float:
    return round((time.perf_counter() - started) * 1000, 2)


def write_report(path: Path, report: dict[str, Any]) -> None:
    path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")


if __name__ == "__main__":
    raise SystemExit(main())
