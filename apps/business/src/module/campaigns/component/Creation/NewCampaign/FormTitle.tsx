import { Input } from "@frak-labs/ui/component/forms/Input";
import { useFormContext } from "react-hook-form";
import { Panel } from "@/module/common/component/Panel";
import {
    FormControl,
    FormField,
    FormItem,
    FormMessage,
} from "@/module/forms/Form";
import type { CampaignDraft } from "@/stores/campaignStore";

export function FormTitle() {
    const { control } = useFormContext<CampaignDraft>();

    return (
        <Panel title="Campaign Title">
            <FormField
                control={control}
                name="name"
                rules={{ required: "Invalid title" }}
                render={({ field }) => (
                    <FormItem>
                        <FormControl>
                            <Input
                                placeholder="New awareness campaign"
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
