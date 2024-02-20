"use client";

import { createArticle } from "@/context/article/action/create";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";

// Component used to create new article
export function ArticleCreation() {
    const [id, setId] = useState<number>(0);

    const {
        mutate: create,
        isPending: isLoading,
        error,
    } = useMutation({
        mutationKey: ["createArticle", id],
        mutationFn: async () => {
            await createArticle({
                id,
                origin: window.location.origin,
                isLocal: process.env.IS_LOCAL === "true",
            });
            setId(0);
        },
    });

    return (
        <div>
            <p>
                Id 1: Le Cambodge
                <br />
                Id 2: Les NFT pompidou
                <br />
                Id 3: Une tech qui revolutionne la finance
            </p>

            <br />

            <label>Id</label>
            <input
                type="number"
                value={id}
                onChange={(e) => setId(parseInt(e.target.value))}
            />
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
