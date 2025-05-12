import { AuthenticationGated } from "@/module/embedded/component/AuthenticationGated";
import { EmbeddedCreateCampaign } from "@/module/embedded/component/CreateCampaign";

export default async function EmbeddedCreateCampaignPage() {
    return (
        <AuthenticationGated action="validate your product">
            <EmbeddedCreateCampaign />
        </AuthenticationGated>
    );
}
