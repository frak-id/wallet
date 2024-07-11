import type { ObjectId } from "mongodb";

export type NewsDocument = {
    _id?: ObjectId;
    title: string;
    text: string;
    summary: string;
    image: string;
    sourceCountry: string;
    author: string;
    url: string;
    publishDate: Date;
    category?: string;
};
