import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_layout/campaigns")({
    component: CampaignsComponent,
});

function CampaignsComponent() {
    return (
        <div className="p-4">
            <p>Campaigns listing will appear here</p>
        </div>
    );
}
