import type { MutableRefObject } from "react";
import type { RuntimeRootBindings } from "../contracts";

type RuntimeHostProps = {
  runtimeRootRef: MutableRefObject<HTMLDivElement | null>;
  runtimeRootBindings: RuntimeRootBindings;
};

export function RuntimeHost({
  runtimeRootRef,
  runtimeRootBindings,
}: RuntimeHostProps): JSX.Element {
  return <div ref={runtimeRootRef} className="game-root" {...runtimeRootBindings} />;
}
