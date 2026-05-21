import { Column } from "@frak-labs/design-system/components/Column";
import { Columns } from "@frak-labs/design-system/components/Columns";
import { Inline } from "@frak-labs/design-system/components/Inline";
import { ActionsMessageSuccess } from "@/module/campaigns/component/Actions";
import { Button } from "@/module/common/component/Button";

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
        <Columns space="xs" alignY="center">
            <Column width="1/2">
                {isSuccess && <ActionsMessageSuccess />}
            </Column>
            <Column width="1/2">
                <Inline space="s" align="right">
                    <Button
                        variant={"secondary"}
                        onClick={onDiscard}
                        disabled={isPending || !isDirty}
                    >
                        Discard Changes
                    </Button>
                    <Button
                        variant={"primary"}
                        onClick={onSubmit}
                        disabled={isPending || !isDirty}
                        loading={isPending}
                    >
                        Validate
                    </Button>
                </Inline>
            </Column>
        </Columns>
    );
}
