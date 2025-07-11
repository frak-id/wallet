import { AlertDialog } from "@/module/common/component/AlertDialog";
import {
    formDescriptionVariants,
    formItemVariants,
    formLabelVariants,
} from "@/module/forms/Form";
import { Label } from "@/module/forms/Label";
import type { ManageTeamTableData } from "@/module/product/component/TableTeam/index";
import { useRemoveProductMember } from "@/module/product/hook/useRemoveProductMember";
import { permissionLabelsArray } from "@/module/product/utils/permissions";
import type { ProductRolesKey } from "@frak-labs/app-essentials";
import { Button } from "@frak-labs/ui/component/Button";
import { WalletAddress } from "@frak-labs/ui/component/HashDisplay";
import { Tooltip } from "@frak-labs/ui/component/Tooltip";
import { Checkbox } from "@frak-labs/ui/component/forms/Checkbox";
import type { CellContext } from "@tanstack/react-table";
import { Pencil, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import type { Hex } from "viem";

/**
 * Component representing the delete modal
 * @param row
 * @param productId
 * @param isRenouncing
 * @constructor
 */
export function DeleteTeamMemberModal({
    row,
    productId,
    isRenouncing,
}: Pick<CellContext<ManageTeamTableData, unknown>, "row"> & {
    productId: Hex;
    isRenouncing: boolean;
}) {
    const [open, setOpen] = useState(false);
    const {
        mutateAsync: onDeleteClick,
        isPending: isDeleting,
        isError,
    } = useRemoveProductMember();

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
                isRenouncing ? (
                    <>
                        Are you sure you want to renounce all of your
                        permissions on this product?
                    </>
                ) : (
                    <>
                        Are you sure you want to delete the user{" "}
                        <WalletAddress wallet={row.original.wallet} />
                        {}?
                    </>
                )
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
                            productId,
                            fullRemoval: true,
                            isRenouncing,
                            wallet: row.original.wallet,
                        });
                        setOpen(false);
                    }}
                >
                    {isRenouncing
                        ? "Renounce my permissions"
                        : "Delete this user"}
                </Button>
            }
        />
    );
}

/**
 * Component representing the delete modal
 * @param row
 * @param productId
 * @param isRenouncing
 * @constructor
 */
export function UpdateRoleTeamMemberModal({
    row,
    productId,
    isRenouncing,
}: Pick<CellContext<ManageTeamTableData, unknown>, "row"> & {
    productId: Hex;
    isRenouncing: boolean;
}) {
    const [open, setOpen] = useState(false);
    const {
        mutateAsync: onDeleteClick,
        isPending: isUpdatingPermissions,
        isError,
    } = useRemoveProductMember();

    // List of the initial permissions
    const initialPermissions = useMemo(
        () =>
            Object.entries(row.original.roleDetails).reduce<ProductRolesKey[]>(
                (acc, [role, value]) => {
                    if (role === "admin" || !value) return acc;
                    acc.push(role as ProductRolesKey);
                    return acc;
                },
                []
            ),
        [row]
    );

    // List of roles picked
    const [pickedRoles, setPickedRoles] =
        useState<ProductRolesKey[]>(initialPermissions);

    return (
        <AlertDialog
            open={open}
            onOpenChange={setOpen}
            title={"Update member permissions"}
            buttonElement={
                <button type={"button"}>
                    <Pencil size={20} absoluteStrokeWidth={true} />
                </button>
            }
            description={
                <>
                    {isRenouncing ? (
                        <p className={formDescriptionVariants()}>
                            Pick the permissions you want to renounce on this
                            product
                        </p>
                    ) : (
                        <>
                            <p className={formDescriptionVariants()}>
                                Pick the permissions you want to remove to the
                                user
                                <br />
                                <WalletAddress wallet={row.original.wallet} />
                            </p>
                        </>
                    )}
                    <br />
                    {permissionLabelsArray.map(({ id, label, description }) => (
                        <div
                            className={formItemVariants({
                                variant: "checkbox",
                            })}
                            key={id}
                            style={{ display: "flex" }}
                        >
                            <Checkbox
                                id={id}
                                disabled={
                                    // Disable the checkbox if the user is renouncing, he can't grant himself new permissions (it would fail on the blockchain side)
                                    isRenouncing &&
                                    !initialPermissions.includes(id)
                                }
                                checked={pickedRoles.includes(id)}
                                onCheckedChange={(checked) => {
                                    setPickedRoles((prev) =>
                                        checked
                                            ? [...prev, id]
                                            : prev.filter((role) => role !== id)
                                    );
                                }}
                            />
                            <Tooltip content={description}>
                                <Label
                                    htmlFor={id}
                                    className={formLabelVariants({
                                        variant: "checkbox",
                                    })}
                                >
                                    {label}
                                </Label>
                            </Tooltip>
                        </div>
                    ))}
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
                    isLoading={isUpdatingPermissions}
                    disabled={isUpdatingPermissions}
                    onClick={async () => {
                        await onDeleteClick({
                            productId,
                            isRenouncing,
                            wallet: row.original.wallet,
                            fullRemoval: false,
                            rolesToDelete: pickedRoles,
                        });
                        setOpen(false);
                    }}
                >
                    {isRenouncing
                        ? "Renounce permissions"
                        : "Update permissions"}
                </Button>
            }
        />
    );
}
