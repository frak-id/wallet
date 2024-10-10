import { isDismissedAtom } from "@/module/listener/atoms/modalEvents";
import { FinalModalActionComponent } from "@/module/listener/component/Final/Action";
import styles from "@/module/listener/component/Modal/index.module.css";
import type { FinalModalStepType } from "@frak-labs/nexus-sdk/core";
import { prefixModalCss } from "@module/utils/prefixModalCss";
import { useAtomValue } from "jotai";

/**
 * The component for the final step of a modal
 * @param appName
 * @param params
 * @param onFinish
 * @constructor
 */
export function FinalModalStep({
    appName,
    params,
}: {
    appName: string;
    params: FinalModalStepType["params"];
    onFinish: (args: object) => void;
}) {
    const { metadata, action } = params;
    // Check if it was dismissed or not
    const isDismissed = useAtomValue(isDismissedAtom);

    return (
        <>
            {metadata?.description && (
                <div
                    className={`${styles.modalListener__text} ${prefixModalCss("text")}`}
                >
                    <p>{metadata.description}</p>
                </div>
            )}
            <FinalModalActionComponent
                appName={appName}
                action={action}
                isSuccess={!isDismissed}
            />
        </>
    );
}
