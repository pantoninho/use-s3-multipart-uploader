import { renderHook } from '@testing-library/react';
import { useS3MultipartUploader } from '../index.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

const FILE_SIZE_MB = 10;
const buffer = new ArrayBuffer(1024 * 1024 * FILE_SIZE_MB);
const file = new File([buffer], 'test.png');

describe('useS3MultipartUploader', () => {
    /** @type {import("msw/node").SetupServerApi} */
    let server;

    afterEach(() => {
        server.close();
        server.dispose();
    });

    it('should call initialize, getPresignedUrls, and finalize', async () => {
        const FILE_KEY = 'file-key';
        const FILE_ID = 'file-id';
        const CHUNK_SIZE = 1024 * 1024 * 2;
        const EXPECTED_NR_CHUNKS = Math.ceil(file.size / CHUNK_SIZE);

        const handlers = [
            http.put('https://upload.example/part/*', ({ request, params }) => {
                return HttpResponse.json(request.url, {
                    headers: { etag: params[0] },
                });
            }),
        ];

        server = setupServer(...handlers);
        server.listen();

        const initialize = vi.fn(() => ({
            fileId: FILE_ID,
            fileKey: FILE_KEY,
        }));

        const getPresignedUrls = vi.fn(({ numberOfChunks }) =>
            new Array(numberOfChunks)
                .fill()
                .map((_, i) => `https://upload.example/part/${i}`),
        );

        const finalize = vi.fn();

        const { result: hook } = renderHook(() =>
            useS3MultipartUploader({
                chunkSize: CHUNK_SIZE,
                initialize,
                getPresignedUrls,
                finalize,
            }),
        );

        await hook.current.upload({ file });

        expect(initialize).toHaveBeenCalledTimes(1);
        expect(initialize).toHaveBeenCalledWith({ file });
        expect(getPresignedUrls).toHaveBeenCalledTimes(1);
        expect(getPresignedUrls).toHaveBeenCalledWith({
            fileId: FILE_ID,
            fileKey: FILE_KEY,
            numberOfChunks: EXPECTED_NR_CHUNKS,
        });
        expect(finalize).toHaveBeenCalledTimes(1);
        expect(finalize).toHaveBeenCalledWith({
            fileId: FILE_ID,
            fileKey: FILE_KEY,
            parts: new Array(EXPECTED_NR_CHUNKS)
                .fill()
                .map((_, i) => ({ ETag: i.toString(), PartNumber: i + 1 })),
        });
    });
});
