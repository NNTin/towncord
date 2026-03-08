#!/usr/bin/env python3
"""Export debug runtime assets from grouped .aseprite sources.

Debug tilesets are authored as animated 4x4 sheet frames where each sheet frame
contains marching-square cases in row-major order:
0..3 / 4..7 / 8..11 / 12..15.

The exporter slices each sheet frame into 16 tiles and writes atlas frames as:
- <animation_id>#<tile_index>@<phase_index> (animated frames)
- <animation_id>#<tile_index>            (phase-0 alias for compatibility)
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import tempfile
from collections import OrderedDict
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from PIL import Image


SCRIPT_DIR = Path(__file__).resolve().parent
PACKAGE_ROOT = SCRIPT_DIR.parent

NAMESPACE = "debug"
CATEGORY_ORDER = ["tilesets"]
CATEGORY_ATLAS_KEY = {
    "tilesets": "debug.tilesets",
}
SOURCE_CATEGORY_MAP = {
    "environment": "tilesets",
    "tilesets": "tilesets",
}

TILE_COLUMNS = 4
TILE_ROWS = 4
TILE_COUNT = TILE_COLUMNS * TILE_ROWS


@dataclass(frozen=True)
class ExtractedFrame:
    animation_id: str
    atlas_category: str
    atlas_key: str
    frame_name: str
    width: int
    height: int
    duration_ms: int
    source_png: Path


@dataclass
class AtlasPlacement:
    frame: ExtractedFrame
    x: int
    y: int


@dataclass
class AnimationBuild:
    atlas_key: str
    frame_names: list[str]


@dataclass
class PreviewBuild:
    animation_id: str
    frame_paths: list[Path]
    durations_ms: list[int]


def package_relative(path_value: str) -> str:
    return str((PACKAGE_ROOT / path_value).resolve())


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Export Phaser atlas/runtime manifests from packages/debug-assets/aseprite "
            "and optionally write GIF previews and sliced tile frame sequences."
        ),
    )
    parser.add_argument(
        "--aseprite-root",
        default=package_relative("./aseprite"),
        help="Directory containing grouped .aseprite sources.",
    )
    parser.add_argument(
        "--public-root",
        default=package_relative("../../apps/frontend/public/assets/debug"),
        help="Runtime output root for Phaser files (pack/manifest/animations/atlases).",
    )
    parser.add_argument(
        "--frames-root",
        default=package_relative("./frames"),
        help="Output root for sliced case frame sequences (when --write-frames).",
    )
    parser.add_argument(
        "--previews-root",
        default=package_relative("./previews"),
        help="Output root for full-sheet GIF previews (when --write-previews).",
    )
    parser.add_argument(
        "--aseprite-bin",
        default="aseprite",
        help="Aseprite binary name or full path.",
    )
    parser.add_argument(
        "--extract-script",
        default=package_relative("./pipeline/extract_group_frames.lua"),
        help="Lua extraction script path.",
    )
    parser.add_argument(
        "--max-atlas-width",
        type=int,
        default=2048,
        help="Maximum atlas width before wrapping to a new row.",
    )
    parser.add_argument(
        "--border-padding",
        type=int,
        default=2,
        help="Border padding around atlas content in pixels.",
    )
    parser.add_argument(
        "--shape-padding",
        type=int,
        default=2,
        help="Padding between frames in atlas packing.",
    )
    parser.add_argument(
        "--write-frames",
        action="store_true",
        help="Write sliced case frame PNG sequences.",
    )
    parser.add_argument(
        "--write-previews",
        action="store_true",
        help="Write full-sheet animated GIF previews.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Analyze and validate without writing destination outputs.",
    )
    return parser.parse_args()


def read_json(path: Path) -> Any:
    with path.open("r", encoding="utf8") as handle:
        return json.load(handle)


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf8") as handle:
        json.dump(payload, handle, indent=2)
        handle.write("\n")


def discover_grouped_sources(aseprite_root: Path) -> list[Path]:
    files = sorted(aseprite_root.rglob("*.aseprite"))
    if not files:
        raise RuntimeError(f"No .aseprite files found under {aseprite_root}")
    return files


def resolve_aseprite_binary(preferred: str) -> str:
    resolved = shutil.which(preferred)
    if resolved:
        return resolved

    candidate = Path(preferred)
    if candidate.exists() and candidate.is_file():
        return str(candidate)

    fallback = Path("/home/nntin/git/aseprite/build/bin/aseprite")
    if fallback.exists() and fallback.is_file():
        return str(fallback)

    raise RuntimeError(f'Could not resolve Aseprite binary from "{preferred}"')


def map_source_category(relative_path: Path) -> str:
    if not relative_path.parts:
        raise RuntimeError(f"Invalid grouped source path: {relative_path}")

    source_category = relative_path.parts[0]
    category = SOURCE_CATEGORY_MAP.get(source_category)
    if not category:
        raise RuntimeError(
            f'Unhandled source category "{source_category}" in {relative_path}'
        )
    return category


def run_group_extraction(
    aseprite_bin: str,
    extract_script: Path,
    source_file: Path,
    output_dir: Path,
    manifest_path: Path,
) -> dict[str, Any]:
    output_dir.mkdir(parents=True, exist_ok=True)

    command = [
        aseprite_bin,
        "-b",
        str(source_file),
        "--script-param",
        f"output_dir={output_dir}",
        "--script-param",
        f"manifest={manifest_path}",
        "--script",
        str(extract_script),
    ]

    try:
        subprocess.run(command, check=True, capture_output=True, text=True)
    except subprocess.CalledProcessError as exc:
        stderr = (exc.stderr or "").strip()
        raise RuntimeError(
            f"Aseprite extraction failed for {source_file}"
            + (f": {stderr}" if stderr else "")
        ) from exc

    if not manifest_path.exists():
        raise RuntimeError(f"Missing extraction manifest for {source_file}: {manifest_path}")

    return read_json(manifest_path)


def safe_name(value: str) -> str:
    return re.sub(r"[^a-zA-Z0-9_.-]+", "_", value)


def slice_sheet_frame(
    source_png: Path,
    destination_dir: Path,
    animation_id: str,
    phase_index: int,
) -> tuple[int, int, list[Path]]:
    with Image.open(source_png) as raw:
        sheet = raw.convert("RGBA")

        if sheet.width % TILE_COLUMNS != 0 or sheet.height % TILE_ROWS != 0:
            raise RuntimeError(
                f"Sheet frame for {animation_id} has invalid size {sheet.width}x{sheet.height}; "
                f"expected width/height divisible by {TILE_COLUMNS}x{TILE_ROWS}."
            )

        tile_width = sheet.width // TILE_COLUMNS
        tile_height = sheet.height // TILE_ROWS

        if tile_width < 1 or tile_height < 1:
            raise RuntimeError(
                f"Sheet frame for {animation_id} produced invalid tile size {tile_width}x{tile_height}."
            )

        destination_dir.mkdir(parents=True, exist_ok=True)
        outputs: list[Path] = []
        safe_animation = safe_name(animation_id)

        for tile_index in range(TILE_COUNT):
            col = tile_index % TILE_COLUMNS
            row = tile_index // TILE_COLUMNS
            left = col * tile_width
            top = row * tile_height
            right = left + tile_width
            bottom = top + tile_height

            tile = sheet.crop((left, top, right, bottom))
            output_path = (
                destination_dir
                / f"{safe_animation}__tile-{tile_index:02d}__phase-{phase_index:03d}.png"
            )
            tile.save(output_path)
            outputs.append(output_path)

    return tile_width, tile_height, outputs


def build_extracted_frames(
    aseprite_root: Path,
    grouped_sources: list[Path],
    aseprite_bin: str,
    extract_script: Path,
    temp_root: Path,
) -> tuple[
    dict[str, list[ExtractedFrame]],
    dict[str, AnimationBuild],
    dict[str, PreviewBuild],
    dict[str, dict[int, list[Path]]],
]:
    frames_by_category: dict[str, list[ExtractedFrame]] = {
        category: [] for category in CATEGORY_ORDER
    }
    animations: dict[str, AnimationBuild] = {}
    previews: dict[str, PreviewBuild] = {}
    case_phase_frames: dict[str, dict[int, list[Path]]] = {}

    for source_file in grouped_sources:
        relative_source = source_file.relative_to(aseprite_root)
        atlas_category = map_source_category(relative_source)
        atlas_key = CATEGORY_ATLAS_KEY[atlas_category]

        source_stem = str(relative_source.with_suffix(""))
        safe_stem = source_stem.replace("/", "__")
        extract_dir = temp_root / safe_stem
        manifest_path = extract_dir / "manifest.json"

        manifest = run_group_extraction(
            aseprite_bin=aseprite_bin,
            extract_script=extract_script,
            source_file=source_file,
            output_dir=extract_dir,
            manifest_path=manifest_path,
        )

        tags = manifest.get("tags")
        if not isinstance(tags, list):
            raise RuntimeError(f"Invalid tags[] in extraction manifest for {source_file}")

        for tag in tags:
            animation_id = tag.get("name")
            tag_frames = tag.get("frames")

            if not isinstance(animation_id, str) or not isinstance(tag_frames, list):
                raise RuntimeError(f"Invalid tag entry in extraction manifest for {source_file}")

            if animation_id in animations:
                raise RuntimeError(f"Duplicate animation id across grouped sources: {animation_id}")

            animation_build = AnimationBuild(atlas_key=atlas_key, frame_names=[])
            preview_build = PreviewBuild(animation_id=animation_id, frame_paths=[], durations_ms=[])
            by_case: dict[int, list[Path]] = {index: [] for index in range(TILE_COUNT)}

            expected_tile_size: tuple[int, int] | None = None

            for phase_index, frame in enumerate(tag_frames):
                frame_file = frame.get("file")
                duration = frame.get("duration", 100)

                if not isinstance(frame_file, str):
                    raise RuntimeError(
                        f"Invalid frame file for animation {animation_id} in {source_file}"
                    )
                if not isinstance(duration, int) or duration < 1:
                    duration = 100

                source_png = extract_dir / frame_file
                if not source_png.exists():
                    raise RuntimeError(
                        f"Missing extracted frame for animation {animation_id}: {source_png}"
                    )

                tile_dir = extract_dir / "sliced"
                tile_width, tile_height, tile_paths = slice_sheet_frame(
                    source_png=source_png,
                    destination_dir=tile_dir,
                    animation_id=animation_id,
                    phase_index=phase_index,
                )

                size_tuple = (tile_width, tile_height)
                if expected_tile_size is None:
                    expected_tile_size = size_tuple
                elif expected_tile_size != size_tuple:
                    raise RuntimeError(
                        f"Inconsistent tile size across phases for {animation_id}: "
                        f"expected {expected_tile_size[0]}x{expected_tile_size[1]}, "
                        f"got {tile_width}x{tile_height}"
                    )

                preview_build.frame_paths.append(source_png)
                preview_build.durations_ms.append(duration)

                for tile_index, tile_path in enumerate(tile_paths):
                    by_case[tile_index].append(tile_path)

                    base_name = f"{animation_id}#{tile_index}"
                    phase_name = f"{base_name}@{phase_index}"

                    frames_by_category[atlas_category].append(
                        ExtractedFrame(
                            animation_id=animation_id,
                            atlas_category=atlas_category,
                            atlas_key=atlas_key,
                            frame_name=phase_name,
                            width=tile_width,
                            height=tile_height,
                            duration_ms=duration,
                            source_png=tile_path,
                        )
                    )

                    if phase_index == 0:
                        # Alias preserves existing case mapping contract without phase suffix.
                        frames_by_category[atlas_category].append(
                            ExtractedFrame(
                                animation_id=animation_id,
                                atlas_category=atlas_category,
                                atlas_key=atlas_key,
                                frame_name=base_name,
                                width=tile_width,
                                height=tile_height,
                                duration_ms=duration,
                                source_png=tile_path,
                            )
                        )
                        animation_build.frame_names.append(base_name)

            if len(animation_build.frame_names) != TILE_COUNT:
                raise RuntimeError(
                    f"Animation {animation_id} did not produce exactly {TILE_COUNT} base tiles. "
                    f"Got {len(animation_build.frame_names)}"
                )

            animations[animation_id] = animation_build
            previews[animation_id] = preview_build
            case_phase_frames[animation_id] = by_case

    return frames_by_category, animations, previews, case_phase_frames


def pack_category_frames(
    frames: list[ExtractedFrame],
    max_width: int,
    border_padding: int,
    shape_padding: int,
) -> tuple[int, int, list[AtlasPlacement]]:
    if not frames:
        return border_padding * 2, border_padding * 2, []

    max_frame_width = max(frame.width for frame in frames)
    effective_max_width = max(max_width, max_frame_width + (border_padding * 2))

    x = border_padding
    y = border_padding
    row_height = 0
    atlas_width = border_padding * 2
    placements: list[AtlasPlacement] = []

    for frame in frames:
        if x > border_padding and x + frame.width + border_padding > effective_max_width:
            x = border_padding
            y += row_height + shape_padding
            row_height = 0

        placements.append(AtlasPlacement(frame=frame, x=x, y=y))

        right_edge = x + frame.width
        atlas_width = max(atlas_width, right_edge + border_padding)
        x += frame.width + shape_padding
        row_height = max(row_height, frame.height)

    atlas_height = y + row_height + border_padding
    return atlas_width, atlas_height, placements


def write_atlas_png_and_json(
    placements: list[AtlasPlacement],
    atlas_size: tuple[int, int],
    atlas_image_path: Path,
    atlas_json_path: Path,
) -> None:
    atlas_width, atlas_height = atlas_size
    atlas_image = Image.new("RGBA", (atlas_width, atlas_height), (0, 0, 0, 0))
    frames_json: OrderedDict[str, dict[str, Any]] = OrderedDict()

    for placement in placements:
        with Image.open(placement.frame.source_png) as raw:
            frame_image = raw.convert("RGBA")
            atlas_image.paste(frame_image, (placement.x, placement.y))

        frame_name = placement.frame.frame_name
        frame_w = placement.frame.width
        frame_h = placement.frame.height

        frames_json[frame_name] = {
            "frame": {
                "x": placement.x,
                "y": placement.y,
                "w": frame_w,
                "h": frame_h,
            },
            "rotated": False,
            "trimmed": False,
            "spriteSourceSize": {
                "x": 0,
                "y": 0,
                "w": frame_w,
                "h": frame_h,
            },
            "sourceSize": {
                "w": frame_w,
                "h": frame_h,
            },
        }

    atlas_image_path.parent.mkdir(parents=True, exist_ok=True)
    atlas_json_path.parent.mkdir(parents=True, exist_ok=True)

    atlas_image.save(atlas_image_path)
    write_json(
        atlas_json_path,
        {
            "frames": frames_json,
            "meta": {
                "app": "towncord-debug-aseprite-pipeline",
                "version": "1.0",
                "image": atlas_image_path.name,
                "format": "RGBA8888",
                "size": {"w": atlas_width, "h": atlas_height},
                "scale": "1",
            },
        },
    )


def write_pack_json(public_root: Path) -> None:
    files = []

    for category in CATEGORY_ORDER:
        files.append(
            {
                "type": "atlas",
                "key": CATEGORY_ATLAS_KEY[category],
                "textureURL": f"assets/debug/atlases/{category}.png",
                "atlasURL": f"assets/debug/atlases/{category}.json",
            }
        )

    files.append(
        {
            "type": "json",
            "key": "debug.animations",
            "url": "assets/debug/animations.json",
        }
    )

    write_json(
        public_root / "pack.json",
        {
            "meta": {
                "generatedAt": datetime.now(timezone.utc).isoformat(),
                "generator": "packages/debug-assets/pipeline/export_from_aseprite.py",
                "namespace": NAMESPACE,
                "sourceRoot": "packages/debug-assets/aseprite",
                "publicRoot": "apps/frontend/public/assets/debug",
                "format": "phaser-asset-pack",
            },
            NAMESPACE: {"files": files},
        },
    )


def write_animations_json(public_root: Path, animations: dict[str, AnimationBuild]) -> None:
    ordered: OrderedDict[str, dict[str, Any]] = OrderedDict()

    for animation_id in sorted(animations.keys()):
        animation = animations[animation_id]
        ordered[animation_id] = {
            "atlasKey": animation.atlas_key,
            "frames": animation.frame_names,
        }

    write_json(
        public_root / "animations.json",
        {
            "generatedAt": datetime.now(timezone.utc).isoformat(),
            "namespace": NAMESPACE,
            "animations": ordered,
        },
    )


def write_manifest_json(
    public_root: Path,
    atlas_rows: list[dict[str, Any]],
    animations: dict[str, AnimationBuild],
) -> None:
    write_json(
        public_root / "manifest.json",
        {
            "namespace": NAMESPACE,
            "atlases": atlas_rows,
            "animationCount": len(animations),
        },
    )


def write_frames(
    frames_root: Path,
    case_phase_frames: dict[str, dict[int, list[Path]]],
) -> int:
    shutil.rmtree(frames_root, ignore_errors=True)
    written = 0

    for animation_id in sorted(case_phase_frames.keys()):
        by_case = case_phase_frames[animation_id]
        output_root = frames_root / Path(*animation_id.split("."))
        output_root.mkdir(parents=True, exist_ok=True)

        for case_index in range(TILE_COUNT):
            case_dir = output_root / f"case-{case_index:02d}"
            case_dir.mkdir(parents=True, exist_ok=True)
            phase_paths = by_case.get(case_index, [])

            for phase_index, source_png in enumerate(phase_paths):
                output_file = case_dir / f"phase-{phase_index:03d}.png"
                shutil.copy2(source_png, output_file)
                written += 1

    frames_root.mkdir(parents=True, exist_ok=True)
    (frames_root / ".gitkeep").touch()
    return written


def write_previews(
    previews_root: Path,
    previews: dict[str, PreviewBuild],
) -> int:
    shutil.rmtree(previews_root, ignore_errors=True)
    written = 0

    for animation_id in sorted(previews.keys()):
        preview = previews[animation_id]
        rel_file = Path(*animation_id.split("."))
        output_file = previews_root / rel_file.parent / f"{rel_file.name}.gif"
        output_file.parent.mkdir(parents=True, exist_ok=True)

        frames: list[Image.Image] = []
        try:
            for frame_path in preview.frame_paths:
                with Image.open(frame_path) as frame_raw:
                    frames.append(frame_raw.convert("RGBA"))

            if not frames:
                continue

            first = frames[0]
            rest = frames[1:]
            first.save(
                output_file,
                save_all=True,
                append_images=rest,
                optimize=False,
                duration=preview.durations_ms,
                loop=0,
                disposal=2,
            )
            written += 1
        finally:
            for frame in frames:
                frame.close()

    previews_root.mkdir(parents=True, exist_ok=True)
    (previews_root / ".gitkeep").touch()
    return written


def clear_public_outputs(public_root: Path) -> None:
    atlases_dir = public_root / "atlases"
    shutil.rmtree(atlases_dir, ignore_errors=True)

    for filename in ["pack.json", "animations.json", "manifest.json"]:
        (public_root / filename).unlink(missing_ok=True)


def main() -> int:
    args = parse_args()

    aseprite_root = Path(args.aseprite_root).resolve()
    public_root = Path(args.public_root).resolve()
    frames_root = Path(args.frames_root).resolve()
    previews_root = Path(args.previews_root).resolve()
    extract_script = Path(args.extract_script).resolve()

    if not aseprite_root.exists():
        raise RuntimeError(f"Aseprite root does not exist: {aseprite_root}")
    if not extract_script.exists():
        raise RuntimeError(f"Extraction script does not exist: {extract_script}")
    if args.max_atlas_width < 1:
        raise RuntimeError("--max-atlas-width must be positive")
    if args.border_padding < 0:
        raise RuntimeError("--border-padding must be >= 0")
    if args.shape_padding < 0:
        raise RuntimeError("--shape-padding must be >= 0")

    aseprite_bin = resolve_aseprite_binary(args.aseprite_bin)
    grouped_sources = discover_grouped_sources(aseprite_root)

    with tempfile.TemporaryDirectory(prefix="debug-aseprite-export-") as temp_dir:
        temp_root = Path(temp_dir)
        frames_by_category, animations, previews, case_phase_frames = build_extracted_frames(
            aseprite_root=aseprite_root,
            grouped_sources=grouped_sources,
            aseprite_bin=aseprite_bin,
            extract_script=extract_script,
            temp_root=temp_root,
        )

        atlas_rows: list[dict[str, Any]] = []

        if not args.dry_run:
            public_root.mkdir(parents=True, exist_ok=True)
            clear_public_outputs(public_root)

        for category in CATEGORY_ORDER:
            entries = frames_by_category[category]
            atlas_width, atlas_height, placements = pack_category_frames(
                frames=entries,
                max_width=args.max_atlas_width,
                border_padding=args.border_padding,
                shape_padding=args.shape_padding,
            )

            texture_url = f"assets/debug/atlases/{category}.png"
            atlas_url = f"assets/debug/atlases/{category}.json"

            atlas_rows.append(
                {
                    "category": category,
                    "atlasKey": CATEGORY_ATLAS_KEY[category],
                    "textureURL": texture_url,
                    "atlasURL": atlas_url,
                    "frameCount": len(entries),
                    "width": atlas_width,
                    "height": atlas_height,
                }
            )

            if not args.dry_run:
                atlas_image_path = public_root / "atlases" / f"{category}.png"
                atlas_json_path = public_root / "atlases" / f"{category}.json"
                write_atlas_png_and_json(
                    placements=placements,
                    atlas_size=(atlas_width, atlas_height),
                    atlas_image_path=atlas_image_path,
                    atlas_json_path=atlas_json_path,
                )

        if not args.dry_run:
            write_pack_json(public_root)
            write_animations_json(public_root, animations)
            write_manifest_json(public_root, atlas_rows, animations)

            frames_written = 0
            if args.write_frames:
                frames_written = write_frames(
                    frames_root=frames_root,
                    case_phase_frames=case_phase_frames,
                )

            previews_written = 0
            if args.write_previews:
                previews_written = write_previews(
                    previews_root=previews_root,
                    previews=previews,
                )
        else:
            frames_written = 0
            previews_written = 0

    frame_total = sum(len(item.frame_names) for item in animations.values())

    print(
        "Aseprite export summary: "
        f"groups={len(grouped_sources)}, "
        f"animations={len(animations)}, "
        f"frames={frame_total}, "
        f"public={'no' if args.dry_run else 'yes'}, "
        f"framesWritten={frames_written}, "
        f"previewsWritten={previews_written}, "
        f"publicRoot={public_root}"
    )

    if args.dry_run:
        print("Dry run mode: destination outputs were not written.")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
