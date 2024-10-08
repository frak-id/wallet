import { AlertDialog } from "@/module/common/component/AlertDialog";
import { Row } from "@/module/common/component/Row";
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
    FormValidMessage,
} from "@/module/forms/Form";
import { useAddProductMember } from "@/module/product/hook/useAddProductMember";
import { permissionLabelsArray } from "@/module/product/utils/permissions";
import type { ProductRolesKey } from "@frak-labs/app-essentials";
import { Button } from "@module/component/Button";
import { Tooltip } from "@module/component/Tooltip";
import { Checkbox } from "@module/component/forms/Checkbox";
import { Input } from "@module/component/forms/Input";
import { BadgeCheck } from "lucide-react";
import {
    type PropsWithChildren,
    useCallback,
    useEffect,
    useState,
} from "react";
import { useForm, useFormContext } from "react-hook-form";
import { type Address, type Hex, isAddress } from "viem";
import styles from "./index.module.css";

type FormAddTeamMembers = {
    wallet?: Address;
    permissions: ProductRolesKey[];
};

export function ButtonAddTeam({
    productId,
    children,
}: PropsWithChildren<{ productId: Hex }>) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const {
        mutateAsync: addProductMember,
        isPending: isAddingMember,
        error,
    } = useAddProductMember();

    const form = useForm<FormAddTeamMembers>({
        defaultValues: {
            permissions: ["interactionManager", "campaignManager"],
        },
    });

    /**
     * Reset the form and the atoms when the modal is closed
     */
    useEffect(() => {
        if (isModalOpen) return;
        form.reset();
    }, [isModalOpen, form.reset]);

    const onSubmit = useCallback(
        async (data: FormAddTeamMembers) => {
            if (!data.wallet) return;
            // Trigger the product adding
            await addProductMember({
                productId,
                wallet: data.wallet,
                roles: data.permissions,
            });
            // Close the modal
            setIsModalOpen(false);
        },
        [addProductMember, productId]
    );

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
                <AlertDialog
                    open={isModalOpen}
                    onOpenChange={setIsModalOpen}
                    title={
                        <>
                            <BadgeCheck color={"#0DDB84"} /> Add a new member
                        </>
                    }
                    buttonElement={children}
                    showCloseButton={false}
                    text={
                        <>
                            {isAddingMember && (
                                <p>
                                    Adding the new member to the product
                                    <span className={"dotsLoading"}>...</span>
                                </p>
                            )}
                            <FormWallet disabled={isAddingMember} />
                            <FormPermissions disabled={isAddingMember} />
                            {error && (
                                <p>
                                    Error when adding the operator on your
                                    product: {error.message}
                                </p>
                            )}
                        </>
                    }
                    cancel={
                        <Button variant={"outline"} disabled={isAddingMember}>
                            Cancel
                        </Button>
                    }
                    action={
                        <Button
                            variant={"submit"}
                            disabled={!form.formState.isValid || isAddingMember}
                            onClick={form.handleSubmit(onSubmit)}
                        >
                            Add Member
                        </Button>
                    }
                />
            </form>
        </Form>
    );
}

/**
 * Initial form to add wallet address
 * @constructor
 */
function FormWallet({ disabled }: { disabled: boolean }) {
    const { trigger, control } = useFormContext<FormAddTeamMembers>();
    // on mount trigger a wallet field verification
    useEffect(() => {
        trigger("wallet");
    }, [trigger]);

    return (
        <>
            <FormField
                control={control}
                name="wallet"
                rules={{
                    required: "Wallet address required",
                    validate: {
                        required: (value) =>
                            (value && isAddress(value)) ||
                            "Invalid wallet address",
                    },
                }}
                render={({ field }) => (
                    <FormItem>
                        <FormLabel weight={"medium"}>
                            Enter your Member Wallet
                        </FormLabel>
                        <FormControl>
                            <Row>
                                <Input
                                    length={"medium"}
                                    placeholder={"Wallet Address...."}
                                    {...field}
                                    value={field.value ?? ""}
                                />
                                <Button
                                    variant={"submit"}
                                    disabled={disabled}
                                    onClick={() => {
                                        trigger("wallet");
                                    }}
                                >
                                    Verify
                                </Button>
                            </Row>
                        </FormControl>
                        <FormMessage />
                        <FormValidMessage>
                            The new member is ready to be added
                        </FormValidMessage>
                    </FormItem>
                )}
            />
        </>
    );
}

/**
 * Initial form to add wallet permissions
 * @constructor
 */
function FormPermissions({ disabled }: { disabled: boolean }) {
    const { control } = useFormContext<FormAddTeamMembers>();

    return (
        <>
            <FormField
                control={control}
                name="permissions"
                rules={{
                    required: "Select a permission",
                    validate: {
                        required: (value) =>
                            value?.length > 0 || "Select a permission",
                    },
                }}
                render={({ field }) => (
                    <FormItem>
                        <FormDescription
                            label={"Permissions"}
                            className={styles.formPermission__description}
                            classNameTitle={
                                styles.formPermission__descriptionTitle
                            }
                        >
                            Choose the permission for the new operator.
                        </FormDescription>
                        {permissionLabelsArray.map(
                            ({ id, label, description }) => {
                                return (
                                    <FormItem variant={"checkbox"} key={id}>
                                        <FormControl>
                                            <Checkbox
                                                checked={field?.value?.includes(
                                                    id
                                                )}
                                                disabled={disabled}
                                                onCheckedChange={(checked) => {
                                                    return checked
                                                        ? field.onChange([
                                                              ...field.value,
                                                              id,
                                                          ])
                                                        : field.onChange(
                                                              field?.value?.filter(
                                                                  (value) =>
                                                                      value !==
                                                                      id
                                                              )
                                                          );
                                                }}
                                                {...field}
                                            />
                                        </FormControl>
                                        <Tooltip
                                            content={description}
                                            className={"tooltipPermissions"}
                                        >
                                            <FormLabel
                                                variant={"checkbox"}
                                                selected={field?.value?.includes(
                                                    id
                                                )}
                                            >
                                                {label}
                                            </FormLabel>
                                        </Tooltip>
                                    </FormItem>
                                );
                            }
                        )}
                        <FormMessage />
                    </FormItem>
                )}
            />
        </>
    );
}
