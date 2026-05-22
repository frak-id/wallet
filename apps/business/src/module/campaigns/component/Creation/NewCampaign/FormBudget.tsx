import {
    Card,
    CardHeader,
    CardTitle,
} from "@frak-labs/design-system/components/Card";
import { FormBudgetRow } from "@/module/campaigns/component/Creation/NewCampaign/FormBudgetRow";
import { FormDescription } from "@/module/forms/Form";

export function FormBudget() {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Global budget</CardTitle>
            </CardHeader>
            <FormDescription>
                The budget is the global amount allocated to your word-of-mouth
                acquisition campaign. This sum is used to pay out rewards to
                your community (referrers and new customers). Frak takes a
                global commission of 20% on the campaign budget, at no extra
                charge.
            </FormDescription>
            <FormBudgetRow />
        </Card>
    );
}
