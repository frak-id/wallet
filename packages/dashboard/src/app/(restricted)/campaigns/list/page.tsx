import { Breadcrumb } from "@/module/common/component/Breadcrumb";
import { ButtonNewCampaign } from "@/module/common/component/ButtonNewCampaign";
import { Filters } from "@/module/common/component/Filters";
import { Head } from "@/module/common/component/Head";
import { TableCampaigns } from "@/module/common/component/TableCampaigns";

export default function CampaignsListPage() {
    return (
        <>
            <Head
                title={{ content: "Campaigns" }}
                leftSection={<Breadcrumb />}
                rightSection={<ButtonNewCampaign />}
            />
            <Filters />
            <TableCampaigns />
        </>
    );
}
