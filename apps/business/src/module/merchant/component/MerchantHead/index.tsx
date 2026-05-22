import { X } from "lucide-react";
import { Head } from "@/module/common/component/Head";
import { LinkButton } from "@/module/common/component/LinkButton";
import { useActiveMerchantId } from "@/module/common/hook/useActiveMerchantId";
import { useMerchant } from "@/module/merchant/hook/useMerchant";

export function MerchantHead() {
    const merchantId = useActiveMerchantId();
    const { data: merchant } = useMerchant({ merchantId });

    return (
        <Head
            title={{ content: merchant?.name ?? "", size: "small" }}
            rightSection={
                <LinkButton
                    to="/m/$merchantId/dashboard"
                    params={{ merchantId }}
                    variant="secondary"
                    icon={<X size={20} />}
                >
                    Cancel
                </LinkButton>
            }
        />
    );
}
