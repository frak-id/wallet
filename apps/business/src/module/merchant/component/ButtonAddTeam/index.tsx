import { Button } from "@frak-labs/ui/component/Button";
import { Input } from "@frak-labs/ui/component/forms/Input";
import { BadgeCheck } from "lucide-react";
import {
    type PropsWithChildren,
    useCallback,
    useEffect,
    useState,
} from "react";
import { useForm, useFormContext } from "react-hook-form";
import { type Address, isAddress } from "viem";
import { AlertDialog } from "@/module/common/component/AlertDialog";
import { Row } from "@/module/common/component/Row";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
    FormValidMessage,
} from "@/module/forms/Form";
import { useAddAdmin } from "@/module/merchant/hook/useAddAdmin";

type FormAddTeamMembers = {
    wallet?: Address;
};

export function ButtonAddTeam({
    merchantId,
    children,
}: PropsWithChildren<{ merchantId: string }>) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const {
        mutateAsync: addAdmin,
        isPending: isAddingMember,
        error,
    } = useAddAdmin();

    const form = useForm<FormAddTeamMembers>();

    useEffect(() => {
        if (isModalOpen) return;
        form.reset();
    }, [isModalOpen, form.reset, form]);

    const onSubmit = useCallback(
        async (data: FormAddTeamMembers) => {
            if (!data.wallet) return;
            await addAdmin({
                merchantId,
                wallet: data.wallet,
            });
            setIsModalOpen(false);
        },
        [addAdmin, merchantId]
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
                                    Adding the new admin
                                    <span className={"dotsLoading"}>...</span>
                                </p>
                            )}
                            <FormWallet disabled={isAddingMember} />
                            {error && (
                                <p>
                                    Error when adding the admin: {error.message}
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

function FormWallet({ disabled }: { disabled: boolean }) {
    const { trigger, control } = useFormContext<FormAddTeamMembers>();
    useEffect(() => {
        trigger("wallet");
    }, [trigger]);

    return (
        <FormField
            control={control}
            name="wallet"
            rules={{
                required: "Wallet address required",
                validate: {
                    required: (value) =>
                        (value && isAddress(value)) || "Invalid wallet address",
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
    );
}
