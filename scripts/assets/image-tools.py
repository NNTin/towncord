#!/usr/bin/env python3

import argparse
import json
import math
import os
from pathlib import Path

from PIL import Image


def parse_args():
  parser = argparse.ArgumentParser(description="Image helpers for Bloomseed pipeline.")
  subparsers = parser.add_subparsers(dest="command", required=True)

  trim_parser = subparsers.add_parser("trim", help="Trim/crop one PNG based on layout.")
  trim_parser.add_argument("--src", required=True)
  trim_parser.add_argument("--dest")
  trim_parser.add_argument("--layout-json", required=True)
  trim_parser.add_argument("--dry-run", action="store_true")

  pack_parser = subparsers.add_parser("pack", help="Pack cropped frames into an atlas.")
  pack_parser.add_argument("--input-json", required=True)
  pack_parser.add_argument("--output-image")
  pack_parser.add_argument("--output-atlas-json")
  pack_parser.add_argument("--max-width", type=int, default=2048)
  pack_parser.add_argument("--padding", type=int, default=2)
  pack_parser.add_argument("--dry-run", action="store_true")

  gif_parser = subparsers.add_parser("gif", help="Render a frame-based GIF from a strip/sheet image.")
  gif_parser.add_argument("--src", required=True)
  gif_parser.add_argument("--dest")
  gif_parser.add_argument("--layout-json", required=True)
  gif_parser.add_argument("--fps", type=int, default=8)
  gif_parser.add_argument("--dry-run", action="store_true")

  return parser.parse_args()


def clamp_crop(box, width, height):
  x, y, w, h = box
  x = max(0, min(width, int(x)))
  y = max(0, min(height, int(y)))
  w = max(1, min(width - x, int(w)))
  h = max(1, min(height - y, int(h)))
  return (x, y, w, h)


def alpha_trim_box(image):
  alpha = image.getchannel("A")
  bbox = alpha.getbbox()
  if bbox is None:
    return (0, 0, image.width, image.height)
  left, top, right, bottom = bbox
  return (left, top, right - left, bottom - top)


def trim_command(args):
  source = Path(args.src)
  layout = json.loads(args.layout_json)
  image = Image.open(source).convert("RGBA")
  original = {"width": image.width, "height": image.height, "format": "png"}

  if layout["type"] == "strip":
    frame_width = int(layout["frameWidth"])
    frame_height = int(layout.get("frameHeight", image.height))
    frame_count = int(layout.get("frameCount", max(1, image.width // frame_width)))
    crop = clamp_crop((0, 0, frame_width * frame_count, frame_height), image.width, image.height)
    trim_mode = "grid"

    trimmed_layout = {
      "type": "strip",
      "frameWidth": frame_width,
      "frameHeight": frame_height,
      "frameCount": crop[2] // frame_width,
      "columns": crop[2] // frame_width,
      "rows": 1,
      "remainderX": crop[2] % frame_width,
      "exact": (crop[2] % frame_width) == 0,
    }
  elif layout["type"] == "sheet":
    cell_width = int(layout["cellWidth"])
    cell_height = int(layout["cellHeight"])
    columns = int(layout.get("columns", max(1, image.width // cell_width)))
    rows = int(layout.get("rows", max(1, image.height // cell_height)))
    crop = clamp_crop((0, 0, columns * cell_width, rows * cell_height), image.width, image.height)
    trim_mode = "grid"

    trimmed_layout = {
      "type": "sheet",
      "cellWidth": cell_width,
      "cellHeight": cell_height,
      "columns": crop[2] // cell_width,
      "rows": crop[3] // cell_height,
      "remainderX": crop[2] % cell_width,
      "remainderY": crop[3] % cell_height,
      "exact": (crop[2] % cell_width) == 0 and (crop[3] % cell_height) == 0,
    }
  else:
    crop = alpha_trim_box(image)
    trim_mode = "alpha"
    trimmed_layout = {
      "type": "single",
      "frameWidth": crop[2],
      "frameHeight": crop[3],
      "frameCount": 1,
      "exact": True,
    }

  x, y, w, h = crop
  trimmed = image.crop((x, y, x + w, y + h))

  if not args.dry_run:
    if not args.dest:
      raise RuntimeError("--dest is required unless --dry-run is set")
    destination = Path(args.dest)
    destination.parent.mkdir(parents=True, exist_ok=True)
    trimmed.save(destination, optimize=False)

  result = {
    "original": original,
    "image": {"width": w, "height": h, "format": "png"},
    "trim": {
      "mode": trim_mode,
      "box": {"x": x, "y": y, "width": w, "height": h},
      "removed": {
        "left": x,
        "top": y,
        "right": max(0, original["width"] - (x + w)),
        "bottom": max(0, original["height"] - (y + h)),
      },
    },
    "layout": trimmed_layout,
  }

  print(json.dumps(result))


def next_power_of_two(value):
  result = 1
  while result < value:
    result *= 2
  return result


def pack_frames(frames, max_width, padding):
  if len(frames) == 0:
    return {"placements": [], "width": 1, "height": 1}

  total_area = sum((frame["w"] + padding) * (frame["h"] + padding) for frame in frames)
  largest_width = max(frame["w"] for frame in frames) + (padding * 2)
  estimated_width = next_power_of_two(max(256, int(math.sqrt(total_area))))
  atlas_width = min(max_width, max(largest_width, estimated_width))

  x = padding
  y = padding
  row_height = 0
  placements = []
  used_width = 0
  used_height = 0

  for frame in sorted(frames, key=lambda item: (-item["h"], item["name"])):
    if x + frame["w"] + padding > atlas_width:
      x = padding
      y += row_height + padding
      row_height = 0

    placements.append(
      {
        "name": frame["name"],
        "source": frame["source"],
        "rect": frame["rect"],
        "x": x,
        "y": y,
        "w": frame["w"],
        "h": frame["h"],
      }
    )

    x += frame["w"] + padding
    row_height = max(row_height, frame["h"])
    used_width = max(used_width, x)
    used_height = max(used_height, y + row_height + padding)

  atlas_height = max(1, used_height)
  return {
    "placements": placements,
    "width": max(1, used_width),
    "height": atlas_height,
  }


def pack_command(args):
  data = json.loads(Path(args.input_json).read_text())
  frames = data["frames"]
  padding = max(0, args.padding)
  packed = pack_frames(frames, args.max_width, padding)

  atlas_image = Image.new("RGBA", (packed["width"], packed["height"]), (0, 0, 0, 0))
  atlas_frames = {}

  source_cache = {}
  for placement in packed["placements"]:
    source_path = placement["source"]
    if source_path not in source_cache:
      source_cache[source_path] = Image.open(source_path).convert("RGBA")
    source = source_cache[source_path]

    rect = placement["rect"]
    sx = int(rect["x"])
    sy = int(rect["y"])
    sw = int(rect["w"])
    sh = int(rect["h"])
    cropped = source.crop((sx, sy, sx + sw, sy + sh))
    atlas_image.paste(cropped, (placement["x"], placement["y"]))

    atlas_frames[placement["name"]] = {
      "frame": {
        "x": placement["x"],
        "y": placement["y"],
        "w": placement["w"],
        "h": placement["h"],
      },
      "rotated": False,
      "trimmed": False,
      "spriteSourceSize": {"x": 0, "y": 0, "w": placement["w"], "h": placement["h"]},
      "sourceSize": {"w": placement["w"], "h": placement["h"]},
    }

  image_name = os.path.basename(args.output_image) if args.output_image else "atlas.png"
  atlas_json = {
    "frames": atlas_frames,
    "meta": {
      "app": "towncord-bloomseed-pipeline",
      "version": "1.0",
      "image": image_name,
      "format": "RGBA8888",
      "size": {"w": packed["width"], "h": packed["height"]},
      "scale": "1",
    },
  }

  if not args.dry_run:
    if not args.output_image or not args.output_atlas_json:
      raise RuntimeError("--output-image and --output-atlas-json are required unless --dry-run is set")
    output_image = Path(args.output_image)
    output_json = Path(args.output_atlas_json)
    output_image.parent.mkdir(parents=True, exist_ok=True)
    output_json.parent.mkdir(parents=True, exist_ok=True)
    atlas_image.save(output_image, optimize=False)
    output_json.write_text(json.dumps(atlas_json, indent=2) + "\n")

  result = {
    "atlas": data.get("atlasName", "atlas"),
    "frameCount": len(frames),
    "width": packed["width"],
    "height": packed["height"],
  }
  print(json.dumps(result))


def layout_frames(layout, image_width, image_height):
  if layout["type"] == "strip":
    frame_width = int(layout["frameWidth"])
    frame_height = int(layout.get("frameHeight", image_height))
    frame_count = int(layout.get("frameCount", max(1, image_width // frame_width)))

    frames = []
    for index in range(frame_count):
      frames.append((index * frame_width, 0, frame_width, frame_height))
    return frames

  if layout["type"] == "sheet":
    cell_width = int(layout["cellWidth"])
    cell_height = int(layout["cellHeight"])
    columns = int(layout.get("columns", max(1, image_width // cell_width)))
    rows = int(layout.get("rows", max(1, image_height // cell_height)))

    frames = []
    for row in range(rows):
      for column in range(columns):
        frames.append((column * cell_width, row * cell_height, cell_width, cell_height))
    return frames

  return [(0, 0, image_width, image_height)]


def gif_command(args):
  source = Path(args.src)
  layout = json.loads(args.layout_json)
  image = Image.open(source).convert("RGBA")
  frames = layout_frames(layout, image.width, image.height)

  if len(frames) == 0:
    raise RuntimeError("No frames resolved for GIF render.")

  duration_ms = max(1, int(round(1000 / max(1, args.fps))))
  gif_frames = []

  for x, y, w, h in frames:
    crop = image.crop((x, y, x + w, y + h))
    gif_frames.append(crop.convert("P", palette=Image.ADAPTIVE))

  if not args.dry_run:
    if not args.dest:
      raise RuntimeError("--dest is required unless --dry-run is set")
    destination = Path(args.dest)
    destination.parent.mkdir(parents=True, exist_ok=True)
    gif_frames[0].save(
      destination,
      save_all=True,
      append_images=gif_frames[1:],
      duration=duration_ms,
      loop=0,
      optimize=False,
      disposal=2,
    )

  result = {
    "source": str(source),
    "frameCount": len(gif_frames),
    "width": gif_frames[0].width,
    "height": gif_frames[0].height,
    "fps": max(1, args.fps),
  }
  print(json.dumps(result))


def main():
  args = parse_args()
  if args.command == "trim":
    trim_command(args)
    return
  if args.command == "pack":
    pack_command(args)
    return
  if args.command == "gif":
    gif_command(args)
    return
  raise RuntimeError(f"Unknown command: {args.command}")


if __name__ == "__main__":
  main()
