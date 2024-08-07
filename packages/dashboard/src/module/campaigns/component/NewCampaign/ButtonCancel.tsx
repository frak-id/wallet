import { campaignResetAtom } from "@/module/campaigns/atoms/campaign";
import { Button } from "@module/component/Button";
import { useSetAtom } from "jotai/index";
import { X } from "lucide-react";

export function ButtonCancel() {
    const campaignReset = useSetAtom(campaignResetAtom);

    return (
        <Button
            variant={"outline"}
            leftIcon={<X size={20} />}
            onClick={() => campaignReset()}
        >
            Cancel
        </Button>
    );
}
