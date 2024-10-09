import styles from "@/module/listener/component/Modal/index.module.css";
import type { SuccessModalStepType } from "@frak-labs/nexus-sdk/core";
import { prefixModalCss } from "@module/utils/prefixModalCss";
import { SharingButtons } from "../SharingButtons";

/**
 * The component for the success step of a modal
 * @param appName
 * @param params
 * @param onFinish
 * @constructor
 */
export function SuccessModalStep({
    appName,
    params,
}: {
    appName: string;
    params: SuccessModalStepType["params"];
    onFinish: (args: object) => void;
}) {
    const { metadata, sharing } = params;

    return (
        <>
            {metadata?.description && (
                <div
                    className={`${styles.modalListener__text} ${prefixModalCss("text")}`}
                >
                    <p>{metadata.description}</p>
                </div>
            )}
            <div
                className={`${styles.modalListener__buttonsWrapper} ${prefixModalCss("buttons-wrapper")}`}
            >
                <SharingButtons appName={appName} {...sharing} />
            </div>
        </>
    );
}
