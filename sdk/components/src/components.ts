import(
    // @ts-expect-error: Loader from the CDN
    `https://cdn.jsdelivr.net/npm/@frak-labs/components@latest/cdn/loader.js?v=${process.env.BUILD_TIMESTAMP}`
);
