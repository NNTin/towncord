import { TerrainRuntime } from "../../engine/terrain";
import type { TerrainRenderSurface } from "./renderSurface";
import { createTerrainRuntimeOptions } from "./runtime";

export class TerrainSystem extends TerrainRuntime {
  constructor(scene: TerrainRenderSurface) {
    super(scene, createTerrainRuntimeOptions(scene));
  }
}
