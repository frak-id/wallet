import { AlertDialog } from "@/module/common/component/AlertDialog";
import { Row } from "@/module/common/component/Row";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/module/forms/Form";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/module/forms/Select";
import { useIsProductOwner } from "@/module/product/hook/useIsProductOwner";
import { Button } from "@module/component/Button";
import { Input } from "@module/component/forms/Input";
import { atom, useAtom, useAtomValue } from "jotai";
import { BadgeCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { isAddress } from "viem";

type FormWallet = {
    wallet: string;
};

type FormPermission = {
    permission: string;
};

const isModalOpenAtom = atom(false);
const walletAtom = atom<string | undefined>();

const availablePermissions = ["Admin", "Operator"];

export function ButtonAddTeam({ productId }: { productId: bigint }) {
    const [isModalOpen, setIsModalOpen] = useAtom(isModalOpenAtom);
    const wallet = useAtomValue(walletAtom);
    const { data: isProductOwner } = useIsProductOwner({ productId });
    // const resetAtoms = useSetAtom(resetAtom);
    // const isMinting = useAtomValue(isMintingAtom);

    // const form = useForm<FormMember>({
    //     defaultValues: {
    //         wallet: "",
    //         permission: "",
    //     },
    // });

    /**
     * Reset the form and the atoms when the modal is closed
     */
    // useEffect(() => {
    //     if (isModalOpen) return;
    //     form.reset();
    //     resetAtoms();
    // }, [isModalOpen, form.reset, resetAtoms]);

    /**
     * Directly exit if the user isn't the owner
     */
    if (!isProductOwner) return null;

    return (
        /*<Form {...form}>
            <form>*/
        <AlertDialog
            open={isModalOpen}
            onOpenChange={setIsModalOpen}
            title={
                <>
                    <BadgeCheck color={"#0DDB84"} /> Add a new member
                </>
            }
            buttonElement={<Button variant={"submit"}>Add Team Member</Button>}
            showCloseButton={false}
            text={
                <>
                    <FormWallet />
                    <FormPermission />
                </>
            }
            cancel={<Button variant={"outline"}>Cancel</Button>}
            action={
                <Button variant={"submit"} disabled={!wallet}>
                    Add Member
                </Button>
            }
        />
        /*    </form>
        </Form>*/
    );
}

/**
 * Initial form to add wallet address
 * @constructor
 */
function FormWallet() {
    const isModalOpen = useAtomValue(isModalOpenAtom);
    const [error, setError] = useState<string | undefined>();
    const [wallet, setWallet] = useAtom(walletAtom);

    const form = useForm<FormWallet>({
        defaultValues: {
            wallet: "",
        },
    });

    /**
     * Reset the error when the modal is opened
     */
    useEffect(() => {
        if (!isModalOpen) return;
        setError(undefined);
    }, [isModalOpen]);

    function onSubmit(values: FormWallet) {
        console.log(values);
        setWallet(values.wallet);
    }

    return (
        <>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)}>
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
                                            type={"submit"}
                                            variant={"submit"}
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

            {error && <p className={"error"}>{error}</p>}
            {wallet && (
                <p className={"success"}>The new member is ready to be added</p>
            )}
        </>
    );
}

/**
 * Initial form to add wallet permission
 * @constructor
 */
function FormPermission() {
    const isModalOpen = useAtomValue(isModalOpenAtom);
    const [error, setError] = useState<string | undefined>();

    const form = useForm<FormPermission>({
        defaultValues: {
            permission: "",
        },
    });

    /**
     * Reset the error when the modal is opened
     */
    useEffect(() => {
        if (!isModalOpen) return;
        setError(undefined);
    }, [isModalOpen]);

    function onSubmit(values: FormPermission) {
        console.log(values);
    }

    return (
        <>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)}>
                    <FormField
                        control={form.control}
                        name="permission"
                        rules={{ required: "Select a permission" }}
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel weight={"medium"}>
                                    Permission
                                </FormLabel>
                                <FormControl>
                                    <Select
                                        name={field.name}
                                        onValueChange={field.onChange}
                                        defaultValue={field.value}
                                    >
                                        <SelectTrigger
                                            length={"medium"}
                                            {...field}
                                        >
                                            <SelectValue placeholder="Select a permission" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {availablePermissions.map(
                                                (permission) => (
                                                    <SelectItem
                                                        key={permission}
                                                        value={permission}
                                                    >
                                                        {permission}
                                                    </SelectItem>
                                                )
                                            )}
                                        </SelectContent>
                                    </Select>
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </form>
            </Form>

            {error && <p className={"error"}>{error}</p>}
        </>
    );
}
