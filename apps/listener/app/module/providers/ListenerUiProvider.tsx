import type {
    DisplayEmbeddedWalletParamsType,
    DisplaySharingPageParamsType,
    FrakWalletSdkConfig,
    IFrameRpcSchema,
    InteractionTypeKey,
    Language,
    ModalRpcMetadata,
    ModalRpcStepsInput,
} from "@frak-labs/core-sdk";
import type {
    ExtractReturnType,
    RpcResponse,
} from "@frak-labs/frame-connector";
import { emitLifecycleEvent } from "@frak-labs/wallet-shared";
import type { i18n, TOptions } from "i18next";
import {
    mapI18nConfig,
    translationKeyPathToObject,
} from "@/module/utils/i18nMapper";

/**
 * TFunction overloads expect `Omit<TOptions, "context"> & { context?: string }` rather than raw
 * TOptions (whose $Dictionary intersection widens `context` to `any`). This alias bridges the gap.
 */
type TranslationOptions = Omit<TOptions, "context"> & { context?: string };

import { useFormattedEstimatedReward } from "@frak-labs/wallet-shared";
import {
    createContext,
    type PropsWithChildren,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { useTranslation } from "react-i18next";
import { resolvingContextStore } from "@/module/stores/resolvingContextStore";
import type { ResolvedSdkConfig } from "@/module/stores/types";
import { mapDeprecatedModalMetadata } from "../utils/deprecatedModalMetadataMapper";

export type GenericWalletUiType = {
    appName: string;
    logoUrl?: string;
    homepageLink?: string;
    placement?: string;
    targetInteraction?: InteractionTypeKey;
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

/**
 * Type for the sharing page ui type
 */
export type SharingPageUiType = {
    type: "sharing";
    params: DisplaySharingPageParamsType;
    emitter: (
        response: RpcResponse<
            ExtractReturnType<IFrameRpcSchema, "frak_displaySharingPage">
        >
    ) => Promise<void>;
};

export type UIRequest = (
    | EmbeddedWalletUiType
    | ModalUiType
    | SharingPageUiType
) &
    GenericWalletUiType;

type UIContext = {
    currentRequest: UIRequest | undefined;
    setRequest: (request: UIRequest | undefined) => void;
    clearRequest: () => void;
    translation: {
        lang?: "en" | "fr";
        t: (key: string, options?: TranslationOptions) => string;
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
    const resolvingContext = resolvingContextStore((state) => state.context);
    const backendSdkConfig = resolvingContextStore(
        (state) => state.backendSdkConfig
    );
    // The current UI request
    const [currentRequest, setCurrentRequest] = useState<UIRequest | undefined>(
        undefined
    );

    const { data: formattedReward } = useFormattedEstimatedReward({
        merchantId: resolvingContext?.merchantId,
        currency:
            currentRequest?.configMetadata?.currency ??
            backendSdkConfig?.currency,
        targetInteraction: currentRequest?.targetInteraction,
        context: currentRequest?.i18n?.context,
    });

    // Track pending clear timeout to prevent flashing on rapid close/open
    const clearTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Save the current request + display the iframe
    const setRequest = useCallback((request: UIRequest | undefined) => {
        // Cancel any pending clear operation
        if (clearTimeoutRef.current) {
            clearTimeout(clearTimeoutRef.current);
            clearTimeoutRef.current = null;
        }
        setCurrentRequest(request);
        emitLifecycleEvent({ iframeLifecycle: "show" });
    }, []);

    // Clear the current request + hide the iframe
    const clearRequest = useCallback(() => {
        // Cancel any existing clear timeout
        if (clearTimeoutRef.current) {
            clearTimeout(clearTimeoutRef.current);
        }

        emitLifecycleEvent({ iframeLifecycle: "hide" });

        // Delay clearing to prevent flashing on rapid close/open
        clearTimeoutRef.current = setTimeout(() => {
            setCurrentRequest(undefined);
            clearTimeoutRef.current = null;
        }, 50); // 50ms delay allows new requests to cancel the clear
    }, []);

    const placementCss = useMemo(() => {
        const placementId = currentRequest?.placement;
        if (!placementId) return undefined;
        return backendSdkConfig?.placements?.[placementId]?.css;
    }, [backendSdkConfig?.placements, currentRequest?.placement]);

    useEffect(() => {
        const styleId = "frak-placement-css";
        document.getElementById(styleId)?.remove();

        if (!placementCss) {
            return;
        }

        const style = document.createElement("style");
        style.id = styleId;
        style.textContent = placementCss;
        document.head.appendChild(style);

        return () => {
            style.remove();
        };
    }, [placementCss]);

    const populateI18nResources = useCallback(
        (i18n: i18n, lang: Language, request?: UIRequest) => {
            if (!request) return;

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

            const requestI18n =
                request.type === "embedded"
                    ? request.params.metadata?.i18n
                    : request.type === "sharing"
                      ? request.params.metadata?.i18n
                      : request.metadata.i18n;
            if (requestI18n) {
                mapI18nConfig(requestI18n, i18n);
            }

            const globalTranslations = backendSdkConfig?.translations;
            if (
                globalTranslations &&
                Object.keys(globalTranslations).length > 0
            ) {
                i18n.addResourceBundle(
                    lang,
                    "customized",
                    translationKeyPathToObject(globalTranslations),
                    true,
                    true
                );
            }

            addPlacementTranslations({
                i18n,
                lang,
                placement: request.placement,
                placements: backendSdkConfig?.placements,
            });
        },
        [backendSdkConfig?.translations, backendSdkConfig?.placements]
    );

    /**
     * Build the new translation context for the listener UI
     *  - Set the language to the request language
     *  - Add some default variable (product name, product origin, context)
     */
    const translation = useMemo(() => {
        // Get the language from the request or the detected language from the i18n instance
        const lang =
            currentRequest?.i18n?.lang ??
            backendSdkConfig?.lang ??
            (initialI18n.language as Language);
        const context = {
            productName: currentRequest?.appName,
            productOrigin: resolvingContext?.origin,
            context: currentRequest?.i18n?.context,
        };

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
        // Note: context variables (productName, productOrigin, estimatedReward) are already
        // provided via defaultVariables in the cloneInstance call above
        const rawT = i18n.getFixedT(lang, null);
        const t = (key: string, options?: TranslationOptions): string =>
            rawT(key, options);
        return { lang, i18n, t };
    }, [
        backendSdkConfig?.lang,
        currentRequest,
        resolvingContext?.origin,
        initialI18n,
        formattedReward,
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
 * Custom hook to get the listener ui context only when displaying a sharing page
 */
export function useSharingListenerUI() {
    const uiContext = useListenerUI();
    if (uiContext.currentRequest?.type !== "sharing") {
        throw new Error(
            "useSharingListenerUI must be used within a sharing page displayed UI"
        );
    }
    return uiContext as Omit<UIContext, "currentRequest"> & {
        currentRequest: SharingPageUiType & GenericWalletUiType;
    };
}

function addPlacementTranslations({
    i18n,
    lang,
    placement,
    placements,
}: {
    i18n: i18n;
    lang: Language;
    placement: string | undefined;
    placements: ResolvedSdkConfig["placements"];
}): void {
    if (!placement) return;

    const placementTranslations = placements?.[placement]?.translations;
    if (!placementTranslations) return;
    if (Object.keys(placementTranslations).length === 0) return;

    i18n.addResourceBundle(
        lang,
        "customized",
        translationKeyPathToObject(placementTranslations),
        true,
        true
    );
}

/**
 * Custom hooks to get only the translation context
 */
export const useListenerTranslation = () => useListenerUI().translation;
