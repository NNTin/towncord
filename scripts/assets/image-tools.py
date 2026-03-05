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


def alpha_components(image, min_area):
  alpha = image.getchannel("A")
  pixels = alpha.load()
  width = image.width
  height = image.height
  visited = bytearray(width * height)
  components = []

  def idx(x, y):
    return y * width + x

  for y in range(height):
    for x in range(width):
      if pixels[x, y] == 0:
        continue

      start = idx(x, y)
      if visited[start] != 0:
        continue

      queue = [(x, y)]
      visited[start] = 1
      q_index = 0

      min_x = x
      max_x = x
      min_y = y
      max_y = y
      area = 0

      while q_index < len(queue):
        cx, cy = queue[q_index]
        q_index += 1
        area += 1

        if cx < min_x:
          min_x = cx
        if cx > max_x:
          max_x = cx
        if cy < min_y:
          min_y = cy
        if cy > max_y:
          max_y = cy

        if cx > 0:
          nx = cx - 1
          ny = cy
          ni = idx(nx, ny)
          if visited[ni] == 0 and pixels[nx, ny] != 0:
            visited[ni] = 1
            queue.append((nx, ny))

        if cx + 1 < width:
          nx = cx + 1
          ny = cy
          ni = idx(nx, ny)
          if visited[ni] == 0 and pixels[nx, ny] != 0:
            visited[ni] = 1
            queue.append((nx, ny))

        if cy > 0:
          nx = cx
          ny = cy - 1
          ni = idx(nx, ny)
          if visited[ni] == 0 and pixels[nx, ny] != 0:
            visited[ni] = 1
            queue.append((nx, ny))

        if cy + 1 < height:
          nx = cx
          ny = cy + 1
          ni = idx(nx, ny)
          if visited[ni] == 0 and pixels[nx, ny] != 0:
            visited[ni] = 1
            queue.append((nx, ny))

      if area < min_area:
        continue

      components.append(
        {
          "x": min_x,
          "y": min_y,
          "w": (max_x - min_x) + 1,
          "h": (max_y - min_y) + 1,
          "area": area,
        }
      )

  components.sort(key=lambda item: (item["y"], item["x"]))
  return components


def pack_components_as_strip(image, components, align):
  if len(components) == 0:
    return (
      image.copy(),
      {
        "type": "single",
        "frameWidth": image.width,
        "frameHeight": image.height,
        "frameCount": 1,
        "exact": True,
      },
    )

  frame_width = max(component["w"] for component in components)
  frame_height = max(component["h"] for component in components)
  frame_count = len(components)

  packed = Image.new(
    "RGBA",
    (frame_width * frame_count, frame_height),
    (0, 0, 0, 0),
  )

  for index, component in enumerate(components):
    crop = image.crop(
      (
        component["x"],
        component["y"],
        component["x"] + component["w"],
        component["y"] + component["h"],
      )
    )
    frame_x = index * frame_width
    target_x = frame_x + ((frame_width - crop.width) // 2)
    if align == "bottom-center":
      target_y = frame_height - crop.height
    else:
      target_y = (frame_height - crop.height) // 2

    packed.paste(crop, (target_x, target_y))

  packed_layout = {
    "type": "strip",
    "frameWidth": frame_width,
    "frameHeight": frame_height,
    "frameCount": frame_count,
    "offsetX": 0,
    "columns": frame_count,
    "rows": 1,
    "remainderX": 0,
    "exact": True,
  }

  return packed, packed_layout


def trim_command(args):
  source = Path(args.src)
  layout = json.loads(args.layout_json)
  image = Image.open(source).convert("RGBA")
  original = {"width": image.width, "height": image.height, "format": "png"}

  if layout["type"] == "strip":
    frame_width = int(layout["frameWidth"])
    frame_height = int(layout.get("frameHeight", image.height))
    offset_x = int(layout.get("offsetX", 0))
    available_width = max(0, image.width - offset_x)
    frame_count = int(layout.get("frameCount", max(1, available_width // frame_width)))
    desired_width = max(1, frame_width * frame_count)
    desired_height = max(1, frame_height)
    crop_x = align_strip_crop_x(image, offset_x, desired_width, desired_height)
    source_x = max(0, min(image.width, crop_x))
    source_width = max(0, min(image.width - source_x, desired_width))
    source_height = max(0, min(image.height, desired_height))
    crop = (source_x, 0, source_width, source_height)
    trim_mode = "grid"
    trimmed = Image.new("RGBA", (desired_width, desired_height), (0, 0, 0, 0))
    if source_width > 0 and source_height > 0:
      source_crop = image.crop((source_x, 0, source_x + source_width, source_height))
      trimmed.paste(source_crop, (0, 0))

    trimmed_layout = {
      "type": "strip",
      "frameWidth": frame_width,
      "frameHeight": desired_height,
      "frameCount": frame_count,
      "offsetX": 0,
      "columns": frame_count,
      "rows": 1,
      "remainderX": 0,
      "exact": source_width == desired_width and source_height == desired_height,
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
  elif layout["type"] == "components":
    min_area = int(layout.get("minArea", 1))
    align = layout.get("align", "bottom-center")
    if align not in ("center", "bottom-center"):
      raise RuntimeError("Component layout align must be 'center' or 'bottom-center'.")
    components = alpha_components(image, max(1, min_area))
    trim_mode = "components"
    crop = (0, 0, image.width, image.height)
    trimmed, trimmed_layout = pack_components_as_strip(image, components, align)
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
  if layout["type"] not in ("strip", "components"):
    trimmed = image.crop((x, y, x + w, y + h))
  normalize = parse_normalize_spec(layout.get("normalize"))

  if normalize is not None:
    if trimmed_layout["type"] != "strip":
      raise RuntimeError("Frame normalization is currently only supported for strip layouts.")
    trimmed, trimmed_layout = normalize_strip_image(trimmed, trimmed_layout, normalize)

  if not args.dry_run:
    if not args.dest:
      raise RuntimeError("--dest is required unless --dry-run is set")
    destination = Path(args.dest)
    destination.parent.mkdir(parents=True, exist_ok=True)
    trimmed.save(destination, optimize=False)

  result = {
    "original": original,
    "image": {"width": trimmed.width, "height": trimmed.height, "format": "png"},
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


def parse_normalize_spec(normalize):
  if normalize is None:
    return None

  if not isinstance(normalize, dict):
    raise RuntimeError("Layout normalize config must be an object.")

  frame_width = int(normalize["frameWidth"])
  frame_height = int(normalize["frameHeight"])
  anchor = normalize.get("anchor", "center")
  trim_alpha = bool(normalize.get("trimAlpha", False))
  offset_x = int(normalize.get("offsetX", 0))
  offset_y = int(normalize.get("offsetY", 0))
  center_odd_x = bool(normalize.get("centerOddX", False))

  if frame_width <= 0 or frame_height <= 0:
    raise RuntimeError("Normalize frame dimensions must be positive.")

  if anchor not in ("center", "bottom-center"):
    raise RuntimeError(f"Unsupported normalize anchor '{anchor}'.")

  return {
    "frameWidth": frame_width,
    "frameHeight": frame_height,
    "anchor": anchor,
    "trimAlpha": trim_alpha,
    "offsetX": offset_x,
    "offsetY": offset_y,
    "centerOddX": center_odd_x,
  }


def column_has_alpha(image, x, max_y):
  if x < 0 or x >= image.width:
    return False

  for y in range(max_y):
    if image.getpixel((x, y))[3] != 0:
      return True
  return False


def align_strip_crop_x(image, initial_x, crop_width, crop_height):
  if crop_width <= 0:
    return initial_x

  min_x = 0
  max_x = max(0, image.width - crop_width)
  x = max(min_x, min(max_x, initial_x))
  max_y = max(1, min(image.height, crop_height))
  alpha_min_x, alpha_max_x = alpha_bounds_x(image, max_y)

  if alpha_min_x is None or alpha_max_x is None:
    return x

  # Shift crop window only as needed so opaque pixels are fully contained.
  if alpha_max_x > (x + crop_width - 1):
    x = min(max_x, alpha_max_x - crop_width + 1)

  if alpha_min_x < x:
    x = max(min_x, alpha_min_x)

  return max(min_x, min(max_x, x))


def alpha_bounds_x(image, max_y):
  min_x = None
  max_x = None

  pixels = image.load()
  for x in range(image.width):
    for y in range(max_y):
      if pixels[x, y][3] != 0:
        if min_x is None:
          min_x = x
        max_x = x
        break

  return min_x, max_x


def normalize_strip_image(image, layout, normalize):
  source_frame_width = int(layout["frameWidth"])
  source_frame_height = int(layout["frameHeight"])
  frame_count = int(layout["frameCount"])

  target_frame_width = int(normalize["frameWidth"])
  target_frame_height = int(normalize["frameHeight"])
  anchor = normalize["anchor"]
  trim_alpha = bool(normalize.get("trimAlpha", False))
  offset_x = int(normalize.get("offsetX", 0))
  offset_y = int(normalize.get("offsetY", 0))
  center_odd_x = bool(normalize.get("centerOddX", False))

  normalized = Image.new(
    "RGBA",
    (target_frame_width * frame_count, target_frame_height),
    (0, 0, 0, 0),
  )

  for index in range(frame_count):
    source_x = index * source_frame_width
    frame = image.crop(
      (
        source_x,
        0,
        source_x + source_frame_width,
        source_frame_height,
      )
    )
    normalized_frame = frame

    alpha_box = frame.getchannel("A").getbbox()
    if alpha_box is None:
      continue

    # Optional full alpha trim for rules that explicitly request it.
    if trim_alpha:
      normalized_frame = frame.crop(alpha_box)
    # If width is oversized (e.g. 80x64 to 64x64), trim horizontally to the
    # alpha bounds but keep the original vertical band so character height
    # alignment remains consistent with non-tool animations.
    elif source_frame_width > target_frame_width and source_frame_height <= target_frame_height:
      left, _, right, _ = alpha_box
      normalized_frame = frame.crop((left, 0, right, source_frame_height))
    # Fallback: when height is oversized we need full trim to fit target.
    elif source_frame_height > target_frame_height:
      normalized_frame = frame.crop(alpha_box)

    frame_width = normalized_frame.width
    frame_height = normalized_frame.height

    if frame_width > target_frame_width or frame_height > target_frame_height:
      raise RuntimeError(
        "Normalized frame content exceeds target frame dimensions."
      )

    cell_x = index * target_frame_width
    x_delta = target_frame_width - frame_width
    odd_center_bias = 1 if center_odd_x and (x_delta % 2) != 0 else 0
    target_x = cell_x + (x_delta // 2) + odd_center_bias + offset_x
    if anchor == "bottom-center":
      target_y = (target_frame_height - frame_height) + offset_y
    else:
      target_y = ((target_frame_height - frame_height) // 2) + offset_y

    if target_x < cell_x or (target_x + frame_width) > (cell_x + target_frame_width):
      raise RuntimeError("Normalized frame content exceeds horizontal frame bounds.")
    if target_y < 0 or (target_y + frame_height) > target_frame_height:
      raise RuntimeError("Normalized frame content exceeds vertical frame bounds.")

    normalized.paste(normalized_frame, (target_x, target_y))

  normalized_layout = dict(layout)
  normalized_layout["frameWidth"] = target_frame_width
  normalized_layout["frameHeight"] = target_frame_height
  normalized_layout["columns"] = frame_count
  normalized_layout["remainderX"] = 0
  normalized_layout["exact"] = True

  return normalized, normalized_layout


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
