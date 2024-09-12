import { FormField, FormItem, FormLabel } from "@/module/forms/Form";
import type { FormMembersFiltering } from "@/module/members/component/MembersFiltering/index";
import { Columns } from "@module/component/Columns";
import { Checkbox } from "@module/component/forms/Checkbox";
import { Input } from "@module/component/forms/Input";
import { useMemo } from "react";
import { useFormContext } from "react-hook-form";

export function RewardFiltering() {
    const form = useFormContext<FormMembersFiltering>();
    const inputDisabled = useMemo(
        () => form.getValues("rewards") === undefined,
        [form]
    );

    return (
        <div>
            <FormField
                control={form.control}
                name={"rewards"}
                render={({ field }) => (
                    <FormItem variant={"checkbox"}>
                        <Checkbox
                            checked={!!field.value}
                            id={"reward-filters"}
                            onCheckedChange={(checked) => {
                                field.onChange(
                                    checked
                                        ? { min: 0, max: undefined }
                                        : undefined
                                );
                            }}
                        />
                        <FormLabel
                            weight={"medium"}
                            variant={"checkbox"}
                            selected={!!field.value}
                        >
                            Reward filtering
                        </FormLabel>
                    </FormItem>
                )}
            />
            <Columns>
                <FormField
                    control={form.control}
                    name={"rewards.min"}
                    disabled={inputDisabled}
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel weight={"medium"}>From</FormLabel>
                            <Input
                                type={"number"}
                                {...field}
                                value={field.value ?? ""}
                                placeholder={"Min reward"}
                            />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name={"rewards.max"}
                    disabled={inputDisabled}
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel weight={"medium"}>To</FormLabel>
                            <Input
                                type={"number"}
                                {...field}
                                value={field.value ?? ""}
                                placeholder={"Max reward"}
                            />
                        </FormItem>
                    )}
                />
            </Columns>
        </div>
    );
}
