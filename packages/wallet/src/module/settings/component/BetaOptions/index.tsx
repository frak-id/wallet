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
import { isWalletConnectEnableAtom } from "@/module/settings/atoms/betaOptions";
import { Button } from "@frak-labs/nexus-example/src/module/common/component/Button";
import { useAtom } from "jotai";
import { FlaskConical, Square, SquareCheck } from "lucide-react";
import styles from "./index.module.css";

export function BetaOptions() {
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
                            <WalletConnectToggle />
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>
            </Panel>
        </>
    );
}

function WalletConnectToggle() {
    const [isEnable, toggle] = useAtom(isWalletConnectEnableAtom);
    return (
        <Button onClick={toggle} variant={"outlined"}>
            <Row>
                {isEnable ? <SquareCheck /> : <Square />}
                Wallet Connect
            </Row>
        </Button>
    );
}
