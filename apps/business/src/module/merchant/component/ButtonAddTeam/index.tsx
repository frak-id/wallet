import { Inline } from "@frak-labs/design-system/components/Inline";
import {
    Sheet,
    SheetClose,
    SheetContent,
    SheetDescription,
    SheetFooter,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@frak-labs/design-system/components/Sheet";
import { BadgeCheck } from "lucide-react";
import {
    type PropsWithChildren,
    useCallback,
    useEffect,
    useState,
} from "react";
import { useForm, useFormContext } from "react-hook-form";
import { type Address, isAddress } from "viem";
import { Button } from "@/module/common/component/Button";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
    FormValidMessage,
} from "@/module/forms/Form";
import { Input } from "@/module/forms/Input";
import { useAdminMutation } from "@/module/merchant/hook/useAdminMutation";

type FormAddTeamMembers = {
    wallet?: Address;
};

export function ButtonAddTeam({
    merchantId,
    children,
}: PropsWithChildren<{ merchantId: string }>) {
    const [isOpen, setIsOpen] = useState(false);
    const {
        mutateAsync: addAdmin,
        isPending: isAddingMember,
        error,
    } = useAdminMutation({ action: "add" });

    const form = useForm<FormAddTeamMembers>();

    useEffect(() => {
        if (isOpen) return;
        form.reset();
    }, [isOpen, form.reset, form]);

    const onSubmit = useCallback(
        async (data: FormAddTeamMembers) => {
            if (!data.wallet) return;
            await addAdmin({
                merchantId,
                wallet: data.wallet,
            });
            setIsOpen(false);
        },
        [addAdmin, merchantId]
    );

    return (
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>{children}</SheetTrigger>
            <SheetContent side="right">
                <SheetHeader>
                    <SheetTitle>
                        <BadgeCheck color={"#0DDB84"} /> Add a new member
                    </SheetTitle>
                    <SheetDescription>
                        Invite an admin to your merchant team by wallet address.
                    </SheetDescription>
                </SheetHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)}>
                        {isAddingMember && (
                            <p>
                                Adding the new admin
                                <span className={"dotsLoading"}>...</span>
                            </p>
                        )}
                        <FormWallet disabled={isAddingMember} />
                        {error && (
                            <p>Error when adding the admin: {error.message}</p>
                        )}
                    </form>
                </Form>
                <SheetFooter>
                    <SheetClose asChild>
                        <Button variant={"secondary"} disabled={isAddingMember}>
                            Cancel
                        </Button>
                    </SheetClose>
                    <Button
                        variant={"primary"}
                        disabled={!form.formState.isValid || isAddingMember}
                        onClick={form.handleSubmit(onSubmit)}
                    >
                        Add Member
                    </Button>
                </SheetFooter>
            </SheetContent>
        </Sheet>
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
                        <Inline space="m" alignY="bottom">
                            <Input
                                length={"medium"}
                                placeholder={"Wallet Address...."}
                                {...field}
                                value={field.value ?? ""}
                            />
                            <Button
                                variant={"primary"}
                                disabled={disabled}
                                onClick={() => {
                                    trigger("wallet");
                                }}
                            >
                                Verify
                            </Button>
                        </Inline>
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
