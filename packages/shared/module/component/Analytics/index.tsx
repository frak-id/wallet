export function Analytics({ websiteId }: { websiteId: string }) {
    return (
        <script
            defer
            src="https://cloud.umami.is/script.js"
            data-website-id={websiteId}
        />
    );
}
