import type { RolesKeys } from "@/context/blockchain/roles";
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
import { useIsProductOwner } from "@/module/product/hook/useIsProductOwner";
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
import {
    type UseControllerProps,
    useForm,
    useFormContext,
} from "react-hook-form";
import { type Address, isAddress } from "viem";
import styles from "./index.module.css";

type FormAddTeamMembers = {
    wallet?: Address;
    permissions: RolesKeys[];
};

/**
 * List of available permissions with label + description
 */
const availablePermissions: {
    id: RolesKeys;
    label: string;
    description: string;
}[] = [
    {
        id: "productManager",
        label: "Product manager",
        description:
            "Product manager can manage the interaction contract and update it.",
    },
    {
        id: "campaignManager",
        label: "Campaign manager",
        description:
            "Campaign manager can deploy campaigns, put them on standby, and delete them.",
    },
];

export function ButtonAddTeam({
    productId,
    children,
}: PropsWithChildren<{ productId: bigint }>) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const { data: isProductOwner } = useIsProductOwner({ productId });
    const {
        mutateAsync: addProductMember,
        isPending: isAddingMember,
        error,
    } = useAddProductMember();

    const form = useForm<FormAddTeamMembers>({
        defaultValues: {
            permissions: ["productManager", "campaignManager"],
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

    /**
     * Directly exit if the user isn't the owner
     */
    if (!isProductOwner) return null;

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
                            <FormWallet
                                control={form.control}
                                name={"wallet"}
                                disabled={isAddingMember}
                            />
                            <FormPermissions
                                control={form.control}
                                name={"permissions"}
                                disabled={isAddingMember}
                            />
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
function FormWallet(props: UseControllerProps<FormAddTeamMembers, "wallet">) {
    const { trigger } = useFormContext();
    // on mount trigger a wallet field verification
    useEffect(() => {
        trigger("wallet");
    }, [trigger]);

    return (
        <>
            <FormField
                control={props.control}
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
                                />
                                <Button
                                    variant={"submit"}
                                    disabled={props.disabled}
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
function FormPermissions(
    props: UseControllerProps<FormAddTeamMembers, "permissions">
) {
    return (
        <>
            <FormField
                control={props.control}
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
                            title={"Permissions"}
                            className={styles.formPermission__description}
                            classNameTitle={
                                styles.formPermission__descriptionTitle
                            }
                        >
                            Choose the permission for the new operator.
                        </FormDescription>
                        {availablePermissions.map(
                            ({ id, label, description }) => {
                                return (
                                    <FormItem variant={"checkbox"} key={id}>
                                        <FormControl>
                                            <Checkbox
                                                checked={field?.value?.includes(
                                                    id
                                                )}
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
