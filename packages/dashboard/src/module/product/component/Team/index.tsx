"use client";

import { Panel } from "@/module/common/component/Panel";
import { FormLayout } from "@/module/forms/Form";
import { ProductHead } from "@/module/product/component/ProductHead";
import type { Hex } from "viem";
import { TableTeam } from "../TableTeam";

export function Team({ productId }: { productId: Hex }) {
    return (
        <FormLayout>
            <ProductHead productId={productId} />
            <Panel title={"Manage your team"}>
                {/* Display the administrators */}
                <TableTeam productId={productId} />
            </Panel>
        </FormLayout>
    );
}
