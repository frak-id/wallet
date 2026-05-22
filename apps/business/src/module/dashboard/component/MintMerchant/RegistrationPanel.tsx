import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { ButtonAuth } from "@/module/common/component/ButtonAuth";
import { CardAccordion } from "@/module/common/component/CardAccordion";
import * as styles from "./mint-merchant.css";

interface RegistrationPanelProps {
    step: number;
    isPending: boolean;
    error?: Error | null;
    infoTxt?: string;
    merchantId?: string;
    onSubmit: () => void;
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
}

export function RegistrationPanel({
    step,
    isPending,
    error,
    infoTxt,
    merchantId,
    onSubmit,
    isOpen,
    onOpenChange,
}: RegistrationPanelProps) {
    return (
        <CardAccordion
            title="Product Registration"
            className={styles.panel}
            value={isOpen ? "item-1" : ""}
            onValueChange={(value) => onOpenChange(value === "item-1")}
        >
            {step < 3 ? (
                <div className={styles.disabledContent}>
                    <p>Complete validation in the previous step to continue</p>
                </div>
            ) : step === 3 ? (
                <Stack space="m" align="left">
                    <Text
                        as="h3"
                        variant="bodySmall"
                        weight="semiBold"
                        color="primary"
                    >
                        Launch Your Product
                    </Text>
                    <Text variant="bodySmall" color="secondary">
                        Click below to register your product on the blockchain.
                        This requires authentication with your wallet and will
                        create your product permanently on-chain.
                    </Text>
                    <ButtonAuth onClick={onSubmit} disabled={isPending}>
                        Launch Product
                    </ButtonAuth>

                    {error && <p className="error">{error.message}</p>}

                    {infoTxt && (
                        <p>
                            {infoTxt}
                            <span className="dotsLoading">...</span>
                        </p>
                    )}
                </Stack>
            ) : (
                <div className={styles.successSection}>
                    <p className="success">
                        Your product has been successfully registered!
                    </p>
                    {merchantId && <p>Merchant ID: {merchantId}</p>}
                </div>
            )}
        </CardAccordion>
    );
}
