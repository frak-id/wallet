import { isModalDismissedAtom } from "@/module/listener/atoms/modalUtils";
import { FinalModalActionComponent } from "@/module/listener/component/Final/Action";
import type { FinalModalStepType } from "@frak-labs/nexus-sdk/core";
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
}: {
    params: FinalModalStepType["params"];
    onFinish: (args: object) => void;
}) {
    // Check if it was dismissed or not
    const isDismissed = useAtomValue(isModalDismissedAtom);

    return (
        <FinalModalActionComponent
            action={params.action}
            isSuccess={!isDismissed}
        />
    );
}
