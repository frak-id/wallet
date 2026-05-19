import { Column } from "@frak-labs/design-system/components/Column";
import { Columns } from "@frak-labs/design-system/components/Columns";
import { useMemo, useState } from "react";
import { Button } from "@/module/common/component/Button";
import { Panel } from "@/module/common/component/Panel";
import { Input } from "@/module/forms/Input";
import {
    useAddAllowedDomain,
    useRemoveAllowedDomain,
} from "@/module/merchant/hook/useAllowedDomains";
import * as styles from "./allowed-domains.css";

const domainRegex =
    /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;

function normalizeDomain(raw: string): string {
    return raw
        .toLowerCase()
        .trim()
        .replace(/^https?:\/\//, "")
        .replace(/:\d+$/, "")
        .replace(/\/$/, "")
        .replace(/^www\./, "");
}

export function AllowedDomains({
    merchantId,
    allowedDomains,
}: {
    merchantId: string;
    allowedDomains: string[];
}) {
    const [rawInput, setRawInput] = useState("");
    const { mutate: addDomain, isPending: isAdding } = useAddAllowedDomain({
        merchantId,
    });
    const { mutate: removeDomain, isPending: isRemoving } =
        useRemoveAllowedDomain({ merchantId });

    const normalized = useMemo(() => normalizeDomain(rawInput), [rawInput]);
    const isValid = normalized.length > 0 && domainRegex.test(normalized);

    function handleAdd() {
        if (!isValid) return;
        addDomain(normalized, {
            onSuccess: () => setRawInput(""),
        });
    }

    return (
        <Panel title="Allowed Domains">
            <p className={styles.description}>
                Additional domains authorized to access this merchant (e.g.
                Shopify myshopify.com domains).
            </p>

            {allowedDomains.length > 0 && (
                <ul className={styles.domainList}>
                    {allowedDomains.map((domain) => (
                        <li key={domain} className={styles.domainItem}>
                            <span>{domain}</span>
                            <Button
                                variant={"destructive"}
                                size={"small"}
                                onClick={() => removeDomain(domain)}
                                disabled={isRemoving}
                            >
                                Remove
                            </Button>
                        </li>
                    ))}
                </ul>
            )}

            <Columns space="xs" alignY="center">
                <Column width="1/2">
                    <Input
                        length={"medium"}
                        value={rawInput}
                        onChange={(e) => setRawInput(e.target.value)}
                        placeholder="e.g. mystore.myshopify.com"
                        onKeyDown={(e) => {
                            if (e.key === "Enter") handleAdd();
                        }}
                    />
                    {rawInput.trim() && !isValid && (
                        <p className={styles.error}>Invalid domain format</p>
                    )}
                </Column>
                <Column width="1/2">
                    <Button
                        variant={"primary"}
                        size={"small"}
                        onClick={handleAdd}
                        disabled={!isValid || isAdding}
                        loading={isAdding}
                    >
                        Add Domain
                    </Button>
                </Column>
            </Columns>
        </Panel>
    );
}
