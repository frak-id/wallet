"use client";

import { Breadcrumb } from "@/module/common/component/Breadcrumb";
import { Head } from "@/module/common/component/Head";
import { MyProducts } from "@/module/dashboard/component/Products";

export default function DashboardPage() {
    return (
        <>
            <Head
                title={{ content: "Dashboard" }}
                leftSection={<Breadcrumb current={"Home"} />}
            />

            <MyProducts />
        </>
    );
}
