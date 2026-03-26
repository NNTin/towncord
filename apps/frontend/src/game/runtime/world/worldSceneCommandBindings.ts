import type {
  OfficeSetEditorToolPayload,
} from "../../contracts/office-editor";
import type {
  PlaceEntityDropPayload,
  PlaceTerrainDropPayload,
  SelectedTerrainToolPayload,
} from "../../contracts/runtime";
import {
  UI_TO_RUNTIME_COMMANDS,
  bindUiToRuntimeCommand,
  type SetZoomPayload,
} from "../transport/uiCommands";

type RuntimeCommandHost = {
  getRuntimeHost: () =>
    | {
        events: {
          emit: (event: string, payload: unknown) => void;
          on: (event: string, fn: (payload: unknown) => void, context?: unknown) => void;
          off: (event: string, fn: (payload: unknown) => void, context?: unknown) => void;
        };
      }
    | null
    | undefined;
};

type WorldSceneRuntimeCommandHandlers = {
  handlePlaceEntityDrop: (payload: PlaceEntityDropPayload) => void;
  handlePlaceTerrainDrop: (payload: PlaceTerrainDropPayload) => void;
  handleSelectTerrainTool: (payload: SelectedTerrainToolPayload) => void;
  handleSetOfficeEditorTool: (payload: OfficeSetEditorToolPayload) => void;
  handleSetZoom: (payload: SetZoomPayload) => void;
};

export class WorldSceneCommandBindings {
  private unsubscribers: Array<() => void> = [];

  constructor(
    private readonly host: RuntimeCommandHost,
    private readonly handlers: WorldSceneRuntimeCommandHandlers,
  ) {}

  public bind(): void {
    const runtimeHost = this.host.getRuntimeHost();
    if (!runtimeHost) {
      return;
    }

    this.unbind();
    this.unsubscribers = [
      bindUiToRuntimeCommand(
        runtimeHost,
        UI_TO_RUNTIME_COMMANDS.PLACE_ENTITY_DROP,
        this.handlers.handlePlaceEntityDrop,
      ),
      bindUiToRuntimeCommand(
        runtimeHost,
        UI_TO_RUNTIME_COMMANDS.PLACE_TERRAIN_DROP,
        this.handlers.handlePlaceTerrainDrop,
      ),
      bindUiToRuntimeCommand(
        runtimeHost,
        UI_TO_RUNTIME_COMMANDS.SELECT_TERRAIN_TOOL,
        this.handlers.handleSelectTerrainTool,
      ),
      bindUiToRuntimeCommand(
        runtimeHost,
        UI_TO_RUNTIME_COMMANDS.OFFICE_SET_EDITOR_TOOL,
        this.handlers.handleSetOfficeEditorTool,
      ),
      bindUiToRuntimeCommand(
        runtimeHost,
        UI_TO_RUNTIME_COMMANDS.SET_ZOOM,
        this.handlers.handleSetZoom,
      ),
    ];
  }

  public unbind(): void {
    for (const unsubscribe of this.unsubscribers) {
      unsubscribe();
    }
    this.unsubscribers = [];
  }
}
