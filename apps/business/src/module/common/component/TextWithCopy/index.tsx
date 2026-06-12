import { CheckIcon, CopyIcon } from "@frak-labs/design-system/icons";
import type { PropsWithChildren } from "react";
import { useCopyToClipboardWithState } from "@/module/common/hook/useCopyToClipboardWithState";
import { container, trigger } from "./text-with-copy.css";

export function TextWithCopy({
    text,
    children,
}: PropsWithChildren<{ text?: string }>) {
    const { copied, copy } = useCopyToClipboardWithState();

    if (!text) return null;

    return (
        <div className={container}>
            {children}
            <button
                type="button"
                className={trigger}
                onClick={() => copy(text)}
                aria-label="Copy to clipboard"
            >
                {copied ? (
                    <CheckIcon width={16} height={16} />
                ) : (
                    <CopyIcon width={16} height={16} />
                )}
            </button>
        </div>
    );
}
