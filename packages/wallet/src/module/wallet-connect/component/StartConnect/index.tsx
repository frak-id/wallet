import { Panel } from "@/module/common/component/Panel";
import { Title } from "@/module/common/component/Title";
import { ConnectionWithUri } from "@/module/wallet-connect/component/ConnectionWithUri";
import { QrReader } from "@/module/wallet-connect/component/QrReader";
import { Plug } from "lucide-react";
import {Accordion, AccordionContent, AccordionItem, AccordionTrigger} from "@/module/common/component/Accordion";
import styles from "./index.module.css";

export function CreateWalletConnectConnection() {
    return (
        <Panel withShadow={false} size={"small"}>
            <Accordion type={"single"} collapsible className={styles.accordionConnect}>
                <AccordionItem value={"item-1"}>
                    <AccordionTrigger className={styles.accordionConnect__trigger}>
                        <Title icon={<Plug size={32} />}>Wallet Connect</Title>
                    </AccordionTrigger>
                    <AccordionContent>
                        <QrReader />
                        <ConnectionWithUri />
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
        </Panel>
    );
}
