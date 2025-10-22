/**
 * Shared types for Zustand stores
 */

import type {
    ClientLifecycleEvent,
    ModalRpcStepsResultType,
    ModalStepTypes,
} from "@frak-labs/core-sdk";
import type { Address } from "viem";

/**
 * Type for modal step keys
 */
export type AnyModalKey = ModalStepTypes["key"];

/**
 * IFrame resolving context (from WalletRpcContext without source)
 */
export interface IFrameResolvingContext {
    productId: `0x${string}`;
    origin: string;
    sourceUrl: string;
    isAutoContext: boolean;
    walletReferrer?: Address;
}

/**
 * Displayed modal step with typed params and response callback
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
 * Resolving Context Store State
 */
export interface ResolvingContextStore {
    // State
    context: IFrameResolvingContext | undefined;
    handshakeTokens: Set<string>;

    // Actions
    startHandshake: () => void;
    handleHandshakeResponse: (
        event: MessageEvent<ClientLifecycleEvent>
    ) => boolean;
    setContext: (context: IFrameResolvingContext | undefined) => void;
    clearContext: () => void;
}

/**
 * Modal Store State
 */
export interface ModalStore {
    // State
    steps: DisplayedModalStep<AnyModalKey>[] | undefined;
    currentStep: number;
    results: ModalRpcStepsResultType | undefined;
    dismissed: boolean;

    // Actions
    setNewModal: (config: {
        currentStep: number;
        initialResult: ModalRpcStepsResultType;
        steps: Omit<DisplayedModalStep<AnyModalKey>, "onResponse">[];
    }) => void;
    completeStep: (
        stepKey: AnyModalKey,
        response: ModalStepTypes["returns"]
    ) => void;
    nextStep: () => void;
    clearModal: () => void;
    setDismissed: (dismissed: boolean) => void;
}
