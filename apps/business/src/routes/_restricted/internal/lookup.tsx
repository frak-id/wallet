import { createFileRoute } from "@tanstack/react-router";
import { IdentityLookup } from "@/module/internal/component/IdentityLookup";

type LookupSearch = { q?: string };

export const Route = createFileRoute("/_restricted/internal/lookup")({
    validateSearch: (search: Record<string, unknown>): LookupSearch => ({
        q: typeof search.q === "string" && search.q ? search.q : undefined,
    }),
    component: LookupTab,
});

function LookupTab() {
    const { q } = Route.useSearch();
    const navigate = Route.useNavigate();
    return (
        <IdentityLookup
            key={q ?? ""}
            query={q ?? ""}
            onSearch={(query) =>
                navigate({ search: { q: query || undefined } })
            }
        />
    );
}
