import { iframeResolvingContextAtom } from "@/module/listener/atoms/resolvingContext";
import { useEstimatedInteractionReward } from "@/module/listener/hooks/useEstimatedInteractionReward";
import { emitLifecycleEvent } from "@/module/sdk/utils/lifecycleEvents";
import type {
    DisplayEmbededWalletParamsType,
    FrakWalletSdkConfig,
    FullInteractionTypesKey,
    IFrameRpcSchema,
    ModalRpcMetadata,
    ModalRpcStepsInput,
    RpcResponse,
} from "@frak-labs/core-sdk";
import {
    formatAmount,
    getCurrencyAmountKey,
    getSupportedCurrency,
} from "@frak-labs/core-sdk";
import type { TOptions, i18n } from "i18next";
import { useAtomValue } from "jotai";
import {
    type PropsWithChildren,
    createContext,
    useCallback,
    useContext,
    useMemo,
    useState,
} from "react";
import { useTranslation } from "react-i18next";
import { mapDeprecatedModalMetadata } from "../utils/deprecatedModalMetadataMapper";

type GenericWalletUiType = {
    appName: string;
    targetInteraction?: FullInteractionTypesKey;
    i18n?: {
        lang?: "en" | "fr";
        context?: string;
    };
};

/**
 * Type for the embedded wallet ui type
 *  - todo: Maybe some pre-check hooks, or other stuff to store here? Like which view to display (loggedOut or loggedIn?)
 */
type EmbededWalletUiType = {
    type: "embeded";
    params: {
        metadata: FrakWalletSdkConfig["metadata"];
    } & DisplayEmbededWalletParamsType;
};

/**
 * Type for the modal ui type
 *  - todo: Should it contain same stuff as the atom? Like prepared steps etc?
 */
export type ModalUiType = {
    type: "modal";
    metadata: FrakWalletSdkConfig["metadata"] & ModalRpcMetadata;
    steps: ModalRpcStepsInput;
    emitter: (
        response: RpcResponse<IFrameRpcSchema, "frak_displayModal">
    ) => Promise<void>;
};

export type UIRequest = (EmbededWalletUiType | ModalUiType) &
    GenericWalletUiType;

type UIContext = {
    currentRequest: UIRequest | undefined;
    setRequest: (request: UIRequest | undefined) => void;
    clearRequest: () => void;
    translation: {
        lang?: "en" | "fr";
        t: (key: string, options?: TOptions) => string;
        fallbackT: (
            provided: string | undefined,
            fallbackKey: string,
            options?: TOptions
        ) => string;
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
 *  - Will directly display either modal or embedded wallet
 *  - Keep the state of either modal or embedded wallet in a shared context accessible with hooks
 */
export function ListenerUiProvider({ children }: PropsWithChildren) {
    // Initial translation context
    const { i18n: initialI18n } = useTranslation();
    // We are not using the safeResolvingContext here, since this component is init before the iframe is ready
    const resolvingContext = useAtomValue(iframeResolvingContextAtom);
    // Get the estimated reward
    const { estimatedReward: rewardData } = useEstimatedInteractionReward();

    // The current UI request
    const [currentRequest, setCurrentRequest] = useState<UIRequest | undefined>(
        undefined
    );

    // Save the current request + display the iframe
    const setRequest = useCallback((request: UIRequest | undefined) => {
        setCurrentRequest(request);
        emitLifecycleEvent({ iframeLifecycle: "show" });
    }, []);

    // Clear the current request + hide the iframe
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
        // Get the language from the request or the detected language from the i18n instance
        const lang =
            currentRequest?.i18n?.lang ?? (initialI18n.language as "en" | "fr");
        const context = currentRequest
            ? {
                  productName: currentRequest.appName,
                  productOrigin: resolvingContext?.origin,
                  context: currentRequest.i18n?.context,
              }
            : {};

        // Get the supported currency (e.g. "eur")
        const supportedCurrency = getSupportedCurrency(
            currentRequest?.type === "embeded"
                ? currentRequest.params.metadata?.currency
                : currentRequest?.metadata?.currency
        );

        // Get the currency amount key (e.g. "eurAmount")
        const currencyAmountKey = getCurrencyAmountKey(supportedCurrency);

        // Find the right estimated reward depending on the context
        let estimatedReward = Math.ceil(
            rewardData?.maxReferrer?.[currencyAmountKey] ?? 0
        );
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
                estimatedReward = Math.ceil(targetReward);
            }
        }

        // Format the reward
        const formattedReward = formatAmount(
            estimatedReward,
            supportedCurrency
        );

        // Create the new i18n instance with the right context
        const i18n = initialI18n.cloneInstance({
            lng: lang,
            interpolation: {
                defaultVariables: {
                    ...context,
                    estimatedReward: formattedReward,
                },
            },
            // Load both the default and the potentially customized i18n
            ns: ["translation", "customized"],
            // Default ns is the user provided ns
            defaultNS: "customized",
            // Use the translation fallback if not found in the custom ns
            fallbackNS: "translation",
        });

        // Map the deprecated modal metadata
        const deprecatedModalMetadata =
            mapDeprecatedModalMetadata(currentRequest);
        i18n.addResourceBundle(
            lang,
            "customized",
            deprecatedModalMetadata,
            true,
            false
        );

        // Create the new t function with the right context
        const rawT = i18n.getFixedT(lang, null) as typeof i18n.t;
        const t = (key: string, options?: TOptions): string =>
            rawT(key, {
                ...context,
                ...options,
                estimatedReward: formattedReward,
            });

        // Create a fallback translation string
        const fallbackT = (
            provided: string | undefined,
            fallbackKey: string,
            options?: TOptions
        ): string => {
            // If we got a provided string, use it
            if (provided) {
                i18n.format;
                // Just replace any placeholder with the right value
                //  todo: we should use the i18n format for variable??
                return provided.replace(/{REWARD}/g, formattedReward);
            }
            // Otherwise, use the fallback key
            return t(fallbackKey, options);
        };
        return { lang, i18n, t, fallbackT };
    }, [currentRequest, resolvingContext?.origin, rewardData, initialI18n]);

    return (
        <ListenerUiContext.Provider
            value={{
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
    return context as UIContext;
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
    return uiContext as Omit<UIContext, "currentRequest"> & {
        currentRequest: UIRequest;
    };
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
    return uiContext as Omit<UIContext, "currentRequest"> & {
        currentRequest: ModalUiType;
    };
}

/**
 * Custom hook to get the listener ui context only when displaying an embeded wallet
 */
export function useEmbededListenerUI() {
    const uiContext = useListenerUI();
    if (uiContext.currentRequest?.type !== "embeded") {
        throw new Error(
            "useModalListenerUI must be used within a embeded displayed UI"
        );
    }
    return uiContext as Omit<UIContext, "currentRequest"> & {
        currentRequest: EmbededWalletUiType;
    };
}

/**
 * Custom hooks to get only the translation context
 */
export const useListenerTranslation = () => useListenerUI().translation;
