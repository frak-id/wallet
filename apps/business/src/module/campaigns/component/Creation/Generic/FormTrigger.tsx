import { useFormContext } from "react-hook-form";
import {
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/module/forms/Form";
import { RadioGroup, RadioGroupItem } from "@/module/forms/RadioGroup";

export function FormTrigger() {
    const { control } = useFormContext();

    return (
        <FormField
            control={control}
            name="trigger"
            rules={{ required: "Please select a trigger" }}
            render={({ field }) => (
                <FormItem>
                    <FormLabel>Trigger Event</FormLabel>
                    <FormControl>
                        <RadioGroup
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                            value={field.value}
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
                                <FormLabel variant="radio">Purchase</FormLabel>
                            </FormItem>

                            <FormItem variant="radio">
                                <FormControl>
                                    <RadioGroupItem value="custom" />
                                </FormControl>
                                <FormLabel variant="radio">Custom</FormLabel>
                            </FormItem>
                        </RadioGroup>
                    </FormControl>
                    <FormMessage />
                </FormItem>
            )}
        />
    );
}
