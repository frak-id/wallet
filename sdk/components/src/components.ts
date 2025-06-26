import(
    /* webpackChunkName: "frak-core-sdk" */
    `https://cdn.jsdelivr.net/npm/@frak-labs/core-sdk@latest/cdn/bundle.js?v=${process.env.BUILD_TIMESTAMP}`
);
import(
    /* webpackChunkName: "frak-components-loader" */
    // @ts-ignore: Loader from the CDN
    `https://cdn.jsdelivr.net/npm/@frak-labs/components@latest/cdn/loader.js?v=${process.env.BUILD_TIMESTAMP}`
);
