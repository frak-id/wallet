import { campaignResetAtom } from "@/module/campaigns/atoms/campaign";
import { Button } from "@module/component/Button";
import { useSetAtom } from "jotai";
import { X } from "lucide-react";

export function ButtonCancel({
    onClick,
    disabled,
}: { onClick: () => void; disabled?: boolean }) {
    const campaignReset = useSetAtom(campaignResetAtom);

    return (
        <Button
            variant={"outline"}
            leftIcon={<X size={20} />}
            onClick={() => {
                campaignReset();
                onClick?.();
            }}
            disabled={disabled}
        >
            Cancel
        </Button>
    );
}
