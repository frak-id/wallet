import type { FormCampaignsValidation } from "@/module/campaigns/component/ValidationCampaign/index";
import { Badge } from "@/module/common/component/Badge";
import { Checkbox } from "@/module/forms/Checkbox";
import {
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/module/forms/Form";
import { X } from "lucide-react";
import type { UseFormReturn } from "react-hook-form";
import styles from "./FormPromotedContent.module.css";

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

export function FormPromotedContent(
    form: UseFormReturn<FormCampaignsValidation>
) {
    return (
        <FormField
            control={form.control}
            name="promotedContent"
            render={() => (
                <FormItem>
                    <FormDescription title={"Promoted Content"}>
                        Choose the type of content you want to promote
                    </FormDescription>
                    {itemsSpecialAdvertising.map((item) => (
                        <FormField
                            key={item.id}
                            control={form.control}
                            name="promotedContent"
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
                    <div className={styles.badges}>
                        <Badge variant={"secondary"}>
                            sport <X size={16} />
                        </Badge>
                        <Badge variant={"secondary"}>
                            news <X size={16} />
                        </Badge>
                        <Badge variant={"secondary"}>
                            fun <X size={16} />
                        </Badge>
                    </div>
                </FormItem>
            )}
        />
    );
}
