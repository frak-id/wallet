import type {
    ModalRpcStepsResultType,
    ModalStepTypes,
} from "@frak-labs/core-sdk";
import { atom } from "jotai";
import { trackGenericEvent } from "../../../common/analytics";

export type AnyModalKey = ModalStepTypes["key"];

/**
 * Atom with the displayed modal rpc steps
 */
export type DisplayedModalStep<
    T extends ModalStepTypes["key"] | undefined = undefined,
> = T extends ModalStepTypes["key"]
    ? {
          // Key and params of the step
          key: T;
          params: Extract<ModalStepTypes, { key: T }>["params"];
          // On response
          onResponse: (
              response: Extract<ModalStepTypes, { key: T }>["returns"]
          ) => void;
      }
    : never;

/**
 * The currently displayed modal steps
 */
export const displayedRpcModalStepsAtom = atom<
    | {
          currentStep: number;
          steps: DisplayedModalStep<AnyModalKey>[];
          // Was the modal dismissed or not?
          dismissed?: boolean;
      }
    | undefined
>();

/**
 * The current modal result
 */
export const modalRpcResultsAtom = atom<ModalRpcStepsResultType | undefined>(
    undefined
);

/**
 * Atom to store everything for a new modal
 */
export const setNewModalAtom = atom(
    null,
    (
        get,
        set,
        {
            currentStep,
            initialResult,
            steps,
        }: {
            currentStep: number;
            initialResult: ModalRpcStepsResultType;
            steps: Omit<DisplayedModalStep<AnyModalKey>, "onResponse">[];
        }
    ) => {
        // Store the initial result
        set(modalRpcResultsAtom, initialResult);

        // Append the on onResponse callback to the each steps
        const stepsWithOnResponse = steps.map((step, index) => ({
            ...step,
            onResponse: (
                response: Extract<
                    ModalStepTypes,
                    { key: typeof step.key }
                >["returns"]
            ) => {
                const currentResults = get(modalRpcResultsAtom);
                if (!currentResults) return;

                // Update the current results
                set(modalRpcResultsAtom, {
                    ...currentResults,
                    [step.key]: response,
                });

                trackGenericEvent(`modal_step_${step.key}_completed`);

                // Update the displayed step index
                set(displayedRpcModalStepsAtom, (current) => ({
                    steps: current?.steps ?? [],
                    currentStep: index + 1,
                }));
            },
        })) as DisplayedModalStep<AnyModalKey>[];
        // Then save it
        set(displayedRpcModalStepsAtom, {
            currentStep,
            steps: stepsWithOnResponse,
        });
    }
);
