import { campaignResetAtom } from "@/module/campaigns/atoms/campaign";
import { AlertDialog } from "@/module/common/component/AlertDialog";
import { Button } from "@module/component/Button";
import { useSetAtom } from "jotai";
import { X } from "lucide-react";
import { useState } from "react";

export function ButtonCancel({
    onClick,
    disabled,
}: { onClick: () => void; disabled?: boolean }) {
    const campaignReset = useSetAtom(campaignResetAtom);
    const [open, setOpen] = useState(false);

    return (
        <AlertDialog
            open={open}
            onOpenChange={setOpen}
            title={"Cancel campaign"}
            buttonElement={
                <Button
                    variant={"outline"}
                    leftIcon={<X size={20} />}
                    disabled={disabled}
                >
                    Cancel
                </Button>
            }
            description={
                <>
                    Are you sure you want to cancel the campaign ?<br />
                    Form will be reset to its initial state.
                </>
            }
            action={
                <Button
                    variant={"danger"}
                    onClick={() => {
                        campaignReset();
                        onClick?.();
                        setOpen(false);
                        window.location.href = "/campaigns/list";
                    }}
                >
                    Cancel campaign
                </Button>
            }
        />
    );
}
