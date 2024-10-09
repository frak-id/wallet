import { modalStepsAtom } from "@/module/listener/atoms/modalEvents";
import styles from "@/module/listener/component/Modal/index.module.css";
import type { NotRewardedModalStepType } from "@frak-labs/nexus-sdk/core";
import { jotaiStore } from "@module/atoms/store";
import { prefixModalCss } from "@module/utils/prefixModalCss";
import { useAtomValue } from "jotai";
import { SharingButtons } from "../SharingButtons";

/**
 * The component for the not rewarded step of a modal
 * @param appName
 * @param params
 * @param onFinish
 * @constructor
 */
export function NotRewardedModalStep({
    appName,
    params,
}: {
    appName: string;
    params: NotRewardedModalStepType["params"];
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
                <SharingButtons
                    shareWithFrak={false}
                    appName={appName}
                    {...sharing}
                />
            </div>
        </>
    );
}

/**
 * The button for the not rewarded step of a modal
 * @constructor
 */
export function NotRewardedModalStepButton() {
    const modalSteps = useAtomValue(modalStepsAtom);
    const notRewardedIndex = modalSteps?.steps?.findIndex(
        (step) => step.key === "notRewarded"
    );

    if (!(modalSteps && notRewardedIndex) || notRewardedIndex === -1)
        return null;

    const {
        params: { metadata },
    } = modalSteps.steps[notRewardedIndex];

    return (
        <button
            type={"button"}
            className={`${styles.modalListener__buttonLink} ${prefixModalCss("button-link")}`}
            onClick={() => {
                // Go to the not rewarded step
                jotaiStore.set(modalStepsAtom, (current) => {
                    if (!current) return null;
                    return {
                        ...current,
                        currentStep: notRewardedIndex,
                    };
                });
            }}
        >
            {metadata?.primaryActionText ?? "Continue without being rewarded"}
        </button>
    );
}
