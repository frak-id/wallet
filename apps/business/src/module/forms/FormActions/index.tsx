import { Button } from "@frak-labs/ui/component/Button";
import { Column, Columns } from "@frak-labs/ui/component/Columns";
import { ActionsMessageSuccess } from "@/module/campaigns/component/Actions";

type FormActionsProps = {
    isSuccess: boolean;
    isPending: boolean;
    isDirty: boolean;
    onDiscard: () => void;
    onSubmit: () => void;
};

export function FormActions({
    isSuccess,
    isPending,
    isDirty,
    onDiscard,
    onSubmit,
}: FormActionsProps) {
    return (
        <Columns>
            <Column>{isSuccess && <ActionsMessageSuccess />}</Column>
            <Column>
                <Button
                    variant={"informationOutline"}
                    onClick={onDiscard}
                    disabled={isPending || !isDirty}
                >
                    Discard Changes
                </Button>
                <Button
                    variant={"submit"}
                    onClick={onSubmit}
                    disabled={isPending || !isDirty}
                    isLoading={isPending}
                >
                    Validate
                </Button>
            </Column>
        </Columns>
    );
}
