export function TransactionError({ message }: { message: string }) {
    return <span className={"error"}>{message}</span>;
}
