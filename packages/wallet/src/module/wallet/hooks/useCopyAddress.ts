"use client";

import { useCopyToClipboard } from "@uidotdev/usehooks";
import { useEffect, useState } from "react";

export function useCopyAddress() {
    const [copied, setCopied] = useState(false);
    const [, copyToClipboard] = useCopyToClipboard();

    useEffect(() => {
        if (copied) {
            setTimeout(() => {
                setCopied(false);
            }, 2000);
        }
    }, [copied]);

    function copyAddress(wallet: string) {
        if (!copied) {
            copyToClipboard(wallet);
            setCopied(true);
        }
    }

    return {
        copied,
        copyAddress,
    };
}
