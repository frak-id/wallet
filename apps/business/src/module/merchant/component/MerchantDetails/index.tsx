import { Button } from "@frak-labs/ui/component/Button";
import { Column, Columns } from "@frak-labs/ui/component/Columns";
import { Input, type InputProps } from "@frak-labs/ui/component/forms/Input";
import { Pencil } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { ActionsMessageSuccess } from "@/module/campaigns/component/Actions";
import { Panel } from "@/module/common/component/Panel";
import { Row } from "@/module/common/component/Row";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormLayout,
    FormMessage,
} from "@/module/forms/Form";
import { MerchantHead } from "@/module/merchant/component/MerchantHead";
import { useEditMerchant } from "@/module/merchant/hook/useEditMerchant";
import { useMerchant } from "@/module/merchant/hook/useMerchant";
import styles from "./index.module.css";
import { PurchasseTrackerSetup } from "./PurchaseTracker";
import { WebhookInteractionSetup } from "./WebhookInteraction";

type FormMerchant = {
    name: string;
    domain: string;
};

export function MerchantDetails({ merchantId }: { merchantId: string }) {
    const { data: merchant } = useMerchant({ merchantId });
    const {
        mutate: editMerchant,
        isSuccess: editMerchantSuccess,
        isPending: editMerchantPending,
    } = useEditMerchant({ merchantId });

    const formValues = useMemo(
        () =>
            merchant
                ? {
                      name: merchant.name,
                      domain: merchant.domain,
                  }
                : undefined,
        [merchant]
    );

    const form = useForm<FormMerchant>({
        values: formValues,
        defaultValues: {
            name: "",
            domain: "",
        },
    });

    /**
     * On success, reset the form
     */
    useEffect(() => {
        if (!editMerchantSuccess) return;
        form.reset(form.getValues());
    }, [editMerchantSuccess, form.reset, form.getValues, form]);

    /**
     * Launch the mutation to edit the merchant
     * @param values
     */
    function onSubmit(values: FormMerchant) {
        editMerchant({
            name: values.name,
        });
    }

    return (
        <FormLayout>
            <MerchantHead merchantId={merchantId} />
            <Form {...form}>
                {merchant && (
                    <Panel title={"Details of the merchant"}>
                        <FormField
                            control={form.control}
                            name="name"
                            rules={{
                                required: "Missing merchant name",
                            }}
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel weight={"medium"}>
                                        Enter your merchant name
                                    </FormLabel>
                                    <FormControl>
                                        <InputWithToggle
                                            length={"medium"}
                                            placeholder={"Merchant name...."}
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
                            rules={{
                                required: "Missing domain name",
                            }}
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel weight={"medium"}>
                                        Your domain name
                                    </FormLabel>
                                    <FormControl>
                                        <InputWithToggle
                                            length={"medium"}
                                            placeholder={"Domain name...."}
                                            {...field}
                                            disabled={true}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <Columns>
                            <Column>
                                {editMerchantSuccess && (
                                    <ActionsMessageSuccess />
                                )}
                            </Column>
                            <Column>
                                <Button
                                    variant={"informationOutline"}
                                    onClick={() => {
                                        form.reset(formValues);
                                    }}
                                    disabled={
                                        editMerchantPending ||
                                        !form.formState.isDirty
                                    }
                                >
                                    Discard Changes
                                </Button>
                                <Button
                                    variant={"submit"}
                                    onClick={() => {
                                        form.handleSubmit(onSubmit)();
                                    }}
                                    disabled={
                                        editMerchantPending ||
                                        !form.formState.isDirty
                                    }
                                    isLoading={editMerchantPending}
                                >
                                    Validate
                                </Button>
                            </Column>
                        </Columns>
                    </Panel>
                )}
                <WebhookInteractionSetup merchantId={merchantId} />
                <PurchasseTrackerSetup
                    merchantId={merchantId}
                    productId={merchant?.productId}
                />
            </Form>
        </FormLayout>
    );
}

const InputWithToggle = ({ ref, disabled, ...props }: InputProps) => {
    const [isDisabled, setIsDisabled] = useState(true);
    return (
        <Row align={"center"}>
            <Input
                {...props}
                ref={ref}
                disabled={isDisabled}
                onBlur={() => setIsDisabled(true)}
            />
            <button
                type={"button"}
                className={styles.inputWithToggle__button}
                onClick={() => setIsDisabled(!isDisabled)}
                disabled={disabled}
            >
                <Pencil size={20} />
            </button>
        </Row>
    );
};
InputWithToggle.displayName = "InputWithToggle";
