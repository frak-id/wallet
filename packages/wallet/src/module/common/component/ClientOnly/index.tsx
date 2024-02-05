"use client";

import { useIsClient } from "@uidotdev/usehooks";
import type { FC, ReactNode } from "react";

type ClientOnlyProps = {
    children: ReactNode;
};

/**
 * Hack to work around next.js hydration
 * @see https://github.com/uidotdev/usehooks/issues/218
 */
export const ClientOnly: FC<ClientOnlyProps> = ({ children }) => {
    const isClient = useIsClient();

    // Render children if on client side, otherwise return null
    return isClient ? <>{children}</> : null;
};
