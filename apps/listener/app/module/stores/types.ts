/**
 * Shared types for Zustand stores
 */

import type { ResolvedSdkConfig } from "@frak-labs/backend-elysia/api/schemas";
import type {
    ModalRpcStepsResultType,
    ModalStepTypes,
} from "@frak-labs/core-sdk";
import type { ModalDismissSource } from "@frak-labs/wallet-shared";

export type { ResolvedSdkConfig };

/**
 * Type for modal step keys
 */
export type AnyModalKey = ModalStepTypes["key"];

/**
 * Trust tier for the SDK-listener connection, determined by domain proof.
 *
 * - `"pending"` — Config not yet received; no trust established.
 * - `"verified"` — Origin matches a registered `allowedDomains` entry. Full access.
 * - `"dev-override"` — MerchantId present but origin not in `allowedDomains`.
 *   Read-only access: modals, embedded wallet, and merchant info are allowed.
 *   Write operations (sendInteraction) are blocked to prevent fraudulent tracking.
 * - `"unverified"` — Domain proof failed and no merchantId available (e.g. backend down).
 *   Display-only access: modals, embedded wallet, and wallet status are allowed.
 *   All write operations and merchant-specific queries are blocked.
 */
export type TrustLevel = "pending" | "verified" | "dev-override" | "unverified";

/**
 * IFrame resolving context (from WalletRpcContext without source)
 */
export type IFrameResolvingContext = {
    merchantId: string;
    origin: string;
    sourceUrl: string;
    clientId?: string;
};

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
    backendSdkConfig: ResolvedSdkConfig | undefined;
    trustLevel: TrustLevel;

    // Actions
    setContext: (context: IFrameResolvingContext) => void;
    clearContext: () => void;
    setBackendConfig: (
        merchantId: string,
        config: ResolvedSdkConfig | undefined
    ) => void;
    setTrustLevel: (level: TrustLevel) => void;
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
    dismissModal: (source?: ModalDismissSource) => void;
}
