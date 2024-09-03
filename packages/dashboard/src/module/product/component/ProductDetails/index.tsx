"use client";

import {
    ActionsMessageSuccess,
    ActionsWrapper,
} from "@/module/campaigns/component/Actions";
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/module/forms/Select";
import type { SelectTriggerProps } from "@/module/forms/Select";
import { InteractionSettings } from "@/module/product/component/ProductDetails/InteractionSettings";
import { ManageProductTeam } from "@/module/product/component/ProductDetails/ManageTeam";
import { useEditProduct } from "@/module/product/hook/useEditProduct";
import { useProductMetadata } from "@/module/product/hook/useProductMetadata";
import {
    decodeProductTypesMask,
    productTypesLabel,
} from "@/module/product/utils/productTypes";
import { productTypesMask } from "@frak-labs/nexus-sdk/core";
import { Button } from "@module/component/Button";
import { Input, type InputProps } from "@module/component/forms/Input";
import { Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { forwardRef, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import styles from "./index.module.css";

type FormProduct = {
    name: string;
    domain: string;
    productTypes: bigint;
};

export function ProductDetails({ productId }: { productId: bigint }) {
    const router = useRouter();
    const {
        data: product,
        isLoading: productIsLoading,
        isPending: productIsPending,
    } = useProductMetadata({ productId: productId.toString() });
    const {
        mutate: editProduct,
        isSuccess: editProductSuccess,
        isPending: editProductPending,
    } = useEditProduct({
        productId: productId.toString(),
    });
    const [forceRefresh, setForceRefresh] = useState(new Date().getTime());

    const form = useForm<FormProduct>({
        values: useMemo(() => product, [product]),
        defaultValues: {
            name: "",
            domain: "",
            productTypes: 0n,
        },
    });

    /**
     * Force refresh the form when the product is loaded
     */
    useEffect(() => {
        if (!product) return;
        setForceRefresh(new Date().getTime());
    }, [product]);

    /**
     * On success, reset the form
     */
    useEffect(() => {
        if (!editProductSuccess) return;
        form.reset(form.getValues());
        setForceRefresh(new Date().getTime());
    }, [editProductSuccess, form.reset, form.getValues]);

    /**
     * Launch the mutation to edit the product
     * @param values
     */
    function onSubmit(values: FormProduct) {
        editProduct({
            name: values.name,
            productTypes: values.productTypes.toString(),
        });
    }

    return (
        <FormLayout>
            <Form {...form}>
                {!(productIsLoading || productIsPending) && (
                    <Panel title={product?.name}>
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
                            key={forceRefresh}
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
                                    <Select
                                        onValueChange={(value) =>
                                            field.onChange(
                                                productTypesMask[
                                                    value as keyof typeof productTypesMask
                                                ]
                                            )
                                        }
                                        defaultValue={
                                            decodeProductTypesMask(
                                                BigInt(field.value)
                                            )?.[0]
                                        }
                                    >
                                        <FormControl>
                                            <SelectWithToggle
                                                length={"medium"}
                                                {...field}
                                                value={
                                                    decodeProductTypesMask(
                                                        BigInt(field.value)
                                                    )?.[0]
                                                }
                                            >
                                                <SelectValue placeholder="Select a product type" />
                                            </SelectWithToggle>
                                        </FormControl>
                                        <SelectContent>
                                            {Object.keys(productTypesMask).map(
                                                (key) => (
                                                    <SelectItem
                                                        key={key}
                                                        value={key}
                                                    >
                                                        {
                                                            productTypesLabel[
                                                                key as keyof typeof productTypesLabel
                                                            ].name
                                                        }
                                                    </SelectItem>
                                                )
                                            )}
                                        </SelectContent>
                                    </Select>
                                </FormItem>
                            )}
                        />
                    </Panel>
                )}
                <ManageProductTeam productId={productId} />
                <InteractionSettings productId={productId} />
                <ActionsWrapper
                    left={
                        <>
                            <Button
                                variant={"outline"}
                                onClick={() => router.push("/dashboard")}
                            >
                                Cancel
                            </Button>
                            {editProductSuccess && <ActionsMessageSuccess />}
                        </>
                    }
                    right={
                        <>
                            <Button
                                variant={"informationOutline"}
                                onClick={() => {
                                    form.reset(product);
                                    setForceRefresh(new Date().getTime());
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
                        </>
                    }
                />
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
                    className={styles.InputWithToggle__button}
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

const SelectWithToggle = forwardRef<HTMLButtonElement, SelectTriggerProps>(
    ({ disabled, children, ...props }, ref) => {
        const [isDisabled, setIsDisabled] = useState(true);
        return (
            <Row align={"center"}>
                <SelectTrigger
                    {...props}
                    ref={ref}
                    disabled={isDisabled}
                    onBlur={() => setIsDisabled(true)}
                >
                    {children}
                </SelectTrigger>
                <button
                    type={"button"}
                    className={styles.InputWithToggle__button}
                    onClick={() => setIsDisabled(!isDisabled)}
                    disabled={disabled}
                >
                    <Pencil size={20} />
                </button>
            </Row>
        );
    }
);
SelectWithToggle.displayName = "SelectWithToggle";
