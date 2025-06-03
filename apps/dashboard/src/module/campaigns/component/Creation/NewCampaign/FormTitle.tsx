import { Panel } from "@/module/common/component/Panel";
import {
    FormControl,
    FormField,
    FormItem,
    FormMessage,
} from "@/module/forms/Form";
import type { Campaign } from "@/types/Campaign";
import { Input } from "@shared/module/component/forms/Input";
import type { UseFormReturn } from "react-hook-form";

export function FormTitle(form: UseFormReturn<Campaign>) {
    return (
        <Panel title="Campaign Title">
            <FormField
                control={form.control}
                name="title"
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
