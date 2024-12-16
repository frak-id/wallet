export function Analytics({ websiteId }: { websiteId: string }) {
    return (
        <script
            defer
            src="https://umami.frak.id/script.js"
            data-website-id={websiteId}
        />
    );
}
