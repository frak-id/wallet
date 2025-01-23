import { getIFrameResolvingContext } from "@/context/sdk/utils/iframeContext";
import type { DisplayEmbededWalletParamsType } from "@frak-labs/core-sdk";
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
    appName?: string;
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
type ModalUiType = {
    type: "modal";
};

type UIRequest = (EmbededWalletUiType | ModalUiType) & GenericWalletUiType;

/**
 * Context for the different type of UI we can display
 */
export const ListenerUiContext = createContext<
    | {
          currentRequest: UIRequest | undefined;
          setRequest: (request: UIRequest | undefined) => void;
          clearRequest: () => void;
          translation: {
              t: (key: string, options?: TOptions) => string;
              i18n: i18n;
          };
      }
    | undefined
>(undefined);

/**
 * Provider for the listener UI
 *  - Will directly display either modal or embeded wallet
 *  - Keep the state of either modal or embeded wallet in a shared context accessible with hooks
 */
export function ListenerUiProvider({ children }: PropsWithChildren) {
    const { i18n: initialI18n } = useTranslation();
    const resolvingContext = useMemo(() => getIFrameResolvingContext(), []);
    const { estimatedReward } = useEstimatedInteractionReward({
        resolvingContext,
    });

    const [currentRequest, setCurrentRequest] = useState<UIRequest | undefined>(
        undefined
    );

    const setRequest = useCallback((request: UIRequest | undefined) => {
        setCurrentRequest(request);
    }, []);

    const clearRequest = useCallback(() => {
        setCurrentRequest(undefined);
    }, []);

    /**
     * Build the new translation context for the listener UI
     *  - Set the language to the request language
     *  - Add some default variable (estimated reward, product name, product origin, context)
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

        const i18n = initialI18n.cloneInstance({
            lng: lang,
            interpolation: {
                defaultVariables: {
                    ...context,
                    estimatedReward,
                },
            },
        });
        const rawT = i18n.getFixedT(lang, null) as typeof i18n.t;
        const t = (key: string, options?: TOptions): string =>
            rawT(key, {
                ...context,
                ...options,
                estimatedReward,
            });
        return { i18n, t };
    }, [currentRequest, resolvingContext, estimatedReward, initialI18n]);

    return (
        <ListenerUiContext.Provider
            value={{ currentRequest, setRequest, clearRequest, translation }}
        >
            {children}
        </ListenerUiContext.Provider>
    );
}

/**
 * Access the top level listener UI context
 */
export const useListenerUI = () => {
    const context = useContext(ListenerUiContext);
    if (!context) {
        throw new Error(
            "useListenerUI must be used within a ListenerUiContext"
        );
    }
    return context;
};

export const useListenerTranslation = () => {
    const { translation } = useListenerUI();
    return translation;
};
