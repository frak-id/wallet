import styles from "@/module/listener/component/Modal/index.module.css";
import type { FinalDismissedModalStepType } from "@frak-labs/nexus-sdk/core";
import { prefixModalCss } from "@module/utils/prefixModalCss";
import { FinalModalComponent } from "../FinalModal";

/**
 * The component for the dismissed step of a modal
 * @param appName
 * @param params
 * @param onFinish
 * @constructor
 */
export function DismissedModalStep({
    appName,
    params,
}: {
    appName: string;
    params: FinalDismissedModalStepType["params"];
    onFinish: (args: object) => void;
}) {
    const { metadata, action } = params;

    return (
        <>
            {metadata?.description && (
                <div
                    className={`${styles.modalListener__text} ${prefixModalCss("text")}`}
                >
                    <p>{metadata.description}</p>
                </div>
            )}
            <FinalModalComponent
                appName={appName}
                action={action}
                isSuccess={false}
            />
        </>
    );
}
