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
    setIsSubscribed: (value: boolean) => void;
    adapter: NotificationAdapter;
};

const NotificationContext = createContext<NotificationContextValue | null>(
    null
);

export function NotificationProvider({ children }: PropsWithChildren) {
    const [isSubscribed, setIsSubscribed] = useState(false);
    const adapter = useMemo(() => getNotificationAdapter(), []);

    const value = useMemo(
        () => ({ isSubscribed, setIsSubscribed, adapter }),
        [isSubscribed, adapter]
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
