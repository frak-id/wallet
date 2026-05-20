import { X } from "lucide-react";
import { type ReactNode, useState } from "react";
import { AlertDialog } from "@/module/common/component/AlertDialog";
import { Button } from "@/module/common/component/Button";

export function ButtonWithConfirmationAlert({
    description,
    buttonText = "Cancel",
    title = "Cancel",
    onClick,
    disabled,
}: {
    description: ReactNode;
    buttonText?: ReactNode;
    title?: ReactNode;
    onClick: () => void;
    disabled?: boolean;
}) {
    const [open, setOpen] = useState(false);

    return (
        <AlertDialog
            open={open}
            onOpenChange={setOpen}
            title={title}
            buttonElement={
                <Button
                    variant={"secondary"}
                    icon={<X size={20} />}
                    disabled={disabled}
                >
                    {buttonText}
                </Button>
            }
            description={description}
            action={
                <Button
                    variant={"destructive"}
                    onClick={() => {
                        onClick?.();
                        setOpen(false);
                    }}
                >
                    {buttonText}
                </Button>
            }
        />
    );
}
