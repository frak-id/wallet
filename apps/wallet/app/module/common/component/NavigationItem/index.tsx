import type { PropsWithChildren } from "react";

type NavigationProps = {
    url: string;
};

export function NavigationItem({
    children,
    url,
}: PropsWithChildren<NavigationProps>) {
    // Replaced by AppShell.
    void children;
    void url;
    return null;
}
