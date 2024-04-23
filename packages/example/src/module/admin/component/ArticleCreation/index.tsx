"use client";

import { createArticle } from "@/context/article/action/create";
import { isRunningLocally } from "@/context/common/env";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";

const providers = ["le-monde", "wired", "l-equipe"] as const;

// Component used to create new article
export function ArticleCreation() {
    const [providerIndex, setProviderIndex] = useState<number>(0);
    const [provider, setProvider] = useState<"le-monde" | "wired" | "l-equipe">(
        providers[providerIndex]
    );
    const [id, setId] = useState<number>(0);

    const {
        mutate: create,
        isPending: isLoading,
        error,
    } = useMutation({
        mutationKey: ["createArticle", id, provider],
        mutationFn: async () => {
            await createArticle({
                id,
                provider,
                origin: window.location.origin,
                isLocal: isRunningLocally,
            });
            setId(0);
        },
    });

    return (
        <div>
            <h3>Le Monde Ids</h3>
            <p>
                Id 1: Le Cambodge
                <br />
                Id 2: Les NFT pompidou
                <br />
                Id 3: Une tech qui revolutionne la finance
            </p>

            <br />

            <h3>Wired Ids</h3>
            <p>
                Id 1: Apple kill password
                <br />
                Id 2: Google kill password
                <br />
                Id 3: Become more anonymous online
            </p>

            <br />

            <h3>L'équipe Ids</h3>
            <p>
                Id 1: Ces petites choses invisibles qui font de Rudy Gobert une
                superstar de la défense en NBA
            </p>

            <br />

            <label>Provider, current: {provider}</label>
            <br />
            <button
                type="button"
                onClick={() => {
                    setProviderIndex((prev) => {
                        const next =
                            prev === providers.length - 1 ? 0 : prev + 1;
                        setProvider(providers[next]);
                        return next;
                    });
                }}
            >
                Switch provider
            </button>

            <br />
            <br />

            <label>Id</label>
            <input
                type="number"
                value={id}
                onChange={(e) => setId(Number.parseInt(e.target.value))}
            />

            <br />
            <br />

            <button
                onClick={(e) => {
                    e.preventDefault();
                    create();
                }}
                type="submit"
                disabled={isLoading}
            >
                Create
            </button>

            <br />
            {error && <p>{error.message}</p>}
        </div>
    );
}
