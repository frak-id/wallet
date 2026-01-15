import { X } from "lucide-react";
import { Head } from "@/module/common/component/Head";
import { LinkButton } from "@/module/common/component/LinkButton";
import { useMerchant } from "@/module/merchant/hook/useMerchant";

export function MerchantHead({ merchantId }: { merchantId: string }) {
    const { data: merchant } = useMerchant({ merchantId });

    return (
        <Head
            title={{ content: merchant?.name ?? "", size: "small" }}
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
