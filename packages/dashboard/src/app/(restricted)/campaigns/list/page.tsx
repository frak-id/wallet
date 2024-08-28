import { Breadcrumb } from "@/module/common/component/Breadcrumb";
import { Filters } from "@/module/common/component/Filters";
import { Head } from "@/module/common/component/Head";
import { ButtonNewCampaign } from "../../../../module/campaigns/component/ButtonNewCampaign";
import { TableCampaigns } from "../../../../module/campaigns/component/TableCampaigns";

export default function CampaignsListPage() {
    return (
        <>
            <Head
                title={{ content: "Campaigns" }}
                leftSection={<Breadcrumb current={"Campaign List"} />}
                rightSection={<ButtonNewCampaign />}
            />
            <Filters />
            <TableCampaigns />
        </>
    );
}
