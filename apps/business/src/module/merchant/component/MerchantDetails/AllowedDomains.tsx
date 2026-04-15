import { Button } from "@frak-labs/ui/component/Button";
import { Column, Columns } from "@frak-labs/ui/component/Columns";
import { Input } from "@frak-labs/ui/component/forms/Input";
import { useMemo, useState } from "react";
import { Panel } from "@/module/common/component/Panel";
import {
    useAddAllowedDomain,
    useRemoveAllowedDomain,
} from "@/module/merchant/hook/useAllowedDomains";
import styles from "./AllowedDomains.module.css";

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
                                variant={"danger"}
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

            <Columns>
                <Column>
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
                <Column>
                    <Button
                        variant={"submit"}
                        size={"small"}
                        onClick={handleAdd}
                        disabled={!isValid || isAdding}
                        isLoading={isAdding}
                    >
                        Add Domain
                    </Button>
                </Column>
            </Columns>
        </Panel>
    );
}
