export const ANIMATION_DISPLAY_INFO_EVENT = "animationDisplayInfo";
export const ANIMATION_DISPLAY_INFO_REQUEST_EVENT = "animationDisplayInfoRequest";

export type AnimationDisplayInfo = {
  animationKey: string;
  frameWidth: number;
  frameHeight: number;
  frameCount: number;
  flipX: boolean;
  scale: number;
  displayWidth: number;
  displayHeight: number;
};
