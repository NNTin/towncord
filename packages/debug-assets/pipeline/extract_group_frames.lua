local output_dir = app.params.output_dir
local manifest_path = app.params.manifest

if not output_dir or output_dir == "" then
  error("Missing --script-param output_dir=<directory>")
end

if not manifest_path or manifest_path == "" then
  error("Missing --script-param manifest=<path-to-output-json>")
end

local sprite = app.activeSprite
if not sprite then
  error("No active sprite. Pass a .aseprite file before --script.")
end

local function read_only_layer(layer)
  return layer.isGroup
end

local layer_by_name = {}
for _, layer in ipairs(sprite.layers) do
  if not read_only_layer(layer) then
    layer_by_name[layer.name] = layer
  end
end

local tags = {}
for tag_index, tag in ipairs(sprite.tags) do
  local tag_name = tag.name
  local layer = layer_by_name[tag_name]
  if not layer then
    error("Missing layer named '" .. tag_name .. "' for tag alignment")
  end

  local from_index = tag.fromFrame.frameNumber
  local to_index = tag.toFrame.frameNumber

  local frames = {}
  local out_index = 0

  for frame_number = from_index, to_index do
    local frame = sprite.frames[frame_number]
    local cel = layer:cel(frame)
    if not cel then
      error(
        "Missing cel for layer '"
          .. tag_name
          .. "' frame "
          .. tostring(frame_number)
      )
    end

    local filename = string.format("tag-%04d-frame-%04d.png", tag_index, out_index)
    local output_file = app.fs.joinPath(output_dir, filename)

    cel.image:saveAs(output_file)

    table.insert(frames, {
      index = out_index,
      sourceFrame = frame_number - 1,
      duration = frame.duration,
      file = filename,
      width = cel.image.width,
      height = cel.image.height,
      celX = cel.position.x,
      celY = cel.position.y,
    })

    out_index = out_index + 1
  end

  table.insert(tags, {
    name = tag_name,
    from = from_index - 1,
    to = to_index - 1,
    frameCount = #frames,
    layerName = layer.name,
    frames = frames,
  })
end

local manifest = {
  sourceFile = sprite.filename,
  canvas = {
    width = sprite.width,
    height = sprite.height,
  },
  tagCount = #tags,
  tags = tags,
}

local file = assert(io.open(manifest_path, "w"))
file:write(json.encode(manifest))
file:close()

app.exit()
