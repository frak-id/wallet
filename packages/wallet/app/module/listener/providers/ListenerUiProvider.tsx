import type { IFrameResolvingContext } from "@/context/sdk/utils/iFrameRequestResolver";
import { getIFrameResolvingContext } from "@/context/sdk/utils/iframeContext";
import { emitLifecycleEvent } from "@/context/sdk/utils/lifecycleEvents";
import type {
    DisplayEmbededWalletParamsType,
    FullInteractionTypesKey,
    IFrameRpcSchema,
    ModalRpcMetadata,
    ModalRpcStepsInput,
    RpcResponse,
} from "@frak-labs/core-sdk";
import type { TOptions, i18n } from "i18next";
import {
    type PropsWithChildren,
    createContext,
    useCallback,
    useContext,
    useMemo,
    useState,
} from "react";
import { useTranslation } from "react-i18next";
import { useEstimatedInteractionReward } from "../hooks/useEstimatedInteractionReward";

type GenericWalletUiType = {
    appName: string;
    targetInteraction?: FullInteractionTypesKey;
    i18n?: {
        lang?: "en" | "fr";
        context?: string;
    };
};

/**
 * Type for the embeded wallet ui type
 *  - todo: Maybe some precheck hooks, or other stuff to store here? Like which view to display (loggedOut or loggedIn?)
 */
type EmbededWalletUiType = {
    type: "embeded";
    params: DisplayEmbededWalletParamsType;
};

/**
 * Type for the modal ui type
 *  - todo: Should it contain same stuff as the atom? Like prepared steps etc?
 */
export type ModalUiType = {
    type: "modal";
    metadata?: ModalRpcMetadata;
    steps: ModalRpcStepsInput;
    emitter: (
        response: RpcResponse<IFrameRpcSchema, "frak_displayModal">
    ) => Promise<void>;
};

type UIRequest = (EmbededWalletUiType | ModalUiType) & GenericWalletUiType;

type UIContext = {
    resolvingContext: IFrameResolvingContext | undefined;
    currentRequest: UIRequest | undefined;
    setRequest: (request: UIRequest | undefined) => void;
    clearRequest: () => void;
    translation: {
        lang?: "en" | "fr";
        t: (key: string, options?: TOptions) => string;
        i18n: i18n;
    };
};

/**
 * Context for the different type of UI we can display
 */
export const ListenerUiContext = createContext<UIContext | undefined>(
    undefined
);

/**
 * Provider for the listener UI
 *  - Will directly display either modal or embeded wallet
 *  - Keep the state of either modal or embeded wallet in a shared context accessible with hooks
 */
export function ListenerUiProvider({ children }: PropsWithChildren) {
    const { i18n: initialI18n } = useTranslation();
    const resolvingContext = useMemo(() => getIFrameResolvingContext(), []);
    const { estimatedReward: rewardData } = useEstimatedInteractionReward({
        resolvingContext,
    });

    const [currentRequest, setCurrentRequest] = useState<UIRequest | undefined>(
        undefined
    );

    const setRequest = useCallback((request: UIRequest | undefined) => {
        setCurrentRequest(request);
        emitLifecycleEvent({ iframeLifecycle: "show" });
    }, []);

    const clearRequest = useCallback(() => {
        emitLifecycleEvent({ iframeLifecycle: "hide" });
        setCurrentRequest(undefined);
    }, []);

    /**
     * Build the new translation context for the listener UI
     *  - Set the language to the request language
     *  - Compute the right reward estimation depending on the request context
     *  - Add some default variable (product name, product origin, context)
     */
    const translation = useMemo(() => {
        const lang = currentRequest?.i18n?.lang ?? "en";
        const context = currentRequest
            ? {
                  productName: currentRequest.appName,
                  productOrigin: resolvingContext?.origin,
                  context: currentRequest.i18n?.context,
              }
            : {};

        // Find the right estimated reward depending on the context
        let estimatedReward = rewardData?.estimatedEurReward;
        if (rewardData && currentRequest?.targetInteraction) {
            // Find the max reward for the target interaction
            const targetReward = rewardData.rewards
                .filter(
                    (reward) =>
                        reward.interactionTypeKey ===
                        currentRequest.targetInteraction
                )
                .map((reward) => reward.referrer.eurAmount)
                .reduce((acc, reward) => (reward > acc ? reward : acc), 0);
            // If found a reward, set it as the estimated reward
            if (targetReward > 0) {
                estimatedReward = Math.ceil(targetReward).toString();
            }
        }

        // Create the new i18n instance with the right context
        const i18n = initialI18n.cloneInstance({
            lng: lang,
            interpolation: {
                defaultVariables: {
                    ...context,
                    estimatedReward,
                },
            },
        });

        // Create the new t function with the right context
        const rawT = i18n.getFixedT(lang, null) as typeof i18n.t;
        const t = (key: string, options?: TOptions): string =>
            rawT(key, {
                ...context,
                ...options,
                estimatedReward,
            });
        return { lang: currentRequest?.i18n?.lang, i18n, t };
    }, [currentRequest, resolvingContext, rewardData, initialI18n]);

    return (
        <ListenerUiContext.Provider
            value={{
                resolvingContext,
                currentRequest,
                setRequest,
                clearRequest,
                translation,
            }}
        >
            {children}
        </ListenerUiContext.Provider>
    );
}

/**
 * Access the top level listener UI context
 */
export function useListenerUI() {
    const context = useContext(ListenerUiContext);
    if (!context) {
        throw new Error(
            "useListenerUI must be used within a ListenerUiContext"
        );
    }
    if (!context.resolvingContext) {
        throw new Error("useListenerUI must be used within an iframe");
    }
    return context as Omit<UIContext, "resolvingContext"> & {
        resolvingContext: IFrameResolvingContext;
    };
}

/**
 * Custom hook to get the listener ui context when a request is present
 */
export function useListenerWithRequestUI() {
    const uiContext = useListenerUI();
    if (!uiContext.currentRequest) {
        throw new Error(
            "uselListenerWithReauestUI must be used with a current request"
        );
    }
    return uiContext as Omit<
        UIContext,
        "resolvingContext" | "currentRequest"
    > & { resolvingContext: IFrameResolvingContext; currentRequest: UIRequest };
}

/**
 * Custom hook to get the listener ui context only when displaying a modal
 */
export function useModalListenerUI() {
    const uiContext = useListenerUI();
    if (uiContext.currentRequest?.type !== "modal") {
        throw new Error(
            "useModalListenerUI must be used within a modal displayed UI"
        );
    }
    return uiContext as Omit<
        UIContext,
        "resolvingContext" | "currentRequest"
    > & {
        resolvingContext: IFrameResolvingContext;
        currentRequest: ModalUiType;
    };
}

/**
 * Custom hooks to get only the translation context
 */
export const useListenerTranslation = () => useListenerUI().translation;
