import { useUploader } from '@pantoninho/use-uploader';

export function useS3MultipartUploader({
    chunkSize = 10 * 1024 * 1024,
    initializer,
    getPresignedUrls,
    finalizer,
    threads,
    uploadFile,
} = {}) {
    const { upload, uploads, isUploading } = useUploader({
        threads,
        uploadFile,
    });

    const multiPartUploads = mergeMultipartUploads(uploads);

    return {
        uploads: multiPartUploads,
        isUploading,
        upload: async (file) => {
            try {
                const numberOfChunks = Math.ceil(file.size / chunkSize);
                const uploadRequest = await initializer(file);
                const urls = await getPresignedUrls(
                    uploadRequest,
                    numberOfChunks,
                );
                const chunks = urls.map((url, i) => {
                    const blob = file.slice(i * chunkSize, (i + 1) * chunkSize);
                    return { file: new File([blob], file.name), to: url };
                });

                return upload(chunks, {
                    onComplete: (responses) => {
                        const parts = responses.map((r, i) =>
                            partResponseToFinalizeInput(r.data, i),
                        );
                        return finalizer(uploadRequest, parts);
                    },
                });
            } catch (error) {
                // set error in uploads object
                console.error(error);
            }
        },
    };
}

function partResponseToFinalizeInput(response, partIndex) {
    if (!response.headers.etag) {
        throw new InvalidPartResponseError(
            `Part ${partIndex} response does not have an ETag header`,
        );
    }

    return {
        ETag: response.headers.etag.replaceAll('"', ''),
        PartNumber: partIndex + 1,
    };
}

function mergeMultipartUploads(uploads) {
    uploads = Object.keys(uploads).reduce((multiPartUploads, uploadId) => {
        const upload = uploads[uploadId];

        if (!multiPartUploads[upload.file.name]) {
            multiPartUploads[upload.file.name] = { parts: [] };
        }

        multiPartUploads[upload.file.name].parts.push(upload);
        return multiPartUploads;
    }, {});

    return Object.keys(uploads).reduce((multiPartUploads, fileKey) => {
        const fileUploads = uploads[fileKey];

        return {
            ...multiPartUploads,
            [fileKey]: {
                parts: fileUploads.parts,
                isUploading: fileUploads.parts.some((part) => part.isUploading),
                progress: fileUploads.parts.reduce(
                    (loaded, part) => loaded + part.loaded,
                    0,
                ),
                loaded: fileUploads.parts.reduce(
                    (loaded, part) => loaded + part.loaded,
                    0,
                ),
                total: fileUploads.parts.reduce(
                    (total, part) => total + part.total,
                    0,
                ),
                data: null,
                error: null,
            },
        };
    }, {});
}

export class InvalidPartResponseError extends Error {}
