"use client";

import { Loading } from "@/module/common/component/Loading";
import { NotConnected } from "@/module/common/component/NotConnected";
import { useWalletStatus } from "@frak-labs/nexus-sdk/react";
import type { ReactNode } from "react";

export function AuthProvider({
    children,
}: Readonly<{
    children: ReactNode;
}>) {
    const { data: walletStatus, isPending } = useWalletStatus();

    if (isPending || walletStatus?.key === "waiting-response") {
        return <Loading />;
    }

    if (walletStatus?.key === "connected") {
        return <>{children}</>;
    }

    return <NotConnected />;
}
