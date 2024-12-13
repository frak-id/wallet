/**
 * @param {import('typedoc-plugin-markdown').MarkdownApplication} app
 */
export function load(app) {
    /**
     * The external symbol map we want to replace
     */
    const symbolMap = {
        viem: {
            home: "https://viem.sh/docs/getting-started.html",
            Address: "https://viem.sh/docs/glossary/types#address",
            Hex: "https://viem.sh/docs/glossary/types#hex",
            SiweMessage: "https://eips.ethereum.org/EIPS/eip-4361",
        },
        "@tanstack/react-query": {
            home: "https://tanstack.com/query/latest",
            useQuery:
                "https://tanstack.com/query/v4/docs/framework/react/reference/useQuery",
            UseQueryResult:
                "https://tanstack.com/query/v4/docs/framework/react/reference/useQuery",
            QueryClientProvider:
                "https://tanstack.com/query/v4/docs/framework/react/reference/QueryClientProvider",
            useMutation:
                "https://tanstack.com/query/v4/docs/framework/react/reference/useMutation",
            UseMutationResult:
                "https://tanstack.com/query/v4/docs/framework/react/reference/useMutation",
        },
    };

    /**
     * Add some symbol converter (for viem / tanstack specially)
     */
    app.converter.addUnknownSymbolResolver((ref) => {
        if (
            ref.moduleSource !== "viem" &&
            ref.moduleSource !== "@tanstack/react-query"
        ) {
            return;
        }
        const knownSymbols = symbolMap[ref.moduleSource];

        // If someone did {@link viem!} or {@link @tanstack/react-query!}, link them directly to the home page.
        if (!ref.symbolReference) {
            console.log("Returning home", ref);
            return knownSymbols.home;
        }

        // Otherwise, we need to navigate through the symbol reference to
        // determine where they meant to link to. Since the symbols we know
        // about are all a single "level" deep, this is pretty simple.
        if (!ref.symbolReference.path) {
            console.log("No path", ref);
            // Someone included a meaning, but not a path.
            // https://typedoc.org/guides/declaration-references/#meaning
            return;
        }

        if (ref.symbolReference.path.length === 1) {
            const name = ref.symbolReference.path[0].path;
            const output = knownSymbols[name];
            if (!output) {
                console.log("No output", ref, name, knownSymbols[name]);
            }
            return output;
        }
    });
}
