"use client";

import { createArticle } from "@/context/article/action/create";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";

// Component used to create new article
export function ArticleCreation() {
    const [title, setTitle] = useState<string>("");
    const [description, setDescription] = useState<string | undefined>();

    const {
        mutate: create,
        isPending: isLoading,
        error,
    } = useMutation({
        mutationKey: ["createArticle", title],
        mutationFn: async () => {
            await createArticle({ title, description });
            setTitle("");
            setDescription("");
        },
    });

    return (
        <div>
            <label>Title</label>
            <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
            />
            <br />

            <label>Description</label>
            <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
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
