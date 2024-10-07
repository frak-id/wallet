"use client";

import { FormLayout } from "@/module/forms/Form";
import { ManageProductTeam } from "@/module/product/component/ProductDetails/ManageTeam";
import { ProductHead } from "@/module/product/component/ProductHead";
import type { Hex } from "viem";

export function Team({ productId }: { productId: Hex }) {
    return (
        <FormLayout>
            <ProductHead productId={productId} />
            <ManageProductTeam productId={productId} />
        </FormLayout>
    );
}
