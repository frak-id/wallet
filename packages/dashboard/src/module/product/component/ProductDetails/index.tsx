"use client";

import { ActionsWrapper } from "@/module/campaigns/component/Actions";
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
import { InteractionContract } from "@/module/product/component/ProductDetails/InteractionContract";
import { ManageProductTeam } from "@/module/product/component/ProductDetails/ManageTeam";
import { useProduct } from "@/module/product/hook/useProduct";
import { Button } from "@module/component/Button";
import { Input, type InputProps } from "@module/component/forms/Input";
import { Pencil } from "lucide-react";
import { forwardRef, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import styles from "./index.module.css";

type FormProduct = {
    name: string;
    domain: string;
    productTypes: string;
};

const productTypes = [
    {
        id: "4",
        label: "Text",
    },
    {
        id: "5",
        label: "Video",
    },
    {
        id: "6",
        label: "Product",
    },
    {
        id: "7",
        label: "Others",
    },
];

export function ProductDetails({ productId }: { productId: bigint }) {
    const {
        data: product,
        isLoading: productIsLoading,
        isPending: productIsPending,
    } = useProduct({ productId: productId.toString() });
    const [forceRefresh, setForceRefresh] = useState(new Date().getTime());

    const form = useForm<FormProduct>({
        defaultValues: {
            name: "",
            domain: "",
            productTypes: "5",
        },
    });

    /**
     * Reset the form when the product is fetched
     */
    useEffect(() => {
        if (!product) return;
        form.reset({
            ...product,
            productTypes: product.productTypes.toString(),
        });
        setForceRefresh(new Date().getTime());
    }, [product, form.reset]);

    function onSubmit(values: FormProduct) {
        console.log({ values });
    }

    return (
        <FormLayout>
            <Form {...form}>
                <InteractionContract productId={productId} />
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
                            disabled={true}
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
                                        onValueChange={field.onChange}
                                        defaultValue={field.value.toString()}
                                    >
                                        <FormControl>
                                            <SelectWithToggle
                                                length={"medium"}
                                                {...field}
                                                value={field.value.toString()}
                                            >
                                                <SelectValue placeholder="Select a product type" />
                                            </SelectWithToggle>
                                        </FormControl>
                                        <SelectContent>
                                            {productTypes.map((item) => (
                                                <SelectItem
                                                    key={item.id}
                                                    value={item.id}
                                                >
                                                    {item.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </FormItem>
                            )}
                        />
                    </Panel>
                )}
                <ManageProductTeam productId={productId} />
                <ActionsWrapper
                    left={<Button variant={"outline"}>Cancel</Button>}
                    right={
                        <>
                            <Button variant={"informationOutline"}>
                                Discard Changes
                            </Button>
                            <Button
                                variant={"submit"}
                                onClick={() => {
                                    form.handleSubmit(onSubmit)();
                                }}
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
                <Input {...props} ref={ref} disabled={isDisabled} />
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
                <SelectTrigger {...props} ref={ref} disabled={isDisabled}>
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
