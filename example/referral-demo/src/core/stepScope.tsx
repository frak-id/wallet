import { createContext, type ReactNode, useContext } from "react";
import type { StepId } from "./stepIds";

const Scope = createContext<StepId | null>(null);

/** Binds a subtree to the step it renders: its moves and system sheets stay with that step. */
export function StepScope({
    stepId,
    children,
}: {
    stepId: StepId;
    children: ReactNode;
}) {
    return <Scope.Provider value={stepId}>{children}</Scope.Provider>;
}

/** The step this subtree renders for; `null` outside the stage, e.g. the presenter panel. */
export function useOwnStep(): StepId | null {
    return useContext(Scope);
}
