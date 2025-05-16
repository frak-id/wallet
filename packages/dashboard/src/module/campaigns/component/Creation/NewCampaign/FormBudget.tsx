import { FormBudgetRow } from "@/module/campaigns/component/Creation/NewCampaign/FormBudgetRow";
import { Panel } from "@/module/common/component/Panel";
import { FormDescription } from "@/module/forms/Form";

export function FormBudget() {
    return (
        <Panel title="Global budget">
            <FormDescription>
                The campaign budget will allocate this to your currently running
                ad sets for best results based on your choices and bidding
                strategy (performance target).
            </FormDescription>
            <FormBudgetRow />
        </Panel>
    );
}
