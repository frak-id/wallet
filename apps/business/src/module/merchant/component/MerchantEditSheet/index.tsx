import {
    currentStablecoins,
    getTokenAddressForStablecoin,
    type Stablecoin,
} from "@frak-labs/app-essentials";
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
import { Stack } from "@frak-labs/design-system/components/Stack";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import type { Address } from "viem";
import { Button } from "@/module/common/component/Button";
import { CurrencySelector } from "@/module/forms/CurrencySelector";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/module/forms/Form";
import { InputWithToggle } from "@/module/forms/InputWithToggle";
import { useMerchantUpdate } from "@/module/merchant/hook/useMerchantUpdate";
import type { MerchantData } from "@/module/merchant/queries/queryOptions";

type FormMerchant = {
    name: string;
    domain: string;
    defaultCurrency: Stablecoin;
};

function detectStablecoinFromAddress(address: Address): Stablecoin | undefined {
    for (const [key, value] of Object.entries(currentStablecoins)) {
        if (value.toLowerCase() === address.toLowerCase()) {
            return key as Stablecoin;
        }
    }
    return undefined;
}

export function MerchantEditSheet({
    merchant,
    merchantId,
}: {
    merchant: MerchantData;
    merchantId: string;
}) {
    const [open, setOpen] = useState(false);
    const {
        mutate: editMerchant,
        isSuccess: editMerchantSuccess,
        isPending: editMerchantPending,
        reset: resetMutation,
    } = useMerchantUpdate({ merchantId, target: "base" });

    const formValues = useMemo<FormMerchant>(
        () => ({
            name: merchant.name,
            domain: merchant.domain,
            defaultCurrency:
                detectStablecoinFromAddress(merchant.defaultRewardToken) ??
                "eure",
        }),
        [merchant]
    );

    const form = useForm<FormMerchant>({
        values: formValues,
        defaultValues: formValues,
    });

    useEffect(() => {
        if (!editMerchantSuccess) return;
        form.reset(form.getValues());
        setOpen(false);
        resetMutation();
    }, [editMerchantSuccess, form, resetMutation]);

    function onSubmit(values: FormMerchant) {
        editMerchant({
            name: values.name,
            defaultRewardToken: getTokenAddressForStablecoin(
                values.defaultCurrency
            ),
        });
    }

    return (
        <Sheet
            open={open}
            onOpenChange={(next) => {
                setOpen(next);
                if (!next) form.reset(formValues);
            }}
        >
            <SheetTrigger asChild>
                <Button variant="secondary">Edit</Button>
            </SheetTrigger>
            <SheetContent side="right">
                <SheetHeader>
                    <SheetTitle>Edit merchant</SheetTitle>
                    <SheetDescription>
                        Update your merchant name and default reward currency.
                    </SheetDescription>
                </SheetHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)}>
                        <Stack space="m">
                            <FormField
                                control={form.control}
                                name="name"
                                rules={{ required: "Missing merchant name" }}
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel weight={"medium"}>
                                            Merchant name
                                        </FormLabel>
                                        <FormControl>
                                            <InputWithToggle
                                                length={"medium"}
                                                placeholder={"Merchant name..."}
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="domain"
                                rules={{ required: "Missing domain name" }}
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel weight={"medium"}>
                                            Domain name
                                        </FormLabel>
                                        <FormControl>
                                            <InputWithToggle
                                                length={"medium"}
                                                placeholder={"Domain name..."}
                                                {...field}
                                                disabled={true}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="defaultCurrency"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel weight={"medium"}>
                                            Default reward currency
                                        </FormLabel>
                                        <FormControl>
                                            <CurrencySelector
                                                value={field.value}
                                                onChange={field.onChange}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </Stack>
                    </form>
                </Form>
                <SheetFooter>
                    <SheetClose asChild>
                        <Button
                            variant="secondary"
                            disabled={editMerchantPending}
                        >
                            Discard
                        </Button>
                    </SheetClose>
                    <Button
                        variant="primary"
                        onClick={form.handleSubmit(onSubmit)}
                        disabled={
                            editMerchantPending || !form.formState.isDirty
                        }
                        loading={editMerchantPending}
                    >
                        Save
                    </Button>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    );
}
