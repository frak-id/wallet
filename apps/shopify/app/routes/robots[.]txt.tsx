/**
 * Block all crawlers — this is an embedded Shopify admin app and must never be
 * indexed. Also silences the recurring `No route matches URL "/robots.txt"`
 * error that bots trigger against the bare domain.
 */
export function loader() {
    return new Response("User-agent: *\nDisallow: /\n", {
        headers: {
            "Content-Type": "text/plain",
            "Cache-Control": "public, max-age=86400",
        },
    });
}
