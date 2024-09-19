import { useUploader } from '@pantoninho/use-uploader';
import axios from 'axios';

/**
 * extends @pantoninho/use-uploader to upload files to S3 using the multipart upload API
 *
 * @param {object} params params
 * @param {number} params.threads number of concurrent threads
 */
export function useS3MultipartUploader({
    threads = 5,
    chunkSize = 10 * 1024 * 1024, // 10MB
    initialize,
    getPresignedUrls,
    finalize,
}) {
    const uploader = useUploader({
        threads,
        uploadChunk,
    });

    async function upload({ file }) {
        const numberOfChunks = Math.ceil(file.size / chunkSize);
        const { fileId, fileKey } = await initialize({ file });
        const urls = await getPresignedUrls({
            fileId,
            fileKey,
            numberOfChunks,
        });
        const results = await uploader.upload({ file, to: urls });
        const parts = await Promise.all(
            results.map((part, i) => partResponseToFinalizeInput(part, i)),
        );
        return await finalize({ fileId, fileKey, parts });
    }

    return {
        ...uploader,
        upload,
    };
}

/**
 * transforms a part upload response into an object required by the s3 upload finalization.
 *
 * @param {Response} response http response from S3 for a part upload
 * @param {number} partIndex part index
 * @returns {{ETag: string, PartNumber: number}} input for the finalize function
 */
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

/**
 * uploads a chunk to a url using axios
 * @param {object} params params
 * @param {Blob} params.chunk chunk to upload
 * @param {string} params.url url to upload the chunk to
 * @param {function} params.onProgress on progress callback
 * @returns {Promise<Response>} http response
 */
async function uploadChunk({ chunk, url, onProgress }) {
    return await axios.put(url, chunk, { onUploadProgress: onProgress });
}

export class InvalidPartResponseError extends Error {}
