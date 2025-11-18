import { type ProductTypesKey, productTypesMask } from "@frak-labs/core-sdk";
import { Button } from "@frak-labs/ui/component/Button";
import { Column, Columns } from "@frak-labs/ui/component/Columns";
import { Input, type InputProps } from "@frak-labs/ui/component/forms/Input";
import { Pencil } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import type { Hex } from "viem";
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
import { MultiSelect, type MultiSelectProps } from "@/module/forms/MultiSelect";
import { InteractionSettings } from "@/module/product/component/ProductDetails/InteractionSettings";
import { PurchasseTrackerSetup } from "@/module/product/component/ProductDetails/PurchaseTracker";
import { WebhookInteractionSetup } from "@/module/product/component/ProductDetails/WebhookInteraction";
import { ProductHead } from "@/module/product/component/ProductHead";
import { useEditProduct } from "@/module/product/hook/useEditProduct";
import { useProductMetadata } from "@/module/product/hook/useProductMetadata";
import { productTypesLabel } from "@/module/product/utils/productTypes";
import styles from "./index.module.css";

type FormProduct = {
    name: string;
    domain: string;
    productTypes: ProductTypesKey[];
};

export function ProductDetails({ productId }: { productId: Hex }) {
    const { data: product } = useProductMetadata({ productId });
    const {
        mutate: editProduct,
        isSuccess: editProductSuccess,
        isPending: editProductPending,
    } = useEditProduct({
        productId,
    });

    const form = useForm<FormProduct>({
        values: useMemo(() => product, [product]),
        defaultValues: {
            name: "",
            domain: "",
            productTypes: [],
        },
    });

    /**
     * On success, reset the form
     */
    useEffect(() => {
        if (!editProductSuccess) return;
        form.reset(form.getValues());
    }, [editProductSuccess, form.reset, form.getValues, form]);

    /**
     * Launch the mutation to edit the product
     * @param values
     */
    function onSubmit(values: FormProduct) {
        editProduct({
            name: values.name,
            productTypes: values.productTypes,
        });
    }

    return (
        <FormLayout>
            <ProductHead productId={productId} />
            <Form {...form}>
                {product && (
                    <Panel title={"Details of the product"}>
                        <FormField
                            control={form.control}
                            name="name"
                            rules={{
                                required: "Missing product name",
                            }}
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel weight={"medium"}>
                                        Enter your product name
                                    </FormLabel>
                                    <FormControl>
                                        <InputWithToggle
                                            length={"medium"}
                                            placeholder={"Product name...."}
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
                                        Enter your domain name
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
                        <FormField
                            control={form.control}
                            name="productTypes"
                            rules={{
                                required: "Select a product type",
                            }}
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel weight={"medium"}>
                                        Product type
                                    </FormLabel>
                                    <FormMessage />
                                    <MultiSelectWithToggle
                                        options={Object.keys(
                                            productTypesMask
                                        ).map((key) => ({
                                            name: productTypesLabel[
                                                key as keyof typeof productTypesLabel
                                            ].name,
                                            value: key,
                                            tooltip:
                                                productTypesLabel[
                                                    key as keyof typeof productTypesLabel
                                                ].description,
                                        }))}
                                        onValueChange={(value) => {
                                            const values = value
                                                .map((v) => v.value)
                                                .filter((v) => v !== undefined);
                                            field.onChange(values);
                                        }}
                                        placeholder="Select a product type"
                                        {...field}
                                    />
                                </FormItem>
                            )}
                        />
                        <Columns>
                            <Column>
                                {editProductSuccess && (
                                    <ActionsMessageSuccess />
                                )}
                            </Column>
                            <Column>
                                <Button
                                    variant={"informationOutline"}
                                    onClick={() => {
                                        form.reset(product);
                                    }}
                                    disabled={
                                        editProductPending ||
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
                                        editProductPending ||
                                        !form.formState.isDirty
                                    }
                                    isLoading={editProductPending}
                                >
                                    Validate
                                </Button>
                            </Column>
                        </Columns>
                    </Panel>
                )}
                <WebhookInteractionSetup productId={productId} />
                <PurchasseTrackerSetup productId={productId} />
                <InteractionSettings productId={productId} />
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

const MultiSelectWithToggle = ({
    ref,
    disabled,
    ...props
}: MultiSelectProps) => {
    const [isDisabled, setIsDisabled] = useState(true);
    return (
        <Row align={"center"}>
            <MultiSelect ref={ref} disabled={isDisabled} {...props} />
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
MultiSelectWithToggle.displayName = "MultiSelectWithToggle";
