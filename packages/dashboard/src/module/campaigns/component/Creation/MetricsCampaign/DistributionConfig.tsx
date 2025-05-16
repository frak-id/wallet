"use client";

import { Badge } from "@/module/common/component/Badge";
import { Head } from "@/module/common/component/Head";
import { Panel } from "@/module/common/component/Panel";
import {
    FormControl,
    FormDescription,
    FormField,
    FormLabel,
} from "@/module/forms/Form";
import { FormItem } from "@/module/forms/Form";
import { FormMessage } from "@/module/forms/Form";
import type { Campaign } from "@/types/Campaign";
import { Slider } from "@shared/module/component/Slider";
import type { UseFormReturn } from "react-hook-form";
import { TriggerConfigurationDetails } from "../Generic/TriggerConfigurationDetails";

export function DistributionConfiguration({
    distributionType,
    form,
}: {
    distributionType: "range" | "fixed";
    form: UseFormReturn<Campaign>;
}) {
    return (
        <>
            <Panel title="Set reward amounts">
                <Head
                    title={{
                        content: `Set ${
                            distributionType === "range" ? "variable" : "fixed"
                        } reward amounts`,
                        size: "small",
                    }}
                />
                <FormField
                    control={form.control}
                    name="rewardChaining.userPercent"
                    render={({ field }) => (
                        <FormItem>
                            {distributionType === "range" && (
                                <FormDescription>
                                    Variable rewards allow you to offer more
                                    attractive reward amounts to your customers.
                                    Frak guarantees compliance with your CPA at
                                    the end of your acquisition campaign. Define
                                    the reward range and its distribution.
                                </FormDescription>
                            )}
                            {distributionType === "fixed" && (
                                <FormDescription>
                                    When your goal is reached, the rewards are
                                    distributed instantly and automatically to
                                    the business introducer and the new
                                    customer, directly into their wallets, in
                                    the set proportions.
                                </FormDescription>
                            )}
                            <FormLabel>
                                Referrer/Referee Repartition{" "}
                                <Badge variant="primary" size="small">
                                    {Math.round((field.value ?? 0.1) * 100)}%
                                </Badge>
                            </FormLabel>
                            <FormControl>
                                <Slider
                                    defaultValue={[0.1]}
                                    min={0.1}
                                    max={0.9}
                                    step={0.05}
                                    onValueChange={field.onChange}
                                    value={[field.value ?? 0.1]}
                                    label="User Percent"
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <RangeBudgetMultiplierSlider
                    distributionType={distributionType}
                    form={form}
                />
                <TriggerConfigurationDetails />
            </Panel>
        </>
    );
}

function RangeBudgetMultiplierSlider({
    distributionType,
    form,
}: {
    distributionType: "range" | "fixed";
    form: UseFormReturn<Campaign>;
}) {
    if (distributionType !== "range") {
        return null;
    }

    return (
        <>
            <FormField
                control={form.control}
                name="distribution.minMultiplier"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>
                            Reward min{" "}
                            <Badge variant="primary" size="small">
                                {field.value ?? 0.7}x
                            </Badge>
                        </FormLabel>
                        <FormControl>
                            <Slider
                                defaultValue={[0.7]}
                                min={0.7}
                                max={1}
                                step={0.05}
                                onValueChange={field.onChange}
                                value={[field.value ?? 0.7]}
                                label="Reward min"
                            />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />
            <FormField
                control={form.control}
                name="distribution.maxMultiplier"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>
                            Reward max{" "}
                            <Badge variant="primary" size="small">
                                {field.value ?? 5}x
                            </Badge>
                        </FormLabel>
                        <FormControl>
                            <Slider
                                defaultValue={[5]}
                                min={1}
                                max={5}
                                step={0.05}
                                onValueChange={field.onChange}
                                value={[field.value ?? 5]}
                                label="Reward max"
                            />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />
        </>
    );
}
