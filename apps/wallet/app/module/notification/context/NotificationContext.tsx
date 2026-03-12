import {
    getNotificationAdapter,
    type NotificationAdapter,
} from "@frak-labs/wallet-shared";
import {
    createContext,
    type PropsWithChildren,
    useContext,
    useMemo,
    useState,
} from "react";

type NotificationContextValue = {
    isSubscribed: boolean;
    isInitialized: boolean;
    setIsSubscribed: (value: boolean) => void;
    setIsInitialized: (value: boolean) => void;
    adapter: NotificationAdapter;
};

const NotificationContext = createContext<NotificationContextValue | null>(
    null
);

export function NotificationProvider({ children }: PropsWithChildren) {
    const [isSubscribed, setIsSubscribed] = useState(false);
    const [isInitialized, setIsInitialized] = useState(false);
    const adapter = useMemo(() => getNotificationAdapter(), []);

    const value = useMemo(
        () => ({
            isSubscribed,
            isInitialized,
            setIsSubscribed,
            setIsInitialized,
            adapter,
        }),
        [isSubscribed, isInitialized, adapter]
    );

    return (
        <NotificationContext.Provider value={value}>
            {children}
        </NotificationContext.Provider>
    );
}

export function useNotificationContext() {
    const context = useContext(NotificationContext);
    if (!context) {
        throw new Error(
            "useNotificationContext must be used within NotificationProvider"
        );
    }
    return context;
}
