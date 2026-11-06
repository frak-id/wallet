import { Box } from "@frak-labs/design-system/components/Box";
import { trackEvent } from "@frak-labs/wallet-shared";
import {
    type RampInstantEvents,
    RampInstantEventTypes,
    RampInstantSDK,
} from "@ramp-network/ramp-instant-sdk";
import { useCallback, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { formatUnits, type Hex } from "viem";
import { useConnection } from "wagmi";
import { SheetScreen } from "@/module/common/component/SheetScreen";
import { getAmountBucket } from "@/module/monerium/utils/amountBucket";
import { useCspBlocked } from "@/module/ramp/hooks/useCspBlocked";
import { useRampSendCrypto } from "@/module/ramp/hooks/useRampSendCrypto";
import {
    rampFlowStore,
    selectTxHash,
    selectUsdcAmount,
} from "@/module/ramp/store/rampFlowStore";
import {
    RAMP_OFFRAMP_ASSET,
    RAMP_WIDGET_URL,
    rampHostApiKey,
} from "@/module/ramp/utils/rampConfig";
import * as styles from "./index.css";

const HOST_LOGO_URL = `${process.env.FRAK_WALLET_URL}/icon-192.png`;

const onFrameBlocked = () =>
    trackEvent("ramp_blocked_by_csp", { directive: "frame-src" });

/** Step 3: Ramp's widget, embedded; the wallet sends the USDC when the widget asks. */
export function RampWidgetScreen({ onClose }: { onClose: () => void }) {
    const { t } = useTranslation();
    const { address } = useConnection();
    const usdcAmount = rampFlowStore(selectUsdcAmount);
    const txHash = rampFlowStore(selectTxHash);
    const containerRef = useRef<HTMLDivElement>(null);
    const blocked = useCspBlocked("frame-src", "ramp", onFrameBlocked);

    const onSent = useCallback(
        (hash: Hex) => rampFlowStore.getState().setTxHash(hash),
        []
    );
    const sendCrypto = useRampSendCrypto(onSent);

    // The SDK keeps the callbacks it was given at mount; refs keep them current.
    const sendRef = useRef(sendCrypto);
    const closeRef = useRef(onClose);
    useEffect(() => {
        sendRef.current = sendCrypto;
        closeRef.current = onClose;
    }, [sendCrypto, onClose]);

    const finish = useCallback(() => {
        if (rampFlowStore.getState().txHash) {
            rampFlowStore.getState().goTo("success");
        } else {
            closeRef.current();
        }
    }, []);

    useEffect(() => {
        const containerNode = containerRef.current;
        if (!containerNode || !address || !rampHostApiKey) return;
        if (usdcAmount === null) return;

        // `close()` on unmount emits WIDGET_CLOSE too: only user closes should end the flow.
        let mounted = true;
        const sdk = new RampInstantSDK({
            hostApiKey: rampHostApiKey,
            url: RAMP_WIDGET_URL,
            hostAppName: "Frak Wallet",
            hostLogoUrl: HOST_LOGO_URL,
            userAddress: address,
            swapAsset: RAMP_OFFRAMP_ASSET,
            offrampAsset: RAMP_OFFRAMP_ASSET,
            swapAmount: usdcAmount.toString(),
            defaultFlow: "OFFRAMP",
            enabledFlows: ["OFFRAMP"],
            useSendCryptoCallback: true,
            hideExitButton: true,
            variant: "embedded-mobile",
            containerNode,
        });
        sdk.onSendCrypto((assetInfo, amount, to) =>
            sendRef.current(assetInfo, amount, to)
        );
        sdk.on<RampInstantEvents>("*", (event) => {
            if (!mounted) return;
            if (event.type === RampInstantEventTypes.OFFRAMP_SALE_CREATED) {
                const { sale } = event.payload;
                rampFlowStore.getState().setSale({
                    id: sale.id,
                    fiatAmount: sale.fiat.amount,
                    fiatCurrency: sale.fiat.currencySymbol,
                });
                trackEvent("ramp_sale_created", {
                    fiat_currency: sale.fiat.currencySymbol,
                    amount_bucket: getAmountBucket(
                        formatUnits(
                            BigInt(sale.crypto.amount),
                            sale.crypto.assetInfo.decimals
                        )
                    ),
                });
            }
            if (event.type === RampInstantEventTypes.WIDGET_CLOSE) finish();
        });
        sdk.show();

        return () => {
            mounted = false;
            sdk.close();
        };
    }, [address, usdcAmount, finish]);

    return (
        <SheetScreen
            onClose={finish}
            errorMessage={blocked ? t("ramp.flow.updateRequired") : undefined}
            ctaLabel={txHash ? t("ramp.flow.widget.done") : undefined}
            ctaOnClick={txHash ? finish : undefined}
        >
            <Box
                ref={containerRef}
                className={styles.widgetContainer}
                display={blocked ? "none" : "block"}
            />
        </SheetScreen>
    );
}
