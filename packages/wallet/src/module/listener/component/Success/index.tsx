import type { SuccessModalStepType } from "@frak-labs/nexus-sdk/core";
import { useCopyAddress } from "@module/hook/useCopyAddress";
import { prefixModalCss } from "@module/utils/prefixModalCss";

/**
 * The component for the success step of a modal
 * @param params
 * @constructor
 */
export function SuccessModalStep({
    params,
}: {
    params: SuccessModalStepType["params"];
}) {
    const { metadata, sharingLink } = params;
    const { copied, copyAddress } = useCopyAddress();

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
