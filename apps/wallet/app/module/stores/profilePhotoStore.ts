import { create } from "zustand";

type ProfilePhotoState = {
    /**
     * Data URL of the uploaded profile photo for preview
     * Used to display the photo before final submission
     */
    uploadedPhoto: string | undefined;
};

type ProfilePhotoActions = {
    /**
     * Set the uploaded photo data URL
     */
    setUploadedPhoto: (photo: string | undefined) => void;

    /**
     * Clear the uploaded photo
     */
    clearUploadedPhoto: () => void;
};

export const profilePhotoStore = create<
    ProfilePhotoState & ProfilePhotoActions
>()((set) => ({
    uploadedPhoto: undefined,

    setUploadedPhoto: (uploadedPhoto) => set({ uploadedPhoto }),

    clearUploadedPhoto: () => set({ uploadedPhoto: undefined }),
}));

/**
 * Selectors for profile photo state
 */
export const selectUploadedPhoto = (
    state: ProfilePhotoState & ProfilePhotoActions
) => state.uploadedPhoto;
