import { Head } from "@/module/common/component/Head";
import { Panel } from "@/module/common/component/Panel";
import { useFormContext } from "react-hook-form";
import { TriggerConfigurationDetails } from "./TriggerConfigurationDetails";

export function DistributionConfiguration({
    distributionType,
}: {
    distributionType: "range" | "fixed";
}) {
    const { register, watch } = useFormContext();

    const userPercent = watch("rewardChaining.userPercent");

    // todo: why min and max are saved as string ffs

    return (
        <>
            <Panel title="Distribution Configuration">
                <Head
                    title={{
                        content: "Distribution Configuration",
                        size: "small",
                    }}
                />
                <div>
                    <label htmlFor="userPercent-slider">
                        Referrer/Referee Repartition:{" "}
                        {Math.round((userPercent ?? 0.1) * 100)}%
                    </label>
                    <input
                        id="userPercent-slider"
                        type="range"
                        min={0.1}
                        max={0.9}
                        step={0.05}
                        style={{ width: 300, display: "block" }}
                        defaultValue={0.1}
                        {...register("rewardChaining.userPercent")}
                    />
                </div>
                <RangeBudgetMultiplierSlider
                    distributionType={distributionType}
                />
                <TriggerConfigurationDetails />
            </Panel>
        </>
    );
}

function RangeBudgetMultiplierSlider({
    distributionType,
}: {
    distributionType: "range" | "fixed";
}) {
    const { register, watch } = useFormContext();
    const minMultiplier = watch("distribution.minMultiplier");
    const maxMultiplier = watch("distribution.maxMultiplier");

    if (distributionType !== "range") {
        return null;
    }

    return (
        <>
            <div>
                <label htmlFor="minMultiplier-slider">
                    Min Multiplier: {minMultiplier}x
                </label>
                <input
                    id="minMultiplier-slider"
                    type="range"
                    min={0.7}
                    max={1}
                    step={0.05}
                    style={{ width: 300, display: "block" }}
                    defaultValue={0.7}
                    {...register("distribution.minMultiplier", {
                        valueAsNumber: true,
                    })}
                />
            </div>
            <div>
                <label htmlFor="maxMultiplier-slider">
                    Max Multiplier: {maxMultiplier}x
                </label>
                <input
                    id="maxMultiplier-slider"
                    type="range"
                    min={1}
                    max={5}
                    step={0.05}
                    style={{ width: 300, display: "block" }}
                    defaultValue={5}
                    {...register("distribution.maxMultiplier", {
                        valueAsNumber: true,
                    })}
                />
            </div>
        </>
    );
}
