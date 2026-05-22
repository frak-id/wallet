import {
    Card,
    CardHeader,
    CardTitle,
} from "@frak-labs/design-system/components/Card";
import { Checkbox } from "@frak-labs/design-system/components/Checkbox";
import { useFormContext } from "react-hook-form";
import {
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/module/forms/Form";
import type { CampaignDraft } from "@/stores/campaignStore";
import * as styles from "./form-special-advertising.css";

const itemsSpecialAdvertising = [
    {
        id: "credit",
        label: (
            <>
                Credit
                <span className={styles.checkboxInformation}>
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
                <span className={styles.checkboxInformation}>
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
                <span className={styles.checkboxInformation}>
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
                <span className={styles.checkboxInformation}>
                    Advertisements concerning social issues, elections, or
                    political figures or campaigns.
                </span>
            </>
        ),
    },
] as const;

export function FormSpecialAdvertising() {
    const { control } = useFormContext<CampaignDraft>();

    return (
        <Card>
            <CardHeader>
                <CardTitle>Special advertising categories</CardTitle>
            </CardHeader>
            <FormField
                control={control}
                name="metadata.specialCategories"
                render={() => (
                    <FormItem>
                        <FormDescription>
                            Declare whether your ads concern credit, employment,
                            housing or a social, electoral or political issue.
                        </FormDescription>
                        {itemsSpecialAdvertising.map((item) => (
                            <FormField
                                key={item.id}
                                control={control}
                                name="metadata.specialCategories"
                                rules={{
                                    validate: {
                                        required: (value) =>
                                            !value?.length
                                                ? undefined
                                                : "Special advertising categories are not supported yet",
                                    },
                                }}
                                render={({ field }) => (
                                    <FormItem variant="checkbox" key={item.id}>
                                        <FormControl>
                                            <Checkbox
                                                checked={field.value?.includes(
                                                    item.id
                                                )}
                                                onCheckedChange={(checked) =>
                                                    checked
                                                        ? field.onChange([
                                                              ...(field.value ??
                                                                  []),
                                                              item.id,
                                                          ])
                                                        : field.onChange(
                                                              field.value?.filter(
                                                                  (v: string) =>
                                                                      v !==
                                                                      item.id
                                                              )
                                                          )
                                                }
                                            />
                                        </FormControl>
                                        <FormLabel
                                            variant="checkbox"
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
        </Card>
    );
}
