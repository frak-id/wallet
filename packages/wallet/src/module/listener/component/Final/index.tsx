import { isDismissedAtom } from "@/module/listener/atoms/modalEvents";
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
    appName,
    params,
}: {
    appName: string;
    params: FinalModalStepType["params"];
    onFinish: (args: object) => void;
}) {
    // Check if it was dismissed or not
    const isDismissed = useAtomValue(isDismissedAtom);

    return (
        <FinalModalActionComponent
            appName={appName}
            action={params.action}
            isSuccess={!isDismissed}
        />
    );
}
