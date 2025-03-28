import { isModalDismissedAtom } from "@/module/listener/modal/atoms/modalUtils";
import { FinalModalActionComponent } from "@/module/listener/modal/component/Final/Action";
import type { FinalModalStepType } from "@frak-labs/core-sdk";
import { useAtomValue } from "jotai";

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
    const isDismissed = useAtomValue(isModalDismissedAtom);

    return (
        <FinalModalActionComponent
            action={params.action}
            onFinish={onFinish}
            isSuccess={!isDismissed}
        />
    );
}
