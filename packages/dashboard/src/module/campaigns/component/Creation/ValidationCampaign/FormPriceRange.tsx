import { FormDescription, FormItem } from "@/module/forms/Form";
import type { Campaign } from "@/types/Campaign";
import type { InteractionTypesKey } from "@frak-labs/core-sdk";
import type { UseFormReturn } from "react-hook-form";
import { FormTrigger } from "../Generic/FormTrigger";

export function FormPriceRange({
    form,
    disabled,
}: {
    form: UseFormReturn<Campaign>;
    disabled?: boolean;
}) {
    const triggers = form.getValues("triggers");
    return (
        <FormItem>
            <FormDescription label={"CAC Configuration"} />
            {triggers &&
                Object.keys(triggers).map((trigger) => (
                    <FormTrigger
                        key={trigger}
                        interaction={trigger as InteractionTypesKey}
                        hideIfAllZero={true}
                        disabled={disabled}
                        defaultChecked={true}
                    />
                ))}
        </FormItem>
    );
}
