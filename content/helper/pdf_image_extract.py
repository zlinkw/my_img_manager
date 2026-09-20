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
# A crop smaller than roughly a tenth of an inch is not a figure, and exporting it as vector
# would only produce noise.
MIN_VECTOR_EDGE = 8
MAX_RASTER_BYTES = 1536 * 1024
MAX_RASTER_PIXELS = 16 * 1024 * 1024


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
    # Vector crop mode: "<page_index>:<nx0>,<ny0>,<nx1>,<ny1>" with the bbox normalized against
    # the page as displayed (top-left origin), which is exactly how the plugin stores a selection.
    parser.add_argument("--vector-region", default="")
    parser.add_argument("--raster-region", default="")
    parser.add_argument("--trace-image", action="store_true")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    started = time.perf_counter()
    args.out_dir.mkdir(parents=True, exist_ok=True)
    args.report.parent.mkdir(parents=True, exist_ok=True)

    try:
        # PyMuPDF deprecated the `fitz` name in favour of `pymupdf`; either import works, but the
        # new name is the one that will keep working.
        try:
            import pymupdf as fitz  # type: ignore
        except ImportError:
            import fitz  # type: ignore
    except ImportError as exc:
        write_report(
            args.report,
            {
                "schema_version": SCHEMA_VERSION,
                "status": "missing_pymupdf",
                "images": [],
                "warnings": [
                    "PyMuPDF n/a. Clip/auto still work."
                ],
                "error": str(exc),
                "elapsed_ms": elapsed_ms(started),
            },
        )
        return 20

    try:
        if args.trace_image:
            report = trace_image_as_svg(fitz, args, started)
        elif args.vector_region:
            report = export_region_vector(fitz, args, started)
        elif args.raster_region:
            report = export_region_raster(fitz, args, started)
        else:
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
                warnings.append(f"Stopped at max images: {args.max_images}")
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
                        f"Skip xref {xref} p{page_index + 1}: byte cap"
                    )
                    continue
                if total_bytes + image_byte_count > MAX_TOTAL_BYTES:
                    warnings.append("Stopped at total byte cap")
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


def parse_vector_region(value: str) -> tuple[int, list[float]]:
    """Split "<page_index>:<nx0>,<ny0>,<nx1>,<ny1>" into its parts."""
    text = str(value or "").strip()
    if ":" not in text:
        raise ValueError(f"Invalid vector region: {value}")
    page_text, bbox_text = text.split(":", 1)
    parts = [float(part) for part in bbox_text.split(",")]
    if len(parts) != 4:
        raise ValueError(f"Invalid vector bbox: {value}")
    return int(page_text), parts


def region_rect(page: Any, bbox: list[float]):
    """Map a normalized, top-left-origin bbox onto the page as it is displayed."""
    rect = page.rect
    return type(rect)(
        rect.x0 + bbox[0] * rect.width,
        rect.y0 + bbox[1] * rect.height,
        rect.x0 + bbox[2] * rect.width,
        rect.y0 + bbox[3] * rect.height,
    )


def export_region_vector(fitz: Any, args: argparse.Namespace, started: float) -> dict[str, Any]:
    """Export a selected region only when its SVG contains native vector geometry."""
    page_index, bbox = parse_vector_region(args.vector_region)
    pdf_path = args.pdf.resolve()
    if not pdf_path.exists():
        raise FileNotFoundError(f"PDF not found: {pdf_path}")

    doc = fitz.open(pdf_path)
    try:
        if page_index < 0 or page_index >= len(doc):
            raise ValueError(f"Page index out of range: {page_index}")
        page = doc[page_index]
        crop = region_rect(page, bbox)
        if page.rotation:
            # The cropbox lives in unrotated page coordinates; the user selected in the displayed
            # frame, so undo the page rotation before cropping.
            crop = crop * page.derotation_matrix
        if crop.width < MIN_VECTOR_EDGE or crop.height < MIN_VECTOR_EDGE:
            return {
                "schema_version": SCHEMA_VERSION,
                "status": "too_small",
                "vector": None,
                "warnings": [f"Region too small for vector export: {crop.width:.1f}x{crop.height:.1f} pt"],
                "elapsed_ms": elapsed_ms(started),
            }

        has_vector_content = any(
            fitz.Rect(drawing["rect"]).intersects(crop)
            for drawing in page.get_drawings()
        ) or any(
            block[6] == 0 and fitz.Rect(block[:4]).intersects(crop)
            for block in page.get_text("blocks")
        )
        page.set_cropbox(crop)
        doc.select([page_index])
        svg = doc[0].get_svg_image(text_as_path=True)
        payload = svg.encode("utf-8")
        if not payload:
            return {
                "schema_version": SCHEMA_VERSION,
                "status": "empty",
                "vector": None,
                "warnings": ["Vector export produced no content."],
                "elapsed_ms": elapsed_ms(started),
            }

        # An SVG wrapper around an embedded PDF bitmap still has fixed source pixels.
        # Never present that file, or a mixed bitmap/vector crop, as a pure vector image.
        has_raster_content = bool(re.search(r"<(?:[\w.-]+:)?image\b", svg, re.IGNORECASE))
        if not has_vector_content or has_raster_content:
            status = "mixed_raster" if has_vector_content else "bitmap_only"
            return {
                "schema_version": SCHEMA_VERSION,
                "status": status,
                "vector": None,
                "warnings": ["Selected PDF region does not contain pure vector content."],
                "elapsed_ms": elapsed_ms(started),
            }

        digest = hashlib.sha256(payload).hexdigest()
        file_name = f"vector-p{page_index + 1:04d}-{digest[:10]}.svg"
        output_path = args.out_dir / file_name
        output_path.write_bytes(payload)

        return {
            "schema_version": SCHEMA_VERSION,
            "status": "ok",
            "source_pdf": str(pdf_path),
            "attachment_key": args.attachment_key,
            "document_id": args.document_id,
            "page_count": len(doc),
            "vector": {
                "format": "svg",
                "file_path": str(output_path),
                "file_name": file_name,
                "page_index": page_index,
                "page_number": page_index + 1,
                "bbox_pdf": [round(crop.x0, 3), round(crop.y0, 3), round(crop.x1, 3), round(crop.y1, 3)],
                "width_pt": round(crop.width, 3),
                "height_pt": round(crop.height, 3),
                "byte_count": len(payload),
                "has_vector_content": has_vector_content,
                "has_raster_content": has_raster_content,
                "sha256": digest,
            },
            "warnings": [],
            "elapsed_ms": elapsed_ms(started),
        }
    finally:
        doc.close()


def export_region_raster(fitz: Any, args: argparse.Namespace, started: float) -> dict[str, Any]:
    """Render a bitmap-only PDF region at print resolution within the raster byte budget."""
    page_index, bbox = parse_vector_region(args.raster_region)
    pdf_path = args.pdf.resolve()
    if not pdf_path.exists():
        raise FileNotFoundError(f"PDF not found: {pdf_path}")

    doc = fitz.open(pdf_path)
    try:
        if page_index < 0 or page_index >= len(doc):
            raise ValueError(f"Page index out of range: {page_index}")
        page = doc[page_index]
        clip = region_rect(page, bbox)
        if clip.width < MIN_VECTOR_EDGE or clip.height < MIN_VECTOR_EDGE:
            return {"schema_version": SCHEMA_VERSION, "status": "too_small", "raster": None,
                    "warnings": ["Region too small for raster export."], "elapsed_ms": elapsed_ms(started)}

        scale = min(600 / 72, (MAX_RASTER_PIXELS / (clip.width * clip.height)) ** 0.5)
        for _ in range(16):
            pixmap = page.get_pixmap(matrix=fitz.Matrix(scale, scale), clip=clip, alpha=False)
            payload = pixmap.tobytes("png")
            if len(payload) <= MAX_RASTER_BYTES:
                digest = hashlib.sha256(payload).hexdigest()
                output_path = args.out_dir / f"raster-p{page_index + 1:04d}-{digest[:10]}.png"
                output_path.write_bytes(payload)
                return {
                    "schema_version": SCHEMA_VERSION,
                    "status": "ok",
                    "raster": {
                        "format": "png",
                        "file_path": str(output_path),
                        "page_index": page_index,
                        "width": pixmap.width,
                        "height": pixmap.height,
                        "byte_count": len(payload),
                        "sha256": digest,
                    },
                    "warnings": [],
                    "elapsed_ms": elapsed_ms(started),
                }
            scale *= min(0.85, (MAX_RASTER_BYTES / len(payload)) ** 0.5)
            if scale < 1:
                break
        return {"schema_version": SCHEMA_VERSION, "status": "too_large", "raster": None,
                "warnings": ["Region exceeds raster byte budget."], "elapsed_ms": elapsed_ms(started)}
    finally:
        doc.close()


def trace_image_as_svg(fitz: Any, args: argparse.Namespace, started: float) -> dict[str, Any]:
    """Approximate a stored original with editable SVG paths; never embed its pixels."""
    import vtracer  # type: ignore

    image_bytes = args.pdf.read_bytes()
    if not image_bytes:
        return {"schema_version": SCHEMA_VERSION, "status": "failed", "trace": None,
                "warnings": ["Source image is empty."], "elapsed_ms": elapsed_ms(started)}

    if image_bytes.startswith(b"\x89PNG\r\n\x1a\n"):
        image_format = "png"
    elif image_bytes.startswith(b"\xff\xd8\xff"):
        image_format = "jpg"
    elif image_bytes.startswith(b"RIFF") and image_bytes[8:12] == b"WEBP":
        image_format = "webp"
    elif image_bytes.startswith((b"GIF87a", b"GIF89a")):
        image_format = "gif"
    elif image_bytes.lstrip().startswith((b"<svg", b"<?xml")):
        image_format = "svg"
    else:
        return {"schema_version": SCHEMA_VERSION, "status": "unsupported", "trace": None,
                "warnings": ["Image type cannot be traced."], "elapsed_ms": elapsed_ms(started)}

    if image_format == "svg":
        document = fitz.open(stream=image_bytes, filetype="svg")
        try:
            # VTracer accepts raster bytes. Rendering here is a transient input, not the export.
            pixmap = document[0].get_pixmap(alpha=False)
            width, height = pixmap.width, pixmap.height
            image_bytes = pixmap.tobytes("png")
            image_format = "png"
        finally:
            document.close()
    else:
        # A raster document's page rectangle is measured in PDF points and may use the image's
        # embedded DPI. The trace paths use actual source pixels, so the viewBox must use those.
        pixmap = fitz.Pixmap(image_bytes)
        width, height = pixmap.width, pixmap.height
        if image_format == "gif":
            image_bytes = pixmap.tobytes("png")
            image_format = "png"
    if width < 16 or height < 16:
        return {"schema_version": SCHEMA_VERSION, "status": "failed", "trace": None,
                "warnings": ["Image dimensions are too small to trace."], "elapsed_ms": elapsed_ms(started)}

    # Keep every detected patch and use polygon boundaries to preserve fine shape geometry.
    # The approximate export is temporary; its size does not affect stored original images.
    svg = vtracer.convert_raw_image_to_svg(
        image_bytes, img_format=image_format, colormode="color", mode="polygon",
        filter_speckle=0, color_precision=8, layer_difference=1, path_precision=5,
    )
    payload = svg.encode("utf-8")
    path_count = len(re.findall(r"<path\b", svg))
    if not path_count or re.search(r"<(?:[\w.-]+:)?image\b", svg, re.IGNORECASE):
        return {"schema_version": SCHEMA_VERSION, "status": "failed", "trace": None,
                "warnings": ["Tracing did not produce path-only SVG."], "elapsed_ms": elapsed_ms(started)}

    digest = hashlib.sha256(payload).hexdigest()
    output_path = args.out_dir / f"approximate-vector-{digest[:10]}.svg"
    output_path.write_bytes(payload)
    return {"schema_version": SCHEMA_VERSION, "status": "ok",
            "trace": {"format": "svg", "file_path": str(output_path), "width": width,
                      "height": height, "byte_count": len(payload), "path_count": path_count,
                      "approximate": True, "quality": "shape", "sha256": digest},
            "warnings": [], "elapsed_ms": elapsed_ms(started)}


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
