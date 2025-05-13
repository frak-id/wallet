"use client";

import { campaignAtom } from "@/module/campaigns/atoms/campaign";
import { Actions } from "@/module/campaigns/component/Actions";
import { ButtonCancel } from "@/module/campaigns/component/Creation/NewCampaign/ButtonCancel";
import { useSaveCampaign } from "@/module/campaigns/hook/useSaveCampaign";
import { Head } from "@/module/common/component/Head";
import { Form, FormLayout } from "@/module/forms/Form";
import { useProductMetadata } from "@/module/product/hook/useProductMetadata";
import type { Campaign } from "@/types/Campaign";
import { useAtomValue } from "jotai";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toHex } from "viem";
import { Panel } from "../../../../common/component/Panel";
import { FormPriceRange } from "./FormPriceRange";

export function MetricsCampaign() {
    const campaign = useAtomValue(campaignAtom);
    const saveCampaign = useSaveCampaign();
    // User percent state (default to campaign.rewardChaining?.userPercent or 50)
    const [userPercent, setUserPercent] = useState<number>(
        campaign.rewardChaining?.userPercent ?? 50
    );

    const pId = useMemo(() => {
        if (!campaign.productId) return;
        return toHex(BigInt(campaign.productId));
    }, [campaign.productId]);

    const { data: product, isPending: productIsPending } = useProductMetadata({
        productId: pId,
    });
    const form = useForm<Campaign>({
        values: useMemo(() => campaign, [campaign]),
    });
    const distributionType = form.getValues("distribution.type") ?? "fixed";

    function _handleSave(triggers: Campaign["triggers"]) {
        saveCampaign({
            ...campaign,
            triggers,
            distribution:
                distributionType === "fixed"
                    ? { type: "fixed" }
                    : { type: "range", minMultiplier: 1, maxMultiplier: 2 },
            rewardChaining: {
                ...campaign.rewardChaining,
                userPercent,
            },
        });
    }

    return (
        <FormLayout>
            <Form {...form}>
                <form>
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
                    <DistributionTypeToggle
                        distributionType={distributionType}
                        setDistributionType={(type) =>
                            form.setValue("distribution.type", type)
                        }
                    />
                    <FormPriceRange
                        productTypes={product?.productTypes ?? []}
                        distributionType={distributionType}
                    />
                    <DistributionConfiguration
                        userPercent={userPercent}
                        setUserPercent={setUserPercent}
                        isLoading={productIsPending}
                    />
                </form>
            </Form>
        </FormLayout>
    );
}

function DistributionTypeToggle({
    distributionType,
    setDistributionType,
}: {
    distributionType: "fixed" | "range";
    setDistributionType: (type: "fixed" | "range") => void;
}) {
    return (
        <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
            <label>
                <input
                    type="radio"
                    name="distributionType"
                    value="fixed"
                    checked={distributionType === "fixed"}
                    onChange={() => setDistributionType("fixed")}
                />
                Fixed
            </label>
            <label>
                <input
                    type="radio"
                    name="distributionType"
                    value="range"
                    checked={distributionType === "range"}
                    onChange={() => setDistributionType("range")}
                />
                Range
            </label>
        </div>
    );
}

function DistributionConfiguration({
    userPercent,
    setUserPercent,
    isLoading,
}: {
    userPercent: number;
    setUserPercent: (val: number) => void;
    isLoading: boolean;
}) {
    return (
        <FormLayout>
            <Panel title="Configure CAC">
                <Head
                    title={{
                        content: "Distribution Configuration",
                        size: "small",
                    }}
                />
                <div style={{ margin: "24px 0" }}>
                    <label htmlFor="userPercent-slider">
                        Referrer/Referee Repartition: {userPercent}%
                    </label>
                    <input
                        id="userPercent-slider"
                        type="range"
                        min={10}
                        max={90}
                        step={5}
                        value={userPercent}
                        onChange={(e) => setUserPercent(Number(e.target.value))}
                        style={{ width: 300, display: "block" }}
                    />
                </div>
                <div style={{ marginTop: 16 }}>
                    <strong>CAC per trigger:</strong>{" "}
                    {/* Placeholder for now */}
                    <span> [raw CAC per trigger]</span>
                </div>
            </Panel>
            <Actions isLoading={isLoading} />
        </FormLayout>
    );
}
