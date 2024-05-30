import { Filters } from "@/module/common/component/Filters";
import { Head } from "@/module/common/component/Head";
import { TableCampaigns } from "@/module/common/component/TableCampaigns";

export default function CampaignsPage() {
    return (
        <>
            <Head />
            <Filters />
            <TableCampaigns />
        </>
    );
}
