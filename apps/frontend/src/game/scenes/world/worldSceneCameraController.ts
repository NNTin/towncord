import Phaser from "phaser";
import type { SetZoomPayload } from "../../protocol";
import type { TerrainSystem } from "../../terrain";
import type { WorldSceneProjectionEmitter } from "./worldSceneProjections";

const MIN_ZOOM = 1;
const MAX_ZOOM = 16;
const INITIAL_ZOOM = 2;
const SIDEBAR_WIDTH = 180;

type WorldSceneCameraControllerHost = {
  getCamera: () => Phaser.Cameras.Scene2D.Camera;
  getTerrainSystem: () => TerrainSystem | null;
};

export class WorldSceneCameraController {
  private isPanning = false;
  private panStartX = 0;
  private panStartY = 0;
  private camStartX = 0;
  private camStartY = 0;

  constructor(
    private readonly host: WorldSceneCameraControllerHost,
    private readonly projections: WorldSceneProjectionEmitter,
  ) {}

  public initialize(): void {
    this.host.getCamera().setZoom(INITIAL_ZOOM);
    this.centerCameraOnWorld();
    this.emitZoomChanged();
  }

  public centerCameraOnWorld(): void {
    const terrainSystem = this.host.getTerrainSystem();
    if (!terrainSystem) {
      return;
    }

    const worldBounds = terrainSystem.getGameplayGrid().getWorldBounds();
    const camera = this.host.getCamera();
    camera.setScroll(
      worldBounds.width / 2 - camera.width / 2 - SIDEBAR_WIDTH / (2 * camera.zoom),
      worldBounds.height / 2 - camera.height / 2,
    );
  }

  public beginPan(pointer: Phaser.Input.Pointer): void {
    const camera = this.host.getCamera();
    this.isPanning = true;
    this.panStartX = pointer.x;
    this.panStartY = pointer.y;
    this.camStartX = camera.scrollX;
    this.camStartY = camera.scrollY;
  }

  public updatePan(pointer: Phaser.Input.Pointer): void {
    const camera = this.host.getCamera();
    const dx = (pointer.x - this.panStartX) / camera.zoom;
    const dy = (pointer.y - this.panStartY) / camera.zoom;
    camera.setScroll(this.camStartX - dx, this.camStartY - dy);
  }

  public endPan(): void {
    this.isPanning = false;
  }

  public isPanActive(): boolean {
    return this.isPanning;
  }

  public handleWheel(dy: number): void {
    const factor = dy > 0 ? 0.9 : 1.1;
    this.applyZoom(this.host.getCamera().zoom * factor);
  }

  public handleSetZoom(payload: SetZoomPayload): void {
    this.applyZoom(payload.zoom);
  }

  public reset(): void {
    this.isPanning = false;
    this.panStartX = 0;
    this.panStartY = 0;
    this.camStartX = 0;
    this.camStartY = 0;
  }

  private applyZoom(nextZoom: number): void {
    const camera = this.host.getCamera();
    camera.setZoom(Phaser.Math.Clamp(nextZoom, MIN_ZOOM, MAX_ZOOM));
    this.emitZoomChanged();
  }

  private emitZoomChanged(): void {
    const camera = this.host.getCamera();
    this.projections.emitZoomChanged({
      zoom: camera.zoom,
      minZoom: MIN_ZOOM,
      maxZoom: MAX_ZOOM,
    });
  }
}
