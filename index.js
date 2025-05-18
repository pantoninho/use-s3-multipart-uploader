import React from 'react';
import axios from 'axios';
import { useTaskQueue } from 'use-task-queue';

/**
 * Error thrown when an upload is already in progress
 * @extends {Error}
 */

export class UploadInProgressError extends Error {
  constructor() {
    super('An upload is already in progress');
    this.name = 'UploadInProgressError';
  }
}

/**
 * React hook for handling S3 multipart uploads with progress tracking
 * @param {import('./index.js').UseS3MultipartUploaderOptions} options - Configuration options
 * @returns {import('./index.js').S3MultipartUploader} Uploader instance
 */
export function useS3MultipartUploader({
    threads = 4,
    initializeUpload,
    finalizeUpload,
}) {
    const queue = useTaskQueue({ concurrent: threads });

    /** @type {[UploadState, React.Dispatch<React.SetStateAction<UploadState>>]} */
    const [state, setState] = React.useState({
        isUploading: false,
        parts: {},
    });

    const totalLoaded = Object.values(state.parts).reduce(
        (acc, { loaded }) => acc + loaded,
        0,
    );

    const total = Object.values(state.parts).reduce(
        (acc, { total }) => acc + total,
        0,
    );

    const totalProgress = total ? totalLoaded / total : 0;

    return {
        state,
        isUploading: state.isUploading,
        progress: totalProgress,
        clearState: () => setState({ isUploading: false, parts: {} }),
        upload: async (file, { processChunk } = {}) => {
            // TODO: implement multiple file uploads
            if (state.isUploading) {
                throw new UploadInProgressError();
            }

            setState({ isUploading: true, parts: {} });

            const data = await initializeUpload({
                name: file.name,
                size: file.size,
                type: file.type,
            });
            const { urls, uploadId, fileKey, chunkSize } = data;

            setState((state) => ({
                ...state,
                parts: urlsToPartState(urls, chunkSize),
            }));

            async function uploadPart(url, i) {
                let chunk = file.slice(i * chunkSize, (i + 1) * chunkSize);

                if (processChunk) {
                    chunk = await processChunk(chunk);
                }

                const res = await axios.put(url, chunk, {
                    onUploadProgress: (e) => {
                        setState((state) => ({
                            ...state,
                            parts: {
                                ...state.parts,
                                [url]: {
                                    loaded: e.loaded,
                                    total: e.total || chunk.size,
                                    index: i,
                                },
                            },
                        }));
                    },
                });

                const ETag = res.headers.etag.replaceAll('"', '');

                setState((state) => ({
                    ...state,
                    parts: {
                        ...state.parts,
                        [url]: {
                            loaded: chunk.size,
                            total: chunk.size,
                            index: i,
                            ETag,
                            PartNumber: i + 1,
                        },
                    },
                }));

                return { ETag, PartNumber: i + 1 };
            }

            const promises = urls.map((url, i) =>
                queue.add(() => uploadPart(url, i), { retries: 3 }),
            );

            const completeParts = await Promise.all(promises);

            await finalizeUpload({ fileKey, uploadId }, completeParts);

            setState((state) => ({ ...state, isUploading: false }));
            return fileKey;
        },
    };
}

function urlsToPartState(urls, chunkSize) {
    return urls.reduce(
        (acc, url, i) => ({
            ...acc,
            [url]: { loaded: 0, total: chunkSize, index: i },
        }),
        {},
    );
}
