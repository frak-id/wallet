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
    FormMessage,
} from "@/module/forms/Form";
import { Switch } from "@/module/forms/Switch";
import { useEditExplorer } from "@/module/merchant/hook/useEditExplorer";
import { useMerchant } from "@/module/merchant/hook/useMerchant";
import styles from "./index.module.css";

type ExplorerFormValues = {
    enabled: boolean;
    heroImageUrl?: string;
    description?: string;
};

export function ExplorerSettings({ merchantId }: { merchantId: string }) {
    const { data: merchant } = useMerchant({ merchantId });
    const {
        mutate: editExplorer,
        isSuccess: editExplorerSuccess,
        isPending: editExplorerPending,
    } = useEditExplorer({ merchantId });

    const formValues = useMemo(
        () =>
            merchant
                ? {
                      enabled: merchant.explorerEnabledAt !== null,
                      heroImageUrl: merchant.explorerConfig?.heroImageUrl ?? "",
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
            description: "",
        },
    });

    useEffect(() => {
        if (!editExplorerSuccess) return;
        form.reset(form.getValues());
    }, [editExplorerSuccess, form.reset, form.getValues, form]);

    function onSubmit(values: ExplorerFormValues) {
        const config =
            values.heroImageUrl || values.description
                ? {
                      heroImageUrl: values.heroImageUrl,
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
                                <InputWithToggle
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
                <Columns>
                    <Column>
                        {editExplorerSuccess && <ActionsMessageSuccess />}
                    </Column>
                    <Column>
                        <Button
                            variant={"informationOutline"}
                            onClick={() => {
                                form.reset(formValues);
                            }}
                            disabled={
                                editExplorerPending || !form.formState.isDirty
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
                                editExplorerPending || !form.formState.isDirty
                            }
                            isLoading={editExplorerPending}
                        >
                            Validate
                        </Button>
                    </Column>
                </Columns>
            </Panel>
        </Form>
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
