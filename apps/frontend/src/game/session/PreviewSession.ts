import type {
  PreviewAnimationRequest,
  PreviewRuntimeInfo,
  PreviewTileRequest,
} from "../contracts/preview";

export type PreviewRuntimeState = PreviewRuntimeInfo;

export type PreviewSessionNotifications = {
  onInfo?: (payload: PreviewRuntimeState) => void;
};

export type PreviewSession = {
  subscribe: (notifications: PreviewSessionNotifications) => () => void;
  showAnimation: (payload: PreviewAnimationRequest) => void;
  showTile: (payload: PreviewTileRequest) => void;
  destroy: () => void;
};