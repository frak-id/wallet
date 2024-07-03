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
import {
    wcDisplayedRequestAtom,
    wcRequestsAtom,
} from "@/module/wallet-connect/atoms/events";
import styles from "@/module/wallet-connect/component/PendingRequests/index.module.css";
import type { WalletConnectRequestArgs } from "@/module/wallet-connect/types/event";
import { Button } from "@module/component/Button";
import { useSetAtom } from "jotai";
import { useAtomValue } from "jotai/index";
import { ChevronRight, Clock } from "lucide-react";
import { first } from "radash";
import { useMemo } from "react";

/**
 * Display a component with all the pending wallet connect requests
 * @constructor
 */
export function PendingWalletConnectRequests() {
    // Check if it's enable or not, and if we have pending requests
    const isEnable = useAtomValue(isWalletConnectEnableAtom);
    const pendingRequests = useAtomValue(wcRequestsAtom);
    if (!isEnable || pendingRequests.length === 0) {
        return null;
    }

    return (
        <Panel withShadow={false} size={"small"}>
            <Accordion
                type={"single"}
                collapsible
                className={styles.accordionPendingRequests}
            >
                <AccordionItem value={"item-1"}>
                    <AccordionTrigger
                        className={styles.accordionPendingRequests__trigger}
                    >
                        <Title icon={<Clock size={32} />}>
                            Pending transactions
                        </Title>
                    </AccordionTrigger>
                    <AccordionContent>
                        <ul>
                            {pendingRequests.map((request) => (
                                <PendingRequestItem
                                    key={request.id}
                                    request={request}
                                />
                            ))}
                        </ul>
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
        </Panel>
    );
}

/**
 * Component with a pending request item
 * @constructor
 */
function PendingRequestItem({
    request,
}: { request: WalletConnectRequestArgs }) {
    const setDisplayedRequest = useSetAtom(wcDisplayedRequestAtom);

    const proposerMetadata = useMemo(() => {
        if (request.type === "pairing") {
            return request.params.proposer.metadata;
        }
        if (request.type === "auth") {
            return request.params.requester.metadata;
        }
        return request.session.peer.metadata;
    }, [request]);

    /**
     * Extract info about the request
     */
    const { icon, name } = useMemo(() => {
        return {
            icon: first(proposerMetadata.icons) ?? undefined,
            name: proposerMetadata.name,
        };
    }, [proposerMetadata.icons, proposerMetadata.name]);

    /**
     * The explanation of the request
     */
    const formattedMsg = useMemo(() => {
        if (request.type === "pairing") {
            return "Pairing";
        }

        if (request.type === "auth") {
            return "Authenticate";
        }

        const method = request.params.request.method;

        if (method === "eth_sendTransaction") {
            return "Send transaction";
        }

        if (method === "eth_sign" || method === "personal_sign") {
            return "Sign message";
        }

        if (
            method === "eth_signTypedData" ||
            method === "eth_signTypedData_v3" ||
            method === "eth_signTypedData_v4"
        ) {
            return "Sign typed data";
        }

        return "Unknown request";
    }, [request]);

    return (
        <li key={request.id}>
            <Button
                onClick={() => setDisplayedRequest(request)}
                variant={"ghost"}
                className={styles.pendingRequest__container}
            >
                <Row withIcon={true}>
                    {icon && (
                        <img src={icon} alt={name} width={32} height={32} />
                    )}
                    <div className={styles.pendingRequest__info}>
                        <span>From: {name}</span>
                        <span>{formattedMsg}</span>
                    </div>
                    <ChevronRight />
                </Row>
            </Button>
        </li>
    );
}
