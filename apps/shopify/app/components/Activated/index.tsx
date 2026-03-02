export function Activated({ text }: { text: string }) {
    return (
        <s-text>
            <s-badge tone="success" icon="check">
                {text}
            </s-badge>
        </s-text>
    );
}
