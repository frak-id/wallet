"use client";

import { Breadcrumb } from "@/module/common/component/Breadcrumb";
import { Button } from "@/module/common/component/Button";
import { Filters } from "@/module/common/component/Filters";
import { Head } from "@/module/common/component/Head";
import { TableCampaigns } from "@/module/common/component/TableCampaigns";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";

export default function CampaignsListPage() {
    const router = useRouter();

    return (
        <>
            <Head
                title={{ content: "Campaigns" }}
                leftSection={<Breadcrumb />}
                rightSection={
                    <Button
                        leftIcon={<Plus size={20} />}
                        onClick={() => router.push("/campaigns/new")}
                    >
                        Create Campaign
                    </Button>
                }
            />
            <Filters />
            <TableCampaigns />
        </>
    );
}
