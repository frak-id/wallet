import { Input } from "@frak-labs/ui/component/forms/Input";
import type { UseFormReturn } from "react-hook-form";
import type { CampaignFormValues } from "@/module/campaigns/component/Creation/NewCampaign/types";
import { Panel } from "@/module/common/component/Panel";
import {
    FormControl,
    FormField,
    FormItem,
    FormMessage,
} from "@/module/forms/Form";

export function FormTitle(form: UseFormReturn<CampaignFormValues>) {
    return (
        <Panel title="Campaign Title">
            <FormField
                control={form.control}
                name="name"
                rules={{ required: "Invalid title" }}
                render={({ field }) => (
                    <FormItem>
                        <FormControl>
                            <Input
                                placeholder={"New awareness campaign"}
                                {...field}
                            />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />
        </Panel>
    );
}
