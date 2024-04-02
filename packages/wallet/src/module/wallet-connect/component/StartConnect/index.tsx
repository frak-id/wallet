import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/module/common/component/Accordion";
import { Panel } from "@/module/common/component/Panel";
import { Title } from "@/module/common/component/Title";
import { ConnectWithQrCode } from "@/module/wallet-connect/component/StartConnect/ConnectWithQrCode";
import { ConnectionWithUri } from "@/module/wallet-connect/component/StartConnect/ConnectWithUri";
import { Plug } from "lucide-react";
import styles from "./index.module.css";

export function CreateWalletConnectConnection() {
    return (
        <Panel withShadow={false} size={"small"}>
            <Accordion
                type={"single"}
                collapsible
                className={styles.accordionConnect}
            >
                <AccordionItem value={"item-1"}>
                    <AccordionTrigger
                        className={styles.accordionConnect__trigger}
                    >
                        <Title icon={<Plug size={32} />}>Wallet Connect</Title>
                    </AccordionTrigger>
                    <AccordionContent>
                        <ConnectWithQrCode />
                        <ConnectionWithUri />
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
        </Panel>
    );
}
