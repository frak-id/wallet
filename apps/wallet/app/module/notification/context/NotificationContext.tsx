import {
    createContext,
    type PropsWithChildren,
    useContext,
    useMemo,
    useState,
} from "react";

type NotificationContextValue = {
    subscription: PushSubscription | undefined;
    setSubscription: (subscription: PushSubscription | undefined) => void;
    clearSubscription: () => void;
};

const NotificationContext = createContext<NotificationContextValue | null>(
    null
);

export function NotificationProvider({ children }: PropsWithChildren) {
    const [subscription, setSubscription] = useState<
        PushSubscription | undefined
    >();

    const value = useMemo(
        () => ({
            subscription,
            setSubscription,
            clearSubscription: () => setSubscription(undefined),
        }),
        [subscription]
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
