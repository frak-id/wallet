import {
    currentStablecoins,
    getTokenAddressForStablecoin,
    type Stablecoin,
} from "@frak-labs/app-essentials";
import { CheckCircle2, Star } from "lucide-react";
import { useEffect } from "react";
import { useFormContext } from "react-hook-form";
import type { Address } from "viem";
import { formatUnits } from "viem";
import { Badge } from "@/module/common/component/Badge";
import { Panel } from "@/module/common/component/Panel";
import { useTokenMetadata } from "@/module/common/hook/useTokenMetadata";
import { currencyOptions } from "@/module/common/utils/currencyOptions";
import {
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormMessage,
} from "@/module/forms/Form";
import { useGetMerchantBank } from "@/module/merchant/hook/useGetMerchantBank";
import { useMerchant } from "@/module/merchant/hook/useMerchant";
import type { CampaignDraft } from "@/stores/campaignStore";
import styles from "./FormRewardToken.module.css";

const tokenDisplayNames: Record<Stablecoin, string> = {
    eure: "Euro (Monerium)",
    gbpe: "GBP (Monerium)",
    usde: "USD (Monerium)",
    usdc: "USD Coin (Circle)",
};

function detectStablecoinFromAddress(address: Address): Stablecoin | undefined {
    for (const [key, value] of Object.entries(currentStablecoins)) {
        if (value.toLowerCase() === address.toLowerCase()) {
            return key as Stablecoin;
        }
    }
    return undefined;
}

export function FormRewardToken() {
    const { control, watch, setValue, getValues } =
        useFormContext<CampaignDraft>();
    const merchantId = watch("merchantId");

    const { data: merchantData } = useMerchant({ merchantId });
    const { data: bankData } = useGetMerchantBank({ merchantId });

    const merchantDefaultToken = merchantData?.defaultRewardToken ?? null;
    const merchantDefaultStablecoin = merchantDefaultToken
        ? detectStablecoinFromAddress(merchantDefaultToken)
        : undefined;

    useEffect(() => {
        if (!merchantDefaultToken) return;
        const currentValue = getValues("rewardToken");
        if (currentValue) return;
        setValue("rewardToken", merchantDefaultToken);
    }, [merchantDefaultToken, getValues, setValue]);

    const availableCurrencies = currencyOptions.flatMap((group) =>
        group.options.map((option) => ({
            ...option,
            group: group.group,
        }))
    );

    function getTokenData(stablecoin: Stablecoin) {
        if (!bankData?.tokens) return null;
        const tokenAddress = currentStablecoins[stablecoin];
        return (
            bankData.tokens.find(
                (t) => t.address.toLowerCase() === tokenAddress.toLowerCase()
            ) ?? null
        );
    }

    return (
        <Panel title="Reward currency">
            <FormDescription>
                Select the token used to distribute rewards for this campaign.
                The balance shown is available in your campaign bank.
            </FormDescription>
            <FormField
                control={control}
                name="rewardToken"
                rules={{ required: "Select a reward currency" }}
                render={({ field }) => {
                    const selectedStablecoin = field.value
                        ? detectStablecoinFromAddress(field.value)
                        : undefined;

                    return (
                        <FormItem>
                            <FormControl>
                                <div className={styles.tokenGrid}>
                                    {availableCurrencies.map((currency) => {
                                        const stablecoin =
                                            currency.value as Stablecoin;
                                        const isSelected =
                                            stablecoin === selectedStablecoin;
                                        const isDefault =
                                            stablecoin ===
                                            merchantDefaultStablecoin;
                                        const tokenData =
                                            getTokenData(stablecoin);
                                        const isRecommended =
                                            currency.group === "Monerium";

                                        return (
                                            <button
                                                key={currency.value}
                                                type="button"
                                                onClick={() => {
                                                    const address =
                                                        getTokenAddressForStablecoin(
                                                            stablecoin
                                                        );
                                                    field.onChange(address);
                                                }}
                                                className={`${styles.tokenCard} ${isSelected ? styles.tokenCardSelected : ""}`}
                                            >
                                                {isSelected && (
                                                    <div
                                                        className={
                                                            styles.selectedIndicator
                                                        }
                                                    >
                                                        <CheckCircle2
                                                            size={20}
                                                            strokeWidth={2.5}
                                                        />
                                                    </div>
                                                )}
                                                <div
                                                    className={
                                                        styles.tokenCardHeader
                                                    }
                                                >
                                                    <span
                                                        className={
                                                            styles.tokenName
                                                        }
                                                    >
                                                        {
                                                            tokenDisplayNames[
                                                                stablecoin
                                                            ]
                                                        }
                                                    </span>
                                                    <div
                                                        className={
                                                            styles.tokenBadges
                                                        }
                                                    >
                                                        {isDefault && (
                                                            <Badge
                                                                size="small"
                                                                variant="success"
                                                            >
                                                                Default
                                                            </Badge>
                                                        )}
                                                        <Badge
                                                            size="small"
                                                            variant="information"
                                                        >
                                                            {currency.group}
                                                        </Badge>
                                                        {isRecommended &&
                                                            !isDefault && (
                                                                <div
                                                                    className={
                                                                        styles.recommendedBadge
                                                                    }
                                                                    title="Recommended"
                                                                >
                                                                    <Star
                                                                        size={
                                                                            16
                                                                        }
                                                                        fill="currentColor"
                                                                        strokeWidth={
                                                                            0
                                                                        }
                                                                    />
                                                                </div>
                                                            )}
                                                    </div>
                                                </div>
                                                {tokenData && (
                                                    <TokenBalanceDisplay
                                                        balance={
                                                            tokenData.balance
                                                        }
                                                        tokenAddress={
                                                            tokenData.address
                                                        }
                                                    />
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    );
                }}
            />
        </Panel>
    );
}

function TokenBalanceDisplay({
    balance,
    tokenAddress,
}: {
    balance: bigint;
    tokenAddress: Address;
}) {
    const { data: tokenMeta } = useTokenMetadata(tokenAddress);
    if (!tokenMeta) return null;

    const formatted = Number(
        formatUnits(balance, tokenMeta.decimals)
    ).toLocaleString();

    return (
        <div className={styles.tokenBalance}>
            Available: <strong>{formatted}</strong>
        </div>
    );
}
