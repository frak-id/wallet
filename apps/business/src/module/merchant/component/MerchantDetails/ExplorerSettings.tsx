import { Input } from "@frak-labs/ui/component/forms/Input";
import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { Panel } from "@/module/common/component/Panel";
import { Row } from "@/module/common/component/Row";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/module/forms/Form";
import { FormActions } from "@/module/forms/FormActions";
import { Switch } from "@/module/forms/Switch";
import { useMerchant } from "@/module/merchant/hook/useMerchant";
import { useMerchantUpdate } from "@/module/merchant/hook/useMerchantUpdate";
import styles from "./index.module.css";

type ExplorerFormValues = {
    enabled: boolean;
    heroImageUrl?: string;
    logoUrl?: string;
    description?: string;
};

export function ExplorerSettings({ merchantId }: { merchantId: string }) {
    const { data: merchant } = useMerchant({ merchantId });
    const {
        mutate: editExplorer,
        isSuccess: editExplorerSuccess,
        isPending: editExplorerPending,
    } = useMerchantUpdate({ merchantId, target: "explorer" });

    const formValues = useMemo(
        () =>
            merchant
                ? {
                      enabled: merchant.explorerEnabledAt !== null,
                      heroImageUrl: merchant.explorerConfig?.heroImageUrl ?? "",
                      logoUrl: merchant.explorerConfig?.logoUrl ?? "",
                      description: merchant.explorerConfig?.description ?? "",
                  }
                : undefined,
        [merchant]
    );

    const form = useForm<ExplorerFormValues>({
        values: formValues,
        defaultValues: {
            enabled: false,
            heroImageUrl: "",
            logoUrl: "",
            description: "",
        },
    });

    useEffect(() => {
        if (!editExplorerSuccess) return;
        form.reset(form.getValues());
    }, [editExplorerSuccess, form.reset, form.getValues, form]);

    function onSubmit(values: ExplorerFormValues) {
        const config =
            values.heroImageUrl || values.logoUrl || values.description
                ? {
                      heroImageUrl: values.heroImageUrl,
                      logoUrl: values.logoUrl,
                      description: values.description,
                  }
                : undefined;

        editExplorer({
            enabled: values.enabled,
            config,
        });
    }

    if (!merchant) return null;

    return (
        <Form {...form}>
            <Panel title={"Explorer"}>
                <FormField
                    control={form.control}
                    name="enabled"
                    render={({ field }) => (
                        <FormItem>
                            <Row align={"center"}>
                                <FormLabel weight={"medium"}>
                                    Listed in explorer
                                </FormLabel>
                                <FormControl>
                                    <Switch
                                        checked={field.value}
                                        onCheckedChange={field.onChange}
                                    />
                                </FormControl>
                            </Row>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="heroImageUrl"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel weight={"medium"}>
                                Hero image URL
                            </FormLabel>
                            <FormControl>
                                <Input
                                    length={"medium"}
                                    placeholder={"https://..."}
                                    {...field}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="logoUrl"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel weight={"medium"}>Logo URL</FormLabel>
                            <FormControl>
                                <Input
                                    length={"medium"}
                                    placeholder={"https://..."}
                                    {...field}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel weight={"medium"}>Description</FormLabel>
                            <FormControl>
                                <textarea
                                    className={styles.textarea}
                                    placeholder={"Merchant description..."}
                                    {...field}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormActions
                    isSuccess={editExplorerSuccess}
                    isPending={editExplorerPending}
                    isDirty={form.formState.isDirty}
                    onDiscard={() => form.reset(formValues)}
                    onSubmit={() => form.handleSubmit(onSubmit)()}
                />
            </Panel>
        </Form>
    );
}
