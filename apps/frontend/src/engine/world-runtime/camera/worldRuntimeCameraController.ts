import Phaser from "phaser";
import type { WorldRuntimeZoomChangedPayload } from "../contracts";

const MIN_ZOOM = 1;
const MAX_ZOOM = 16;
const INITIAL_ZOOM = 2;
const SIDEBAR_WIDTH = 180;

type WorldRuntimeCameraControllerHost = {
  getCamera: () => Phaser.Cameras.Scene2D.Camera;
  getWorldBounds: () => { width: number; height: number } | null;
};

type WorldRuntimeCameraControllerCallbacks = {
  onZoomChanged: (payload: WorldRuntimeZoomChangedPayload) => void;
};

export class WorldRuntimeCameraController {
  private isPanning = false;
  private panStartX = 0;
  private panStartY = 0;
  private camStartX = 0;
  private camStartY = 0;

  constructor(
    private readonly host: WorldRuntimeCameraControllerHost,
    private readonly callbacks: WorldRuntimeCameraControllerCallbacks,
  ) {}

  public initialize(): void {
    this.host.getCamera().setZoom(INITIAL_ZOOM);
    this.centerCameraOnWorld();
    this.emitZoomChanged();
  }

  public centerCameraOnWorld(): void {
    const worldBounds = this.host.getWorldBounds();
    if (!worldBounds) {
      return;
    }

    const camera = this.host.getCamera();
    // Round to the nearest integer world pixel so game objects at integer
    // world coordinates land on integer screen pixels after camera transform.
    camera.setScroll(
      Math.round(worldBounds.width / 2 - camera.width / 2 - SIDEBAR_WIDTH / (2 * camera.zoom)),
      Math.round(worldBounds.height / 2 - camera.height / 2),
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
    // Round to integer world pixels — fractional scroll shifts every game
    // object off the pixel grid, producing the same seam artifacts as
    // non-integer zoom.
    camera.setScroll(Math.round(this.camStartX - dx), Math.round(this.camStartY - dy));
  }

  public endPan(): void {
    this.isPanning = false;
  }

  public isPanActive(): boolean {
    return this.isPanning;
  }

  public handleWheel(dy: number): void {
    // Step by ±1 integer so every zoom level is a whole number.
    // Multiplying by a float factor (0.9 / 1.1) produces non-integer zoom
    // values which map world pixel boundaries to fractional screen pixels,
    // causing sub-pixel seams between any two adjacent sprites.
    const current = Math.round(this.host.getCamera().zoom);
    this.applyZoom(dy > 0 ? current - 1 : current + 1);
  }

  public handleSetZoom(payload: { zoom: number }): void {
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
    // Math.round ensures the zoom is always an integer, keeping every world
    // pixel boundary at an exact screen pixel under any zoom level.
    camera.setZoom(Math.round(Phaser.Math.Clamp(nextZoom, MIN_ZOOM, MAX_ZOOM)));
    this.emitZoomChanged();
  }

  private emitZoomChanged(): void {
    const camera = this.host.getCamera();
    this.callbacks.onZoomChanged({
      zoom: camera.zoom,
      minZoom: MIN_ZOOM,
      maxZoom: MAX_ZOOM,
    });
  }
}
