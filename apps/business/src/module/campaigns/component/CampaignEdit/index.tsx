import { Button } from "@frak-labs/ui/component/Button";
import { useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { FormBudget } from "@/module/campaigns/component/Creation/NewCampaign/FormBudget";
import { FormSchedule } from "@/module/campaigns/component/Creation/NewCampaign/FormSchedule";
import { useSaveCampaign } from "@/module/campaigns/hook/useSaveCampaign";
import { ActionsWrapper } from "@/module/common/component/ActionsWrapper";
import { Head } from "@/module/common/component/Head";
import { Form, FormLayout } from "@/module/forms/Form";
import { type CampaignDraft, campaignStore } from "@/stores/campaignStore";

export function CampaignEdit({ campaignId }: { campaignId: string }) {
    const navigate = useNavigate();
    const draft = campaignStore((state) => state.draft);
    const saveCampaign = useSaveCampaign();

    const formValues = useMemo(
        () => ({ ...draft, id: campaignId }),
        [draft, campaignId]
    );

    const form = useForm<CampaignDraft>({
        values: formValues,
    });

    async function onSubmit(values: CampaignDraft) {
        await saveCampaign.mutateAsync(values);
        navigate({ to: "/campaigns/list" });
    }

    return (
        <FormLayout>
            <Head title={{ content: "Edit campaign", size: "small" }} />
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)}>
                    <FormBudget />
                    <FormSchedule />
                    <ActionsWrapper
                        right={
                            <Button
                                type="submit"
                                variant="submit"
                                disabled={saveCampaign.isPending}
                                isLoading={saveCampaign.isPending}
                            >
                                Save Changes
                            </Button>
                        }
                    />
                </form>
            </Form>
        </FormLayout>
    );
}
