"use client";

import { campaignAtom } from "@/module/campaigns/atoms/campaign";
import { Actions } from "@/module/campaigns/component/Actions";
import { ButtonCancel } from "@/module/campaigns/component/Creation/NewCampaign/ButtonCancel";
import { useSaveCampaign } from "@/module/campaigns/hook/useSaveCampaign";
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
import { RadioGroup, RadioGroupItem } from "@/module/forms/RadioGroup";
import { useProductMetadata } from "@/module/product/hook/useProductMetadata";
import type { Campaign } from "@/types/Campaign";
import { Skeleton } from "@frak-labs/shared/module/component/Skeleton";
import { useAtomValue } from "jotai";
import { useMemo } from "react";
import { type UseFormReturn, useForm } from "react-hook-form";
import { toHex } from "viem";
import { DistributionConfiguration } from "./DistributionConfig";
import { FormTriggersCac } from "./FormTriggersCac";
import styles from "./index.module.css";

export function MetricsCampaign() {
    const campaign = useAtomValue(campaignAtom);
    const saveCampaign = useSaveCampaign();

    const pId = useMemo(() => {
        if (!campaign.productId) return;
        return toHex(BigInt(campaign.productId));
    }, [campaign.productId]);

    const { data: product, isPending: productIsPending } = useProductMetadata({
        productId: pId,
    });
    const form = useForm<Campaign>({
        values: useMemo(() => campaign, [campaign]),
        resolver: (values) => {
            // Check that we have at least one trigger set with a CAC greater than 0
            const hasTrigger = Object.values(values.triggers).some(
                (trigger) => trigger.cac && trigger.cac > 0
            );
            if (!hasTrigger) {
                return {
                    values,
                    errors: {
                        triggers: {
                            message: "At least one trigger should be set",
                        },
                    },
                };
            }
            return {
                values,
                errors: {},
            };
        },
    });
    const distributionType = form.watch("distribution.type") ?? "fixed";

    function handleSave(newCampaign: Campaign) {
        saveCampaign({
            ...campaign,
            ...newCampaign,
        });
    }

    if (productIsPending) return <Skeleton />;

    return (
        <FormLayout>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(handleSave)}>
                    <Head
                        title={{ content: "Campaign Metrics", size: "small" }}
                        rightSection={
                            <ButtonCancel
                                onClick={() => {
                                    form.reset(campaign);
                                }}
                            />
                        }
                    />
                    <DistributionTypeToggle {...form} />
                    <FormTriggersCac
                        productTypes={product?.productTypes ?? []}
                    />
                    <DistributionConfiguration
                        distributionType={distributionType}
                        form={form}
                    />

                    <Actions isLoading={productIsPending} />
                </form>
            </Form>
        </FormLayout>
    );
}

function DistributionTypeToggle(form: UseFormReturn<Campaign>) {
    return (
        <Panel title="Define the type of rewards">
            <FormField
                control={form.control}
                name="distribution.type"
                rules={{ required: "Select a distribution type" }}
                render={({ field }) => (
                    <FormItem>
                        <Row align={"start"}>
                            <div>
                                <FormControl>
                                    <RadioGroup
                                        onValueChange={(value) =>
                                            field.onChange(value)
                                        }
                                        defaultValue={field.value}
                                        {...field}
                                    >
                                        <div className={styles.radio__group}>
                                            <FormItem variant={"radio"}>
                                                <FormControl>
                                                    <RadioGroupItem
                                                        value={"fixed"}
                                                    />
                                                </FormControl>
                                                <FormLabel variant={"radio"}>
                                                    Fixed rewards
                                                </FormLabel>
                                            </FormItem>
                                            <span className={styles.notice}>
                                                Each time your goal is reached,
                                                a fixed amount that you define
                                                is automatically distributed to
                                                the business introducer and the
                                                new customer
                                            </span>
                                        </div>
                                        <div className={styles.radio__group}>
                                            <FormItem variant={"radio"}>
                                                <FormControl>
                                                    <RadioGroupItem
                                                        value={"range"}
                                                    />
                                                </FormControl>
                                                <FormLabel variant={"radio"}>
                                                    Variable rewards
                                                </FormLabel>
                                            </FormItem>
                                            <span className={styles.notice}>
                                                Each time your goal is reached,
                                                an amount within a range you
                                                define is automatically
                                                distributed to the business
                                                introducer and the new customer.
                                                The amount of rewards
                                                distributed is determined
                                                randomly. Your CAC at the end of
                                                the campaign is respected.
                                            </span>
                                        </div>
                                    </RadioGroup>
                                </FormControl>
                            </div>
                        </Row>
                        <FormMessage />
                    </FormItem>
                )}
            />
        </Panel>
    );
}
