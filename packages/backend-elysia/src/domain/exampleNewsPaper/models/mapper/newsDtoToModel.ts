import type { WithId } from "mongodb";
import type { FullNews, LightNews } from "../NewsModel";
import type { NewsDocument } from "../dto/NewsDocument";

/**
 * Convert a news document to a light news
 * @param doc
 */
function newsDocumentToLightNews(doc: WithId<NewsDocument>): LightNews {
    return {
        id: doc._id,
        title: doc.title,
        summary: doc.summary,
        image: doc.image,
        sourceCountry: doc.sourceCountry ?? "",
        author: doc.author ?? "",
        publishDate: doc.publishDate,
    };
}

/**
 * Convert a news document to a full news
 * @param doc
 */
function newsDocumentToFullNews(doc: WithId<NewsDocument>): FullNews {
    return {
        id: doc._id,
        title: doc.title,
        text: doc.text,
        url: doc.url,
        summary: doc.summary,
        image: doc.image,
        sourceCountry: doc.sourceCountry ?? "",
        author: doc.author ?? "",
        publishDate: doc.publishDate,
    };
}

export { newsDocumentToLightNews, newsDocumentToFullNews };
