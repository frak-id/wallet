import { FormField, FormItem, FormLabel } from "@/module/forms/Form";
import type { FormMembersFiltering } from "@/module/members/component/MembersFiltering/index";
import { Columns } from "@module/component/Columns";
import { Checkbox } from "@module/component/forms/Checkbox";
import { Input } from "@module/component/forms/Input";
import { useFormContext, useWatch } from "react-hook-form";

export function InteractionsFiltering() {
    const { control } = useFormContext<FormMembersFiltering>();
    const currentInteractions = useWatch({ control, name: "interactions" });
    const inputDisabled = currentInteractions === undefined;

    return (
        <div>
            <FormField
                control={control}
                name={"interactions"}
                render={({ field }) => (
                    <FormItem variant={"checkbox"}>
                        <Checkbox
                            checked={!inputDisabled}
                            id={"interaction-filters"}
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
                            Interactions
                        </FormLabel>
                    </FormItem>
                )}
            />
            <Columns>
                <FormField
                    control={control}
                    name={"interactions.min"}
                    disabled={inputDisabled}
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel weight={"medium"}>From</FormLabel>
                            <Input
                                type={"number"}
                                {...field}
                                value={inputDisabled ? "" : field.value ?? ""}
                                placeholder={"Min interactions"}
                            />
                        </FormItem>
                    )}
                />
                <FormField
                    control={control}
                    name={"interactions.max"}
                    disabled={inputDisabled}
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel weight={"medium"}>To</FormLabel>
                            <Input
                                type={"number"}
                                {...field}
                                value={inputDisabled ? "" : field.value ?? ""}
                                placeholder={"Max interactions"}
                            />
                        </FormItem>
                    )}
                />
            </Columns>
        </div>
    );
}
