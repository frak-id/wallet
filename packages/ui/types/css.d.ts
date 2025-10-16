declare module "*.module.css" {
    const classes: { readonly [key: string]: string };
    export default classes;
}

declare module "*?url" {
    const url: string;
    export default url;
}
