"use client";

import { ActionsMessageSuccess } from "@/module/campaigns/component/Actions";
import { Head } from "@/module/common/component/Head";
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
import { ManageProductTeam } from "@/module/product/component/ProductDetails/ManageTeam";
import { useEditProduct } from "@/module/product/hook/useEditProduct";
import { useProductMetadata } from "@/module/product/hook/useProductMetadata";
import { productTypesLabel } from "@/module/product/utils/productTypes";
import {
    type ProductTypesKey,
    productTypesMask,
} from "@frak-labs/nexus-sdk/core";
import { Button } from "@module/component/Button";
import { Column, Columns } from "@module/component/Columns";
import { Input, type InputProps } from "@module/component/forms/Input";
import { Pencil, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { forwardRef, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import type { Hex } from "viem";
import { PurchaseOracleSetup } from "./PurchaseOracle";
import styles from "./index.module.css";

type FormProduct = {
    name: string;
    domain: string;
    productTypes: ProductTypesKey[];
};

export function ProductDetails({ productId }: { productId: Hex }) {
    const router = useRouter();
    const {
        data: product,
        isLoading: productIsLoading,
        isPending: productIsPending,
    } = useProductMetadata({ productId });
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
    }, [editProductSuccess, form.reset, form.getValues]);

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
            <Head
                title={{ content: product?.name ?? "", size: "small" }}
                rightSection={
                    <Button
                        variant={"outline"}
                        leftIcon={<X size={20} />}
                        onClick={() => router.push("/dashboard")}
                    >
                        Cancel
                    </Button>
                }
            />
            <Form {...form}>
                {!(productIsLoading || productIsPending) && (
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
                <ManageProductTeam productId={productId} />
                <PurchaseOracleSetup productId={productId} />
                <InteractionSettings productId={productId} />
            </Form>
        </FormLayout>
    );
}

const InputWithToggle = forwardRef<HTMLInputElement, InputProps>(
    ({ disabled, ...props }, ref) => {
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
    }
);
InputWithToggle.displayName = "InputWithToggle";

const MultiSelectWithToggle = forwardRef<HTMLButtonElement, MultiSelectProps>(
    ({ disabled, ...props }, ref) => {
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
    }
);
MultiSelectWithToggle.displayName = "MultiSelectWithToggle";
