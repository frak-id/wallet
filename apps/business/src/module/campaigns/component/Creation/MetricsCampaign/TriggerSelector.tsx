import { useEffect, useMemo } from "react";
import { useFormContext } from "react-hook-form";
import {
    FormControl,
    FormField,
    FormItem,
    FormLabel,
} from "@/module/forms/Form";
import { RadioGroup, RadioGroupItem } from "@/module/forms/RadioGroup";
import { campaignStore } from "@/stores/campaignStore";
import styles from "./index.module.css";
import { getTriggersForGoal } from "./utils";

export function TriggerSelector() {
    const { control, setValue, watch } = useFormContext();
    const goal = campaignStore((s) => s.draft.metadata.goal);
    const currentTrigger = watch("trigger");

    const availableTriggers = useMemo(() => getTriggersForGoal(goal), [goal]);

    // Auto-select first valid trigger when current selection is not allowed
    useEffect(() => {
        if (availableTriggers.length === 0) return;
        const isCurrentValid = availableTriggers.some(
            (t) => t.value === currentTrigger
        );
        if (!isCurrentValid) {
            setValue("trigger", availableTriggers[0].value);
        }
    }, [availableTriggers, currentTrigger, setValue]);

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
                            {availableTriggers.map((trigger) => (
                                <FormItem variant="radio" key={trigger.value}>
                                    <FormControl>
                                        <RadioGroupItem value={trigger.value} />
                                    </FormControl>
                                    <FormLabel variant="radio">
                                        {trigger.label}
                                    </FormLabel>
                                </FormItem>
                            ))}
                        </RadioGroup>
                    </FormControl>
                </FormItem>
            )}
        />
    );
}
