"use client";

import { Badge } from "@/module/common/component/Badge";
import { Head } from "@/module/common/component/Head";
import { Panel } from "@/module/common/component/Panel";
import { FormControl, FormField, FormLabel } from "@/module/forms/Form";
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
            <Panel title="Distribution Configuration">
                <Head
                    title={{
                        content: "Distribution Configuration",
                        size: "small",
                    }}
                />
                <FormField
                    control={form.control}
                    name="rewardChaining.userPercent"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>
                                Referrer/Referee Repartition:{" "}
                                <Badge variant="primary" size="small">
                                    {Math.round((field.value ?? 0.1) * 100)}%
                                </Badge>
                            </FormLabel>
                            <FormControl>
                                <Slider
                                    defaultValue={[0.1]}
                                    min={0.01}
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
                            Min Multiplier:{" "}
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
                                label="Min Multiplier"
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
                            Max Multiplier:{" "}
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
                                label="Max Multiplier"
                            />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />
        </>
    );
}
