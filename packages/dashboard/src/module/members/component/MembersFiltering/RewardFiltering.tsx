import { FormField, FormItem, FormLabel } from "@/module/forms/Form";
import type { FormMembersFiltering } from "@/module/members/component/MembersFiltering/index";
import { Columns } from "@module/component/Columns";
import { Checkbox } from "@module/component/forms/Checkbox";
import { Input } from "@module/component/forms/Input";
import { useFormContext, useWatch } from "react-hook-form";

export function RewardFiltering() {
    const { control } = useFormContext<FormMembersFiltering>();
    const currentRewards = useWatch({ control, name: "rewards" });
    const rewardsInputDisabled = currentRewards === undefined;

    return (
        <div>
            <FormField
                control={control}
                name={"rewards"}
                render={({ field }) => (
                    <FormItem variant={"checkbox"}>
                        <Checkbox
                            checked={!rewardsInputDisabled}
                            id={"reward-filters"}
                            onCheckedChange={(checked) => {
                                field.onChange(
                                    checked
                                        ? { min: 1, max: undefined }
                                        : undefined
                                );
                            }}
                        />
                        <FormLabel
                            weight={"medium"}
                            variant={"checkbox"}
                            selected={!!field.value}
                        >
                            Rewards
                        </FormLabel>
                    </FormItem>
                )}
            />
            <Columns>
                <FormField
                    control={control}
                    name={"rewards.min"}
                    disabled={rewardsInputDisabled}
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel weight={"medium"}>From</FormLabel>
                            <Input
                                type={"number"}
                                {...field}
                                value={
                                    rewardsInputDisabled
                                        ? ""
                                        : field.value ?? ""
                                }
                                placeholder={"Min reward"}
                            />
                        </FormItem>
                    )}
                />
                <FormField
                    control={control}
                    name={"rewards.max"}
                    disabled={rewardsInputDisabled}
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel weight={"medium"}>To</FormLabel>
                            <Input
                                type={"number"}
                                {...field}
                                value={
                                    rewardsInputDisabled
                                        ? ""
                                        : field.value ?? ""
                                }
                                placeholder={"Max reward"}
                            />
                        </FormItem>
                    )}
                />
            </Columns>
        </div>
    );
}
