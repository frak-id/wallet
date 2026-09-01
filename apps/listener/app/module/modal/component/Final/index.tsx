import { FinalModalActionComponent } from "@/module/modal/component/Final/Action";

/**
 * The component for the final step of a modal
 */
export function FinalModalStep({
    onFinish,
}: {
    onFinish: (args: object) => void;
}) {
    return <FinalModalActionComponent onFinish={onFinish} />;
}
