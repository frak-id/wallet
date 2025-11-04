import { Button } from "@frak-labs/ui/component/Button";
import { useNavigate } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { campaignStore } from "@/stores/campaignStore";

export function ButtonNewCampaign() {
    const navigate = useNavigate();
    const reset = campaignStore((state) => state.reset);

    return (
        <Button
            leftIcon={<Plus size={20} />}
            onClick={() => {
                reset();
                navigate({ to: "/campaigns/new" });
            }}
        >
            Create Campaign
        </Button>
    );
}
