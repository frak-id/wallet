import { X } from "lucide-react";
import type { Hex } from "viem";
import { Head } from "@/module/common/component/Head";
import { LinkButton } from "@/module/common/component/LinkButton";
import { useProductMetadata } from "@/module/product/hook/useProductMetadata";

export function ProductHead({ productId }: { productId: Hex }) {
    const { data: product } = useProductMetadata({ productId });

    return (
        <Head
            title={{ content: product?.name ?? "", size: "small" }}
            rightSection={
                <LinkButton
                    to="/dashboard"
                    variant="outline"
                    leftIcon={<X size={20} />}
                >
                    Cancel
                </LinkButton>
            }
        />
    );
}
