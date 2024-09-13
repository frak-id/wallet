import { AlertDialog } from "@/module/common/component/AlertDialog";
import { Button } from "@module/component/Button";
import { X } from "lucide-react";
import { type ReactNode, useState } from "react";

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
                    variant={"outline"}
                    leftIcon={<X size={20} />}
                    disabled={disabled}
                >
                    {buttonText}
                </Button>
            }
            description={description}
            action={
                <Button
                    variant={"danger"}
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
