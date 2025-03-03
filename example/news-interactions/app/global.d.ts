declare module "react" {
    namespace JSX {
        interface IntrinsicElements {
            "frak-button-share": React.DetailedHTMLProps<
                React.HTMLAttributes<HTMLElement>,
                HTMLElement
            >;
            "frak-button-wallet": React.DetailedHTMLProps<
                React.HTMLAttributes<HTMLElement>,
                HTMLElement
            >;
        }
    }
}

export {};
