import { Panel } from "@/module/common/component/Panel";
import { useMyContents } from "@/module/dashboard/hooks/useMyContents";
import {
    FormControl,
    FormField,
    FormItem,
    FormMessage,
} from "@/module/forms/Form";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/module/forms/Select";
import type { Campaign } from "@/types/Campaign";
import type { UseFormReturn } from "react-hook-form";

export function FormProduct(form: UseFormReturn<Campaign>) {
    const { isEmpty, contents } = useMyContents();
    const contentList = [
        ...(contents?.operator ?? []),
        ...(contents?.owner ?? []),
    ];

    if (isEmpty) return null;

    return (
        <Panel title="Product">
            <FormField
                control={form.control}
                name="contentId"
                rules={{ required: "Select a product" }}
                render={({ field }) => (
                    <FormItem>
                        <FormControl>
                            <Select
                                name={field.name}
                                onValueChange={field.onChange}
                                defaultValue={field.value}
                            >
                                <SelectTrigger length={"medium"} {...field}>
                                    <SelectValue placeholder="Select a product" />
                                </SelectTrigger>
                                <SelectContent>
                                    {contentList.map((content) => (
                                        <SelectItem
                                            key={content.id}
                                            value={content.id.toString()}
                                        >
                                            {content.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />
        </Panel>
    );
}
