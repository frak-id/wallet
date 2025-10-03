import { iframeResolvingContextAtom } from "@/module/listener/atoms/resolvingContext";
import { useEstimatedInteractionReward } from "@/module/listener/hooks/useEstimatedInteractionReward";
import { emitLifecycleEvent } from "@/module/sdk/utils/lifecycleEvents";
import type {
    Currency,
    DisplayEmbeddedWalletParamsType,
    FrakWalletSdkConfig,
    FullInteractionTypesKey,
    IFrameRpcSchema,
    Language,
    ModalRpcMetadata,
    ModalRpcStepsInput,
} from "@frak-labs/core-sdk";
import {
    formatAmount,
    getCurrencyAmountKey,
    getSupportedCurrency,
} from "@frak-labs/core-sdk";
import type { ExtractReturnType, RpcResponse } from "@frak-labs/rpc";
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
import {
    mapI18nConfig,
    translationKeyPathToObject,
} from "../../sdk/utils/i18nMapper";
import { mapDeprecatedModalMetadata } from "../utils/deprecatedModalMetadataMapper";

export type GenericWalletUiType = {
    appName: string;
    logoUrl?: string;
    homepageLink?: string;
    targetInteraction?: FullInteractionTypesKey;
    i18n?: {
        lang?: "en" | "fr";
        context?: string;
    };
    configMetadata: FrakWalletSdkConfig["metadata"];
};

/**
 * Type for the embedded wallet ui type
 *  - todo: Maybe some pre-check hooks, or other stuff to store here? Like which view to display (loggedOut or loggedIn?)
 */
type EmbeddedWalletUiType = {
    type: "embedded";
    params: DisplayEmbeddedWalletParamsType;
    emitter: (
        response: RpcResponse<
            ExtractReturnType<IFrameRpcSchema, "frak_displayEmbeddedWallet">
        >
    ) => Promise<void>;
};

/**
 * Type for the modal ui type
 *  - todo: Should it contain same stuff as the atom? Like prepared steps etc?
 */
export type ModalUiType = {
    type: "modal";
    metadata: ModalRpcMetadata;
    steps: ModalRpcStepsInput;
    emitter: (
        response: RpcResponse<
            ExtractReturnType<IFrameRpcSchema, "frak_displayModal">
        >
    ) => Promise<void>;
};

export type UIRequest = (EmbeddedWalletUiType | ModalUiType) &
    GenericWalletUiType;

type UIContext = {
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
const ListenerUiContext = createContext<UIContext | undefined>(undefined);

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
     * Get the right reward estimation for the current target interaction + currency
     */
    const getReward = useCallback(
        ({
            currency,
            targetInteraction,
            context,
        }: {
            currency?: Currency;
            targetInteraction?: FullInteractionTypesKey;
            context?: string;
        }) => {
            // Get the supported currency (e.g. "eur")
            const supportedCurrency = getSupportedCurrency(currency);

            // Get the currency amount key (e.g. "eurAmount")
            const currencyAmountKey = getCurrencyAmountKey(supportedCurrency);

            // If we are in the referred context, we use the referee reward instead of the referrer one
            const useReferrerReward = context !== "referred";

            // Get the max reward
            const maxReward = useReferrerReward
                ? rewardData?.maxReferrer?.[currencyAmountKey]
                : rewardData?.maxReferee?.[currencyAmountKey];

            // Find the right estimated reward depending on the context
            let estimatedReward = maxReward ?? 0;
            if (rewardData && targetInteraction) {
                // Find the max reward for the target interaction
                const targetReward = rewardData.rewards
                    .filter(
                        (reward) =>
                            reward.interactionTypeKey === targetInteraction
                    )
                    .map((reward) =>
                        useReferrerReward
                            ? reward.referrer.eurAmount
                            : reward.referee.eurAmount
                    )
                    .reduce((acc, reward) => (reward > acc ? reward : acc), 0);
                // If found a reward, set it as the estimated reward
                if (targetReward > 0) {
                    estimatedReward = targetReward;
                }
            }

            // Format the reward
            return formatAmount(
                normalizeAmount(estimatedReward),
                supportedCurrency
            );
        },
        [rewardData]
    );

    /**
     * Populate the i18n resources for the current request
     */
    const populateI18nResources = useCallback(
        (i18n: i18n, lang: Language, request?: UIRequest) => {
            if (!request) return;

            // Map the deprecated modal metadata
            const deprecatedModalMetadata = mapDeprecatedModalMetadata(request);
            if (
                deprecatedModalMetadata &&
                Object.keys(deprecatedModalMetadata).length > 0
            ) {
                i18n.addResourceBundle(
                    lang,
                    "customized",
                    translationKeyPathToObject(deprecatedModalMetadata),
                    true,
                    true
                );
            }

            // Map potential custom i18n config
            if (request?.type === "embedded" && request.params.metadata?.i18n) {
                mapI18nConfig(request.params.metadata.i18n, i18n);
                return;
            }
            if (request?.type === "modal" && request.metadata.i18n) {
                mapI18nConfig(request.metadata.i18n, i18n);
                return;
            }
        },
        []
    );

    /**
     * Build the new translation context for the listener UI
     *  - Set the language to the request language
     *  - Compute the right reward estimation depending on the request context
     *  - Add some default variable (product name, product origin, context)
     */
    const translation = useMemo(() => {
        // Get the language from the request or the detected language from the i18n instance
        const lang =
            currentRequest?.i18n?.lang ?? (initialI18n.language as Language);
        const context = currentRequest
            ? {
                  productName: currentRequest.appName,
                  productOrigin: resolvingContext?.origin,
                  context: currentRequest.i18n?.context,
              }
            : {};

        // Format the reward
        const formattedReward = getReward({
            currency: currentRequest?.configMetadata?.currency,
            targetInteraction: currentRequest?.targetInteraction,
            context: currentRequest?.i18n?.context,
        });

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

        // Populate the i18n resources
        populateI18nResources(i18n, lang, currentRequest);

        // Create the new t function with the right context
        const rawT = i18n.getFixedT(lang, null) as typeof i18n.t;
        const t = (key: string, options?: TOptions): string =>
            rawT(key, {
                ...context,
                ...options,
                estimatedReward: formattedReward,
            });
        return { lang, i18n, t };
    }, [
        currentRequest,
        resolvingContext?.origin,
        initialI18n,
        getReward,
        populateI18nResources,
    ]);

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
        currentRequest: ModalUiType & GenericWalletUiType;
    };
}

/**
 * Custom hook to get the listener ui context only when displaying an embedded wallet
 */
export function useEmbeddedListenerUI() {
    const uiContext = useListenerUI();
    if (uiContext.currentRequest?.type !== "embedded") {
        throw new Error(
            "useModalListenerUI must be used within a embedded displayed UI"
        );
    }
    return uiContext as Omit<UIContext, "currentRequest"> & {
        currentRequest: EmbeddedWalletUiType & GenericWalletUiType;
    };
}

/**
 * Custom hooks to get only the translation context
 */
export const useListenerTranslation = () => useListenerUI().translation;

/**
 * Normalize the amount to the right displayable format
 *  - <10 -> ceil
 *  - <100 -> rounded to the nearest 10s
 *  - >100 -> rounded to the floor 50s
 */
function normalizeAmount(amount: number) {
    return Math.round(amount);
}
