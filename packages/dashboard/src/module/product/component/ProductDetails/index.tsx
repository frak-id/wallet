"use client";

import { viemClient } from "@/context/blockchain/provider";
import { roles } from "@/context/blockchain/roles";
import { ActionsWrapper } from "@/module/campaigns/component/Actions";
import { Column } from "@/module/common/component/Column";
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
import { ManageProductTeam } from "@/module/product/component/ProductDetails/ManageTeam";
import {
    useSendTransactionAction,
    useWalletStatus,
} from "@frak-labs/nexus-sdk/react";
import { productInteractionManagerAbi } from "@frak-labs/shared/context/blockchain/abis/frak-interaction-abis";
import { productAdministratorRegistryAbi } from "@frak-labs/shared/context/blockchain/abis/frak-registry-abis";
import { addresses } from "@frak-labs/shared/context/blockchain/addresses";
import { Button } from "@module/component/Button";
import { Spinner } from "@module/component/Spinner";
import { Input, type InputProps } from "@module/component/forms/Input";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Pencil } from "lucide-react";
import { tryit } from "radash";
import { forwardRef, useState } from "react";
import { useForm } from "react-hook-form";
import { encodeFunctionData } from "viem";
import { readContract } from "viem/actions";
import styles from "./index.module.css";

type FormProduct = {
    name: string;
    domain: string;
    contentType: string;
};

const contentType = [
    {
        id: "text",
        label: "Text",
    },
    {
        id: "video",
        label: "Video",
    },
    {
        id: "product",
        label: "Product",
    },
    {
        id: "others",
        label: "Others",
    },
];

export function ProductDetails({ productId }: { productId: bigint }) {
    const { data: walletStatus } = useWalletStatus();
    const { mutateAsync: sendTransaction } = useSendTransactionAction();

    const {
        data: detailsData,
        isLoading: isFetchingInteractionContract,
        refetch: refreshDetails,
    } = useQuery({
        enabled: !!productId,
        queryKey: [
            "product",
            "details",
            walletStatus?.key,
            productId.toString(),
        ],
        queryFn: async () => {
            if (walletStatus?.key !== "connected") {
                return null;
            }

            // Check if the user is allowed on the product
            const isAllowed = await readContract(viemClient, {
                abi: productAdministratorRegistryAbi,
                functionName: "hasAllRolesOrAdmin",
                address: addresses.productAdministratorRegistry,
                args: [productId, walletStatus.wallet, roles.productManager],
            });

            // Fetch the on chain interaction contract
            const [, interactionContract] = await tryit(() =>
                readContract(viemClient, {
                    abi: productInteractionManagerAbi,
                    functionName: "getInteractionContract",
                    address: addresses.productInteractionManager,
                    args: [productId],
                })
            )();

            return { isAllowed, interactionContract };
        },
    });

    const { mutate: deployInteraction } = useMutation({
        mutationKey: ["product", "deploy-interaction"],
        mutationFn: async () => {
            await sendTransaction({
                tx: {
                    to: addresses.productInteractionManager,
                    data: encodeFunctionData({
                        abi: productInteractionManagerAbi,
                        functionName: "deployInteractionContract",
                        args: [productId],
                    }),
                },
                metadata: {
                    header: {
                        title: "Deploy interaction handler",
                    },
                },
            });
            await refreshDetails();
        },
    });

    const { mutate: deleteInteraction } = useMutation({
        mutationKey: ["product", "delete-interaction"],
        mutationFn: async () => {
            await sendTransaction({
                tx: {
                    to: addresses.productInteractionManager,
                    data: encodeFunctionData({
                        abi: productInteractionManagerAbi,
                        functionName: "deleteInteractionContract",
                        args: [productId],
                    }),
                },
                metadata: {
                    header: {
                        title: "Remove interaction handler",
                    },
                },
            });
            await refreshDetails();
        },
    });

    const form = useForm<FormProduct>({
        defaultValues: {
            name: "",
            domain: "",
            contentType: "",
        },
    });

    function onSubmit(values: FormProduct) {
        console.log({ values });
    }

    return (
        <FormLayout>
            <Form {...form}>
                <Panel title={"Interactions handler"}>
                    <Column>
                        {isFetchingInteractionContract && <Spinner />}
                        {detailsData?.interactionContract && (
                            <>
                                <div>
                                    Interaction contract:{" "}
                                    <pre>{detailsData.interactionContract}</pre>
                                    {detailsData?.isAllowed && (
                                        <Button
                                            variant={"submit"}
                                            onClick={() => deleteInteraction()}
                                        >
                                            Remove interaction handler
                                        </Button>
                                    )}
                                </div>
                            </>
                        )}
                        {!(
                            isFetchingInteractionContract ||
                            detailsData?.interactionContract
                        ) && (
                            <>
                                <div>
                                    No interaction contract deployed
                                    {detailsData?.isAllowed && (
                                        <Button
                                            variant={"submit"}
                                            onClick={() => deployInteraction()}
                                        >
                                            Deploy interaction handler
                                        </Button>
                                    )}
                                </div>
                            </>
                        )}
                    </Column>
                    <Column>
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
                            control={form.control}
                            name="contentType"
                            rules={{ required: "Select a content type" }}
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel weight={"medium"}>
                                        Content type
                                    </FormLabel>
                                    <FormMessage />
                                    <Select
                                        onValueChange={field.onChange}
                                        defaultValue={field.value}
                                    >
                                        <FormControl>
                                            <SelectWithToggle
                                                length={"medium"}
                                                {...field}
                                            >
                                                <SelectValue placeholder="Select a content type" />
                                            </SelectWithToggle>
                                        </FormControl>
                                        <SelectContent>
                                            {contentType.map((item) => (
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
                    </Column>
                </Panel>
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
