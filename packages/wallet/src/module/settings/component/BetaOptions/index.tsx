"use client";

import { isRunningInProd } from "@/context/common/env";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/module/common/component/Accordion";
import { Button } from "@/module/common/component/Button";
import { Panel } from "@/module/common/component/Panel";
import Row from "@/module/common/component/Row";
import { Title } from "@/module/common/component/Title";
import {
    isConvertToEuroEnableAtom,
    isWalletConnectEnableAtom,
} from "@/module/settings/atoms/betaOptions";
import { useAtom } from "jotai";
import { FlaskConical, Square, SquareCheck } from "lucide-react";
import styles from "./index.module.css";

export function BetaOptions() {
    // If on prod, we can't enable beta features
    if (isRunningInProd) {
        return null;
    }

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
                            <BetaOptionsList />
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>
            </Panel>
        </>
    );
}

function BetaOptionsList() {
    return (
        <ul>
            <li>
                <WalletConnectToggle />
                <ConvertToEuroToggle />
            </li>
        </ul>
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

function ConvertToEuroToggle() {
    const [isEnable, toggle] = useAtom(isConvertToEuroEnableAtom);
    return (
        <Button onClick={toggle} variant={"outlined"}>
            <Row>
                {isEnable ? <SquareCheck /> : <Square />}
                Convert to Euro
            </Row>
        </Button>
    );
}
