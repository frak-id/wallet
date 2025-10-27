import { useGetUserBalance } from "@frak-labs/wallet-shared";
import { useTranslation } from "react-i18next";
import { Title } from "@/module/common/component/Title";
import styles from "./index.module.css";

export function Balance() {
    const { t } = useTranslation();
    const { userBalance } = useGetUserBalance();

    return (
        <div className={styles.balance}>
            <Title size={"big"} align={"center"}>
                {t("common.balance")}
            </Title>
            <p className={styles.balance__amount}>
                {userBalance?.total?.eurAmount?.toFixed(2) ?? 0}€
            </p>
        </div>
    );
}
