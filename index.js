import axios from 'axios';
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
        uploadFile: uploadPart,
        upload: async (file) => {
            const numberOfChunks = Math.ceil(file.size / chunkSize);
            const uploadRequest = await initializer(file);
            const urls = await getPresignedUrls(uploadRequest, numberOfChunks);
            const chunks = urls.map((url, i) => {
                const blob = file.slice(i * chunkSize, (i + 1) * chunkSize);
                return { file: new File([blob], file.name), to: url };
            });

            return upload(chunks, {
                onComplete: (responses) => {
                    return finalizer(
                        uploadRequest,
                        responses.map((r, i) => ({
                            ETag: r.data.ETag,
                            PartNumber: i + 1,
                        })),
                    );
                },
            });
        },
    };
}

async function uploadPart(part, to, onUploadProgress) {
    const { headers } = await axios.put(to, part, { onUploadProgress });

    return {
        ETag: headers.etag.replaceAll('"', ''),
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
                progress:
                    fileUploads.parts.reduce(
                        (loaded, part) => loaded + part.loaded,
                        0,
                    ) /
                    fileUploads.parts.reduce(
                        (total, part) => total + part.total,
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
                error: fileUploads.parts.some((part) => part.error),
            },
        };
    }, {});
}

export class InvalidPartResponseError extends Error {}
