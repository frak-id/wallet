import { Badge } from "@frak-labs/design-system/components/Badge";

export function TransactionError({ message }: { message: string }) {
    return <Badge variant="error">{message}</Badge>;
}
