"use client";

import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/module/common/component/Accordion";
import { Panel } from "@/module/common/component/Panel";
import Row from "@/module/common/component/Row";
import { Title } from "@/module/common/component/Title";
import { useBetaOptions } from "@/module/common/hook/useBetaOptions";
import { Button } from "@frak-labs/nexus-example/src/module/common/component/Button";
import { FlaskConical, Square, SquareCheck } from "lucide-react";
import styles from "./index.module.css";

export function BetaOptions() {
    const { options, toggleWalletConnect } = useBetaOptions();

    return (
        <>
            <Panel size={"small"}>
                <Accordion
                    type={"single"}
                    collapsible
                    className={styles.accordionBetaFeature}
                >
                    <AccordionItem value={"item-1"}>
                        <AccordionTrigger
                            className={styles.accordionBetaFeature__trigger}
                        >
                            <Title icon={<FlaskConical size={32} />}>
                                Beta features
                            </Title>
                        </AccordionTrigger>
                        <AccordionContent>
                            <WalletConnectToggle
                                isEnable={options.walletConnect}
                                toggleWalletConnect={toggleWalletConnect}
                            />
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>
            </Panel>
        </>
    );
}

function WalletConnectToggle({
    isEnable,
    toggleWalletConnect,
}: { isEnable: boolean; toggleWalletConnect: () => void }) {
    return (
        <Button onClick={toggleWalletConnect} variant={"outlined"}>
            <Row>
                {isEnable ? <SquareCheck /> : <Square />}
                Wallet Connect
            </Row>
        </Button>
    );
}
