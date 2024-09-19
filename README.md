# useS3MultipartUploader

this package provides a simple way to upload large files to S3 using the multipart upload API.

## installation

```sh
npm install use-s3-multipart-uploader
```

## usage

```jsx
import React from 'react';
import { useS3MultipartUploader } from 'use-s3-multipart-uploader';
import axios from 'axios';

function App() {
    const { upload, state } = useS3MultipartUploader({
        threads: 5,
        initialize: async (file) => {
            // initialize s3 multipart upload
            // this initialization should be done on the server side
            // refer to aws s3 documentation for more information
            return { fileKey: 'fileKey', fileId: 'fileId' };
        },
        getPresignedUrls: async ({ fileKey, fileId, numberOfChunks }) => {
            // get presigned urls for uploading parts
            // this should be done on the server side
            // refer to aws s3 documentation for more information
            return ['url1', 'url2', 'url3'];
        },
        finalize: async ({ fileKey, fileId, parts }) => {
            // finalize s3 multipart upload
            // this should be done on the server side
            // refer to aws s3 documentation for more information
        },
    });

    const handleUpload = async (file) => {
        await upload({ file });
    };

    return (
        <div>
            <input
                type="file"
                onChange={(e) => handleUpload(e.target.files[0])}
            />
            {Object.keys(state.uploads).map((filename) => (
                <p key={filename}>
                    {state.uploads[filename].isUploading
                        ? `${filename}: ${state.uploads[filename].progress}`
                        : `${filename}: upload complete`}

                    {state.uploads[filename].error &&
                        `${filename}: ${state.uploads[filename].error.message}`}
                </p>
            ))}
        </div>
    );
}
```

## API

### `useS3MultipartUploader(options)`

a hook for uploading files to S3 using the multipart upload API.

#### options

-   `threads` (number): the number of concurrent uploads. Default is `5`.
-   `initialize` (async function): a function that initializes the multipart upload. This function should return an object with `fileKey` and `fileId`.
-   `getPresignedUrls` (async function): a function that returns an array of presigned urls for uploading parts.
-   `finalize` (async function): a function that finalizes the multipart upload.

#### returns

-   `upload` (function): a function that starts the upload process.
-   `data` (object): the data returned by the `finalize` function.
-   `error` (Error): the error that occurred during the upload process.
-   `progress` (number): the progress of the upload process.
-   `isUploading` (boolean): a flag indicating whether the upload is in progress.
