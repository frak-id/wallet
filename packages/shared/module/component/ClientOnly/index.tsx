"use client";

import { type FC, type ReactNode, useEffect, useState } from "react";

type ClientOnlyProps = {
    children: ReactNode;
};

function useIsClient() {
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        setIsClient(true);
    }, []);

    return isClient;
}

/**
 * Hack to work around next.js hydration
 * @see https://github.com/uidotdev/usehooks/issues/218
 */
export const ClientOnly: FC<ClientOnlyProps> = ({ children }) => {
    const isClient = useIsClient();

    // Render children if on client side, otherwise return null
    return isClient ? <>{children}</> : null;
};
