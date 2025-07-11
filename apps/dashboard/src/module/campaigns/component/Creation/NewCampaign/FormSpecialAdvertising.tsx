import { Panel } from "@/module/common/component/Panel";
import {
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/module/forms/Form";
import type { Campaign } from "@/types/Campaign";
import { Checkbox } from "@frak-labs/ui/component/forms/Checkbox";
import type { UseFormReturn } from "react-hook-form";
import styles from "./FormSpecialAdvertising.module.css";

const itemsSpecialAdvertising = [
    {
        id: "credit",
        label: (
            <>
                Credit
                <span className={styles.checkbox__information}>
                    Advertisements for credit card offers, car loans, long-term
                    financing or similar offers.
                </span>
            </>
        ),
    },
    {
        id: "jobs",
        label: (
            <>
                Jobs
                <span className={styles.checkbox__information}>
                    Advertisements for job offers, internships, professional
                    certification programs or other similar offers.
                </span>
            </>
        ),
    },
    {
        id: "housing",
        label: (
            <>
                Housing
                <span className={styles.checkbox__information}>
                    Advertisements for real estate ads, home insurance,
                    mortgages or similar offers.
                </span>
            </>
        ),
    },
    {
        id: "social",
        label: (
            <>
                Social, electoral or political issues
                <span className={styles.checkbox__information}>
                    Advertisements concerning social issues (such as the economy
                    or civil and social rights), elections, or political figures
                    or campaigns.
                </span>
            </>
        ),
    },
] as const;

export function FormSpecialAdvertising(form: UseFormReturn<Campaign>) {
    return (
        <Panel title="Special advertising categories">
            <FormField
                control={form.control}
                name="specialCategories"
                render={() => (
                    <FormItem>
                        <FormDescription>
                            Declare whether your ads concern credit, employment,
                            housing or a social, electoral or political issue.
                            Criteria differ from country to country.
                        </FormDescription>
                        {itemsSpecialAdvertising.map((item) => (
                            <FormField
                                key={item.id}
                                control={form.control}
                                name="specialCategories"
                                rules={{
                                    validate: {
                                        required: (value) =>
                                            value.length === 0
                                                ? undefined
                                                : "Special advertising categories are not supported for now",
                                    },
                                }}
                                render={({ field }) => (
                                    <FormItem
                                        variant={"checkbox"}
                                        key={item.id}
                                    >
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
        </Panel>
    );
}
