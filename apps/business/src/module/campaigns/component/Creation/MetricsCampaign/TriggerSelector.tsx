import { useFormContext } from "react-hook-form";
import {
    FormControl,
    FormField,
    FormItem,
    FormLabel,
} from "@/module/forms/Form";
import { RadioGroup, RadioGroupItem } from "@/module/forms/RadioGroup";
import styles from "./index.module.css";

export function TriggerSelector() {
    const { control } = useFormContext();

    return (
        <FormField
            control={control}
            name="trigger"
            render={({ field }) => (
                <FormItem>
                    <FormLabel>Trigger Event</FormLabel>
                    <FormControl>
                        <RadioGroup
                            onValueChange={field.onChange}
                            value={field.value}
                            className={styles.triggerGroup}
                        >
                            <FormItem variant="radio">
                                <FormControl>
                                    <RadioGroupItem value="referral" />
                                </FormControl>
                                <FormLabel variant="radio">Referral</FormLabel>
                            </FormItem>

                            <FormItem variant="radio">
                                <FormControl>
                                    <RadioGroupItem value="create_referral_link" />
                                </FormControl>
                                <FormLabel variant="radio">
                                    Referral Link Created
                                </FormLabel>
                            </FormItem>

                            <FormItem variant="radio">
                                <FormControl>
                                    <RadioGroupItem value="purchase" />
                                </FormControl>
                                <FormLabel variant="radio">
                                    Purchase completed
                                </FormLabel>
                            </FormItem>

                            <FormItem variant="radio">
                                <FormControl>
                                    <RadioGroupItem value="custom" />
                                </FormControl>
                                <FormLabel variant="radio">Custom</FormLabel>
                            </FormItem>

                            <FormItem
                                variant="radio"
                                className={styles.triggerDisabled}
                            >
                                <FormControl>
                                    <RadioGroupItem value="" disabled />
                                </FormControl>
                                <FormLabel variant="radio">
                                    More to come
                                </FormLabel>
                            </FormItem>
                        </RadioGroup>
                    </FormControl>
                </FormItem>
            )}
        />
    );
}
