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
} from "@/module/forms/Form";
import { useIsProductOwner } from "@/module/product/hook/useIsProductOwner";
import { Button } from "@module/component/Button";
import { Checkbox } from "@module/component/forms/Checkbox";
import { Input } from "@module/component/forms/Input";
import { atom, useAtom, useAtomValue, useSetAtom } from "jotai";
import { BadgeCheck } from "lucide-react";
import { type PropsWithChildren, useEffect } from "react";
import { useForm } from "react-hook-form";
import type { UseFormReturn } from "react-hook-form";
import { isAddress } from "viem";
import styles from "./index.module.css";

type FormWallet = {
    wallet: string;
};

type FormPermissions = {
    permissions: string[];
};

const isModalOpenAtom = atom(false);
const walletAtom = atom<string | undefined>();
const resetAtom = atom(null, (_get, set) => {
    set(walletAtom, undefined);
});

const availablePermissions = [
    {
        id: "productManager",
        label: "Product manager",
    },
    {
        id: "campaignManager",
        label: "Campaign manager",
    },
];

export function ButtonAddTeam({
    productId,
    children,
}: PropsWithChildren<{ productId: bigint }>) {
    const [isModalOpen, setIsModalOpen] = useAtom(isModalOpenAtom);
    const wallet = useAtomValue(walletAtom);
    const { data: isProductOwner } = useIsProductOwner({ productId });
    const resetAtoms = useSetAtom(resetAtom);

    const form = useForm<FormPermissions>({
        defaultValues: {
            permissions: [],
        },
    });

    /**
     * Reset the form and the atoms when the modal is closed
     */
    useEffect(() => {
        if (isModalOpen) return;
        form.reset();
        resetAtoms();
    }, [isModalOpen, form.reset, resetAtoms]);

    /**
     * Directly exit if the user isn't the owner
     */
    if (!isProductOwner) return null;

    function onSubmit(values: FormPermissions) {
        console.log({ values, wallet });
        // todo: Add the new member
    }

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
                            <FormWallet />
                            <FormPermissions {...form} />
                        </>
                    }
                    cancel={<Button variant={"outline"}>Cancel</Button>}
                    action={
                        <Button
                            variant={"submit"}
                            disabled={!wallet}
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
function FormWallet() {
    const [wallet, setWallet] = useAtom(walletAtom);

    const form = useForm<FormWallet>({
        defaultValues: {
            wallet: "",
        },
    });

    function onSubmit(values: FormWallet) {
        setWallet(values.wallet);
    }

    return (
        <>
            <Form {...form}>
                <form>
                    <FormField
                        control={form.control}
                        name="wallet"
                        rules={{
                            required: "Missing wallet",
                            validate: {
                                required: (value) =>
                                    isAddress(value) || "Invalid wallet",
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
                                            onClick={form.handleSubmit(
                                                onSubmit
                                            )}
                                        >
                                            Verify
                                        </Button>
                                    </Row>
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </form>
            </Form>

            {wallet && (
                <p className={"success"}>The new member is ready to be added</p>
            )}
        </>
    );
}

/**
 * Initial form to add wallet permissions
 * @constructor
 */
function FormPermissions(form: UseFormReturn<FormPermissions>) {
    return (
        <>
            <FormField
                control={form.control}
                name="permissions"
                rules={{ required: "Select a permission" }}
                render={() => (
                    <FormItem>
                        <FormDescription
                            title={"Permissions"}
                            className={styles.formPermission__description}
                            classNameTitle={
                                styles.formPermission__descriptionTitle
                            }
                        >
                            Choose the type of permission.
                            <br /> Product manager can manage the interaction
                            contract and update it.
                            <br />
                            Campaign manager can deploy campaigns, put them on
                            standby, and delete them.
                        </FormDescription>
                        {availablePermissions.map((item) => (
                            <FormField
                                key={item.id}
                                control={form.control}
                                name="permissions"
                                render={({ field }) => (
                                    <FormItem
                                        variant={"checkbox"}
                                        key={item.id}
                                    >
                                        <FormControl>
                                            <Checkbox
                                                checked={field.value?.includes(
                                                    item.id
                                                )}
                                                onCheckedChange={(checked) => {
                                                    return checked
                                                        ? field.onChange([
                                                              ...field.value,
                                                              item.id,
                                                          ])
                                                        : field.onChange(
                                                              field.value?.filter(
                                                                  (value) =>
                                                                      value !==
                                                                      item.id
                                                              )
                                                          );
                                                }}
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormLabel
                                            variant={"checkbox"}
                                            selected={field.value?.includes(
                                                item.id
                                            )}
                                        >
                                            {item.label}
                                        </FormLabel>
                                    </FormItem>
                                )}
                            />
                        ))}
                        <FormMessage />
                    </FormItem>
                )}
            />
        </>
    );
}
