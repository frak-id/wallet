"use client";

import { campaignAtom } from "@/module/campaigns/atoms/campaign";
import { Actions } from "@/module/campaigns/component/Actions";
import { FormPriceRange } from "@/module/campaigns/component/Creation/MetricsCampaign/FormPriceRange";
import { ButtonCancel } from "@/module/campaigns/component/Creation/NewCampaign/ButtonCancel";
import { useSaveCampaign } from "@/module/campaigns/hook/useSaveCampaign";
import { Head } from "@/module/common/component/Head";
import { Form, FormLayout } from "@/module/forms/Form";
import { useProductMetadata } from "@/module/product/hook/useProductMetadata";
import type { Campaign } from "@/types/Campaign";
import { useAtomValue } from "jotai";
import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { toHex } from "viem";

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

    const form = useForm<Campaign["triggers"]>({
        values: useMemo(() => campaign.triggers, [campaign.triggers]),
    });

    async function onSubmit(values: Campaign["triggers"]) {
        await saveCampaign({ ...campaign, triggers: values });
    }

    return (
        <FormLayout>
            <Head
                title={{ content: "Campaign Metrics", size: "small" }}
                rightSection={
                    <ButtonCancel
                        onClick={() => form.reset(campaign.triggers)}
                    />
                }
            />
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)}>
                    {!productIsPending && product?.productTypes && (
                        <FormPriceRange
                            form={form}
                            productTypes={product?.productTypes}
                        />
                    )}
                    <Actions />
                </form>
            </Form>
        </FormLayout>
    );
}
