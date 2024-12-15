import { setupServer } from 'msw/node';
import { renderHook } from '@testing-library/react';
import { useS3MultipartUploader } from '../index.js';
import {
    afterAll,
    afterEach,
    beforeAll,
    describe,
    expect,
    it,
    vi,
} from 'vitest';
import { http, HttpResponse } from 'msw';
import axios from 'axios';

export const server = setupServer(
    ...[
        http.put('https://upload.example/part/*', ({ request, params }) => {
            return HttpResponse.json(request.url, {
                headers: { etag: params[0] },
            });
        }),
    ],
);

const FILE_SIZE_MB = 10;
const buffer = new ArrayBuffer(1024 * 1024 * FILE_SIZE_MB);
const file = new File([buffer], 'test.png');

describe('useS3MultipartUploader', () => {
    beforeAll(() => server.listen());
    afterEach(() => server.resetHandlers());
    afterAll(() => server.close());

    it('should call initialize, getPresignedUrls, and finalize', async () => {
        const FILE_KEY = 'file-key';
        const UPLOAD_ID = 'upload-id';
        const CHUNK_SIZE = 1024 * 1024 * 2;
        const EXPECTED_NR_CHUNKS = Math.ceil(file.size / CHUNK_SIZE);

        const initializer = vi.fn(() => ({
            uploadId: UPLOAD_ID,
            fileKey: FILE_KEY,
        }));

        await axios.put('https://upload.example/part/0');

        const getPresignedUrls = vi.fn(
            ({ uploadId, fileKey }, numberOfChunks) =>
                new Array(numberOfChunks)
                    .fill()
                    .map((_, i) => `https://upload.example/part/${i}`),
        );

        const finalizer = vi.fn(() => ({ data: 'hello world' }));

        const { result: hook, rerender } = renderHook(() =>
            useS3MultipartUploader({
                chunkSize: CHUNK_SIZE,
                initializer,
                getPresignedUrls,
                finalizer,
                uploadFile: axiosUpload,
            }),
        );

        await hook.current.upload(file);
        rerender();

        while (hook.current.isUploading) {
            await new Promise((resolve) => setTimeout(resolve, 100));
        }

        expect(initializer).toHaveBeenCalledTimes(1);
        expect(initializer).toHaveBeenCalledWith(file);
        expect(getPresignedUrls).toHaveBeenCalledTimes(1);
        expect(getPresignedUrls).toHaveBeenCalledWith(
            { uploadId: UPLOAD_ID, fileKey: FILE_KEY },
            EXPECTED_NR_CHUNKS,
        );
        expect(finalizer).toHaveBeenCalledTimes(1);
        expect(finalizer).toHaveBeenCalledWith(
            { uploadId: UPLOAD_ID, fileKey: FILE_KEY },
            new Array(EXPECTED_NR_CHUNKS)
                .fill()
                .map((_, i) => ({ ETag: i.toString(), PartNumber: i + 1 })),
        );
    });
});

async function axiosUpload(file, to) {
    await new Promise((resolve) => setTimeout(resolve, 500));

    return {
        headers: {
            etag: to.split('/').pop(),
        },
    };
}
