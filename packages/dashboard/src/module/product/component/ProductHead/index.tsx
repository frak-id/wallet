import { Head } from "@/module/common/component/Head";
import { useProductMetadata } from "@/module/product/hook/useProductMetadata";
import { Button } from "@module/component/Button";
import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import type { Hex } from "viem";

export function ProductHead({ productId }: { productId: Hex }) {
    const router = useRouter();
    const { data: product } = useProductMetadata({ productId });

    return (
        <Head
            title={{ content: product?.name ?? "", size: "small" }}
            rightSection={
                <Button
                    variant={"outline"}
                    leftIcon={<X size={20} />}
                    onClick={() => router.push("/dashboard")}
                >
                    Cancel
                </Button>
            }
        />
    );
}
