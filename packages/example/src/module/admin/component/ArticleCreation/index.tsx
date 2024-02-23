"use client";

import { createArticle } from "@/context/article/action/create";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";

// Component used to create new article
export function ArticleCreation() {
    const [provider, setProvider] = useState<"le-monde" | "wired">("le-monde");
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
                isLocal: process.env.IS_LOCAL === "true",
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

            <label>Provider, current: {provider}</label>
            <br />
            <button
                type="button"
                onClick={() =>
                    setProvider((prev) =>
                        prev === "le-monde" ? "wired" : "le-monde"
                    )
                }
            >
                Switch provider
            </button>

            <br />
            <br />

            <label>Id</label>
            <input
                type="number"
                value={id}
                onChange={(e) => setId(parseInt(e.target.value))}
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
