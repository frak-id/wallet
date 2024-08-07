import {
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/module/forms/Form";
import type { Campaign } from "@/types/Campaign";
import { Checkbox } from "@module/component/forms/Checkbox";
import type { UseFormReturn } from "react-hook-form";

const itemsSpecialAdvertising = [
    {
        id: "text",
        label: "Text",
    },
    {
        id: "video",
        label: "Video",
    },
    {
        id: "product",
        label: "Product",
    },
    {
        id: "others",
        label: "Others",
    },
] as const;

export function FormPromotedContent(form: UseFormReturn<Campaign>) {
    return (
        <FormField
            control={form.control}
            name="promotedContents"
            render={() => (
                <FormItem>
                    <FormDescription title={"Promoted Content"}>
                        Choose the type of content you want to promote
                    </FormDescription>
                    {itemsSpecialAdvertising.map((item) => (
                        <FormField
                            key={item.id}
                            control={form.control}
                            name="promotedContents"
                            render={({ field }) => (
                                <FormItem variant={"checkbox"} key={item.id}>
                                    <FormControl>
                                        <Checkbox
                                            checked={field.value?.includes(
                                                item.id
                                            )}
                                            onCheckedChange={(checked) => {
                                                return checked
                                                    ? field.onChange([
                                                          ...field.value,
                                                          item.id,
                                                      ])
                                                    : field.onChange(
                                                          field.value?.filter(
                                                              (value) =>
                                                                  value !==
                                                                  item.id
                                                          )
                                                      );
                                            }}
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormLabel
                                        variant={"checkbox"}
                                        selected={field.value?.includes(
                                            item.id
                                        )}
                                    >
                                        {item.label}
                                    </FormLabel>
                                </FormItem>
                            )}
                        />
                    ))}
                    <FormMessage />
                </FormItem>
            )}
        />
    );
}
