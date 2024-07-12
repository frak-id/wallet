import type { ObjectId } from "mongodb";

export type NewsDocument = {
    _id?: ObjectId;
    title: string;
    text: string;
    originalText: string;
    summary: string;
    image: string;
    sourceCountry: string;
    author: string;
    url: string;
    publishDate: Date;
    sentiment: number; // between -1 and 1, -1 being sad, 1 being happy
    category?: string;
};
