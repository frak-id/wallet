"use client";

import { campaignAtom } from "@/module/campaigns/atoms/campaign";
import { Actions } from "@/module/campaigns/component/Actions";
import { ButtonCancel } from "@/module/campaigns/component/Creation/NewCampaign/ButtonCancel";
import { useSaveCampaign } from "@/module/campaigns/hook/useSaveCampaign";
import { Head } from "@/module/common/component/Head";
import { Panel } from "@/module/common/component/Panel";
import { Form, FormLayout } from "@/module/forms/Form";
import { useProductMetadata } from "@/module/product/hook/useProductMetadata";
import type { Campaign } from "@/types/Campaign";
import { Skeleton } from "@frak-labs/shared/module/component/Skeleton";
import { useAtomValue } from "jotai";
import { useMemo } from "react";
import { useForm, useFormContext } from "react-hook-form";
import { toHex } from "viem";
import { DistributionConfiguration } from "./DistributionConfig";
import { FormTriggersCac } from "./FormTriggersCac";

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
                    <DistributionTypeToggle />
                    <FormTriggersCac
                        productTypes={product?.productTypes ?? []}
                    />
                    <DistributionConfiguration
                        distributionType={distributionType}
                    />

                    <Actions isLoading={productIsPending} />
                </form>
            </Form>
        </FormLayout>
    );
}

function DistributionTypeToggle() {
    const { register } = useFormContext();
    return (
        <Panel title="Distribution Type">
            <label>
                <input
                    type="radio"
                    value="fixed"
                    {...register("distribution.type")}
                />
                Fixed
            </label>
            <label>
                <input
                    type="radio"
                    value="range"
                    {...register("distribution.type")}
                />
                Range
            </label>
        </Panel>
    );
}
