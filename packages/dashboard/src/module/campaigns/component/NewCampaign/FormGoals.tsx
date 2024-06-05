import type { FormCampaignsNew } from "@/module/campaigns/component/NewCampaign";
import { Column } from "@/module/common/component/Column";
import { Panel } from "@/module/common/component/Panel";
import {
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/module/forms/Form";
import { RadioGroup, RadioGroupItem } from "@/module/forms/RadioGroup";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/module/forms/Select";
import type { UseFormReturn } from "react-hook-form";

const itemsGoals = [
    {
        id: "awareness",
        label: "Awareness",
    },
    {
        id: "traffic",
        label: "Traffic",
    },
    {
        id: "registration",
        label: "Registration",
    },
    {
        id: "sales",
        label: "Sales",
    },
    {
        id: "retention",
        label: "Retention",
    },
] as const;

export function FormGoals(form: UseFormReturn<FormCampaignsNew>) {
    return (
        <Panel title="Goals">
            <Column>
                <FormField
                    control={form.control}
                    name="order"
                    rules={{ required: "Select an order" }}
                    render={({ field }) => (
                        <FormItem>
                            <FormDescription title={"Type of order"} />
                            <FormControl>
                                <Select
                                    onValueChange={field.onChange}
                                    defaultValue={field.value}
                                >
                                    <SelectTrigger {...field}>
                                        <SelectValue placeholder="Select an order" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="auctions">
                                            Auctions
                                        </SelectItem>
                                        <SelectItem value="other">
                                            Other
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
            </Column>
            <Column>
                <FormField
                    control={form.control}
                    name="goal"
                    rules={{ required: "Select a goal" }}
                    render={({ field }) => (
                        <FormItem>
                            <FormDescription title={"Campaign goal"} />
                            <FormControl>
                                <RadioGroup
                                    onValueChange={field.onChange}
                                    defaultValue={field.value}
                                    {...field}
                                >
                                    {itemsGoals.map((item) => (
                                        <FormItem
                                            variant={"radio"}
                                            key={item.id}
                                        >
                                            <FormControl>
                                                <RadioGroupItem
                                                    value={item.id}
                                                />
                                            </FormControl>
                                            <FormLabel variant={"radio"}>
                                                {item.label}
                                            </FormLabel>
                                        </FormItem>
                                    ))}
                                </RadioGroup>
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
            </Column>
        </Panel>
    );
}
