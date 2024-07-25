import type { SuccessModalStepType } from "@frak-labs/nexus-sdk/core";
import { useCopyAddress } from "@module/hook/useCopyAddress";
import { prefixModalCss } from "@module/utils/prefixModalCss";
import { useMemo } from "react";

/**
 * The component for the success step of a modal
 * @param params
 * @param onFinish
 * @constructor
 */
export function SuccessModalStep({
    params,
    onFinish,
}: {
    params: SuccessModalStepType["params"];
    onFinish: (args: object) => void;
}) {
    const { metadata, sharingLink } = params;
    const { copied, copyAddress } = useCopyAddress();

    // Trigger the onFinish after a delay
    useMemo(() => {
        setTimeout(() => onFinish({}), 100);
    }, [onFinish]);

    return (
        <>
            {metadata?.description && (
                <div className={prefixModalCss("text")}>
                    <p>{metadata.description}</p>
                </div>
            )}
            {sharingLink?.baseLink && (
                <div className={prefixModalCss("buttons-wrapper")}>
                    <div>
                        <button
                            type={"button"}
                            className={prefixModalCss("button-primary")}
                            onClick={() => {
                                if (!sharingLink.baseLink) return;
                                copyAddress(sharingLink.baseLink);
                            }}
                        >
                            {copied ? "Copied!" : "Copy the current url"}
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}
