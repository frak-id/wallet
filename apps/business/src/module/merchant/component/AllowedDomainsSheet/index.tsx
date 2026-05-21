import {
    Sheet,
    SheetClose,
    SheetContent,
    SheetDescription,
    SheetFooter,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@frak-labs/design-system/components/Sheet";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { useMemo, useState } from "react";
import { Button } from "@/module/common/component/Button";
import { Input } from "@/module/forms/Input";
import {
    useAddAllowedDomain,
    useRemoveAllowedDomain,
} from "@/module/merchant/hook/useAllowedDomains";
import * as styles from "./allowed-domains-sheet.css";

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

export function AllowedDomainsSheet({
    merchantId,
    allowedDomains,
}: {
    merchantId: string;
    allowedDomains: string[];
}) {
    const [open, setOpen] = useState(false);
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
        <Sheet
            open={open}
            onOpenChange={(next) => {
                setOpen(next);
                if (!next) setRawInput("");
            }}
        >
            <SheetTrigger asChild>
                <Button variant="secondary">Manage domains</Button>
            </SheetTrigger>
            <SheetContent side="right">
                <SheetHeader>
                    <SheetTitle>Allowed domains</SheetTitle>
                    <SheetDescription>
                        Additional domains authorized to access this merchant
                        (e.g. Shopify myshopify.com domains).
                    </SheetDescription>
                </SheetHeader>

                <Stack space="m">
                    {allowedDomains.length > 0 ? (
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
                    ) : (
                        <span className={styles.emptyState}>
                            No additional domains yet.
                        </span>
                    )}

                    <div>
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
                            <p className={styles.error}>
                                Invalid domain format
                            </p>
                        )}
                    </div>
                </Stack>

                <SheetFooter>
                    <SheetClose asChild>
                        <Button variant="ghost">Close</Button>
                    </SheetClose>
                    <Button
                        variant={"primary"}
                        onClick={handleAdd}
                        disabled={!isValid || isAdding}
                        loading={isAdding}
                    >
                        Add domain
                    </Button>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    );
}
