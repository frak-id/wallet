import type { DisplayEmbededWalletParamsType } from "@frak-labs/core-sdk";
import {
    type PropsWithChildren,
    createContext,
    useContext,
    useState,
} from "react";

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

type UIRequest = EmbededWalletUiType | ModalUiType;

/**
 * Context for the different type of UI we can display
 */
export const ListenerUiContext = createContext<
    | {
          currentRequest: UIRequest | undefined;
          setRequest: (request: UIRequest | undefined) => void;
          clearRequest: () => void;
      }
    | undefined
>(undefined);

/**
 * Provider for the listener UI
 *  - Will directly display either modal or embeded wallet
 *  - Keep the state of either modal or embeded wallet in a shared context accessible with hooks
 */
export function ListenerUiProvider({ children }: PropsWithChildren) {
    const [currentRequest, setCurrentRequest] = useState<UIRequest | undefined>(
        undefined
    );

    const setRequest = (request: UIRequest | undefined) => {
        setCurrentRequest(request);
    };

    const clearRequest = () => {
        setCurrentRequest(undefined);
    };

    return (
        <ListenerUiContext.Provider
            value={{ currentRequest, setRequest, clearRequest }}
        >
            {children}
        </ListenerUiContext.Provider>
    );
}
export const useListenerUI = () => {
    const context = useContext(ListenerUiContext);
    if (!context) {
        throw new Error(
            "useListenerUI must be used within a ListenerUiContext"
        );
    }
    return context;
};
