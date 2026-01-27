import { Spinner } from "@frak-labs/ui/component/Spinner";
import { useEffect } from "react";
import { useFormContext } from "react-hook-form";
import { Badge } from "@/module/common/component/Badge";
import { Panel } from "@/module/common/component/Panel";
import {
    FormControl,
    FormField,
    FormItem,
    FormMessage,
} from "@/module/forms/Form";
import { useGetMerchantBank } from "@/module/product/hook/useGetMerchantBank";
import type { Campaign } from "@/types/Campaign";

export function FormBank() {
    const { watch, setValue, control } = useFormContext<Campaign>();
    const merchantId = watch("merchantId");

    const { data, isLoading } = useGetMerchantBank({
        merchantId: merchantId || "",
    });

    const bankAddress = data?.bankAddress ?? null;
    const isDisabled = isLoading || !bankAddress;

    useEffect(() => {
        if (!bankAddress) return;
        setValue("bank", bankAddress);
    }, [bankAddress, setValue]);

    return (
        <Panel title="Funding bank" aria-disabled={isDisabled}>
            <FormField
                control={control}
                name="bank"
                rules={{ required: "A deployed bank is required" }}
                render={({ field }) => (
                    <FormItem>
                        <FormControl>
                            {isLoading ? (
                                <Spinner />
                            ) : bankAddress ? (
                                <div
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "8px",
                                    }}
                                >
                                    <input
                                        type="hidden"
                                        name={field.name}
                                        value={field.value}
                                    />
                                    <Badge variant="success">
                                        Bank deployed
                                    </Badge>
                                    <span
                                        style={{
                                            fontSize: "0.875rem",
                                            color: "var(--color-text-secondary)",
                                            fontFamily: "monospace",
                                        }}
                                    >
                                        {bankAddress.slice(0, 6)}...
                                        {bankAddress.slice(-4)}
                                    </span>
                                </div>
                            ) : (
                                <p>
                                    No bank deployed for this merchant. Please
                                    set up a bank in the Funding page first.
                                </p>
                            )}
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />
        </Panel>
    );
}
