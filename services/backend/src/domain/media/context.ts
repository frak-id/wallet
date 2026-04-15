import { MediaStorageRepository } from "./repositories/MediaStorageRepository";
import { ImageProcessingService } from "./services/ImageProcessingService";

const mediaStorageRepository = new MediaStorageRepository();
const imageProcessingService = new ImageProcessingService();

export namespace MediaContext {
    export const repositories = {
        mediaStorage: mediaStorageRepository,
    };

    export const services = {
        imageProcessing: imageProcessingService,
    };
}
