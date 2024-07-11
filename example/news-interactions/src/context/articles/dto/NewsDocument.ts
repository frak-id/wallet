import type { ObjectId } from "mongodb";

export type NewsDocument = {
    _id: ObjectId;
    title: string;
    text: string;
    summary: string;
    author: string;
    url: string;
    image: string;
    publishDate: Date;
    category?: string;
};
