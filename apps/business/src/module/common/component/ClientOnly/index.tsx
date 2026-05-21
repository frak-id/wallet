import { type FC, type ReactNode, useEffect, useState } from "react";

function useIsClient() {
    const [isClient, setIsClient] = useState(false);
    useEffect(() => {
        setIsClient(true);
    }, []);
    return isClient;
}

export const ClientOnly: FC<{ children: ReactNode }> = ({ children }) => {
    const isClient = useIsClient();
    return isClient ? children : null;
};
