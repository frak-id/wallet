"use client";

import { Breadcrumb } from "@/module/common/component/Breadcrumb";
import { Head } from "@/module/common/component/Head";
import { MyContents } from "@/module/dashboard/component/Contents";
import { Home } from "@/module/dashboard/component/Home";

export default function DashboardPage() {
    return (
        <>
            <Head
                title={{ content: "Dashboard" }}
                leftSection={<Breadcrumb current={"Home"} />}
            />

            <Home />

            <MyContents />
        </>
    );
}
