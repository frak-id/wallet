import { Button } from "@frak-labs/ui/component/Button";
import { WalletAddress } from "@frak-labs/ui/component/HashDisplay";
import type { CellContext } from "@tanstack/react-table";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { AlertDialog } from "@/module/common/component/AlertDialog";
import type { ManageTeamTableData } from "@/module/merchant/component/TableTeam/index";
import { useRemoveAdmin } from "@/module/merchant/hook/useRemoveAdmin";

export function DeleteTeamMemberModal({
    row,
    merchantId,
}: Pick<CellContext<ManageTeamTableData, unknown>, "row"> & {
    merchantId: string;
}) {
    const [open, setOpen] = useState(false);
    const {
        mutateAsync: onDeleteClick,
        isPending: isDeleting,
        isError,
    } = useRemoveAdmin();

    return (
        <AlertDialog
            open={open}
            onOpenChange={setOpen}
            title={"Delete member"}
            buttonElement={
                <button type={"button"}>
                    <Trash2 size={20} absoluteStrokeWidth={true} />
                </button>
            }
            description={
                <>
                    Are you sure you want to delete the user{" "}
                    <WalletAddress wallet={row.original.wallet} />?
                </>
            }
            text={
                isError ? (
                    <p className={"error"}>An error occurred, try again</p>
                ) : undefined
            }
            cancel={<Button variant={"outline"}>Cancel</Button>}
            action={
                <Button
                    variant={"danger"}
                    isLoading={isDeleting}
                    disabled={isDeleting}
                    onClick={async () => {
                        await onDeleteClick({
                            merchantId,
                            wallet: row.original.wallet,
                        });
                        setOpen(false);
                    }}
                >
                    Delete this user
                </Button>
            }
        />
    );
}
