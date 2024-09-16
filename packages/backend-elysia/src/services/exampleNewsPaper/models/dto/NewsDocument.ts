/**
 * Representing a news document in our mongo database
 */
export type NewsDocument = {
    _id?: string;
    title: string;
    text: string;
    origin: {
        text: string;
        summary?: string;
    };
    summary: string;
    image: string;
    sourceCountry: string;
    author: string;
    url: string;
    publishDate: Date;
    sentiment: number; // between -1 and 1, -1 being sad, 1 being happy
    category?: string;
};
