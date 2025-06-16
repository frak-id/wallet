import { useCopyToClipboard } from "@uidotdev/usehooks";
import { useEffect, useState } from "react";

export function useCopyToClipboardWithState() {
    const [copied, setCopied] = useState(false);
    const [, copyToClipboard] = useCopyToClipboard();

    useEffect(() => {
        if (copied) {
            setTimeout(() => {
                setCopied(false);
            }, 2000);
        }
    }, [copied]);

    function copy(wallet: string) {
        if (!copied) {
            copyToClipboard(wallet);
            setCopied(true);
        }
    }

    return {
        copied,
        copy,
    };
}
