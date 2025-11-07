import type { FinalModalStepType } from "@frak-labs/core-sdk";
import { FinalModalActionComponent } from "@/module/modal/component/Final/Action";
import { modalStore, selectIsDismissed } from "@/module/stores/modalStore";

/**
 * The component for the final step of a modal
 * @param appName
 * @param params
 * @param onFinish
 * @constructor
 */
export function FinalModalStep({
    params,
    onFinish,
}: {
    params: FinalModalStepType["params"];
    onFinish: (args: object) => void;
}) {
    // Check if it was dismissed or not
    const isDismissed = modalStore(selectIsDismissed);

    return (
        <FinalModalActionComponent
            action={params.action}
            onFinish={onFinish}
            isSuccess={!isDismissed}
        />
    );
}
