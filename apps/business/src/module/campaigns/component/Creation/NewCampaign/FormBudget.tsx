import {
    Card,
    CardHeader,
    CardTitle,
} from "@frak-labs/design-system/components/Card";
import { useTranslation } from "react-i18next";
import { FormBudgetRow } from "@/module/campaigns/component/Creation/NewCampaign/FormBudgetRow";
import { FormDescription } from "@/module/forms/Form";

export function FormBudget() {
    const { t } = useTranslation();
    return (
        <Card>
            <CardHeader>
                <CardTitle>{t("campaigns.creation.budget.title")}</CardTitle>
            </CardHeader>
            <FormDescription>
                {t("campaigns.creation.budget.description")}
            </FormDescription>
            <FormBudgetRow />
        </Card>
    );
}
