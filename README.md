# useS3MultipartUploader

[![Codacy Badge](https://app.codacy.com/project/badge/Grade/de5931b57dee443ba2b06547303c1ce2)](https://app.codacy.com/gh/pantoninho/use-s3-multipart-uploader/dashboard?utm_source=gh&utm_medium=referral&utm_content=&utm_campaign=Badge_grade)
[![Codacy Coverage](https://app.codacy.com/project/badge/Coverage/de5931b57dee443ba2b06547303c1ce2)](https://app.codacy.com/gh/pantoninho/use-s3-multipart-uploader/dashboard?utm_source=github.com&utm_medium=referral&utm_content=pantoninho/use-s3-multipart-uploader&utm_campaign=Badge_Coverage)
[![CI](https://github.com/pantoninho/use-s3-multipart-uploader/actions/workflows/codacy.yml/badge.svg)](https://github.com/pantoninho/use-s3-multipart-uploader/actions/workflows/codacy.yml)

A React hook for handling S3 multipart uploads with progress tracking and concurrent upload support.

## Installation

```sh
npm install use-s3-multipart-uploader
```

## Usage

```jsx
import React from 'react';
import { useS3MultipartUploader } from 'use-s3-multipart-uploader';

function App() {
    const { upload, state, progress, isUploading, clearState } = useS3MultipartUploader({
        threads: 4, // Number of concurrent uploads
        initializeUpload: async (fileInfo) => {
            // Call your backend to initialize the multipart upload
            // This should return an object with:
            // - urls: Array of presigned URLs for each part
            // - uploadId: The S3 upload ID
            // - fileKey: The S3 object key
            // - chunkSize: The size of each chunk in bytes
            const response = await fetch('/api/init-upload', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: fileInfo.name,
                    size: fileInfo.size,
                    type: fileInfo.type
                })
            });
            return response.json();
        },
        finalizeUpload: async (uploadInfo, parts) => {
            // Call your backend to complete the multipart upload
            // parts is an array of { ETag, PartNumber } objects
            const response = await fetch('/api/complete-upload', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fileKey: uploadInfo.fileKey,
                    uploadId: uploadInfo.uploadId,
                    parts
                })
            });
            return response.json();
        }
    });

    const handleFileChange = async (event) => {
        const file = event.target.files[0];
        if (!file) return;
        
        try {
            const result = await upload(file, {
                // Optional: Transform chunks before upload (e.g., encrypt, compress)
                processChunk: async (chunk) => {
                    // Example: return await encryptChunk(chunk);
                    return chunk;
                },
                // Optional: Number of retry attempts for failed part uploads (default: 3)
                retries: 3
            });
            console.log('Upload completed:', result);
        } catch (error) {
            console.error('Upload failed:', error);
        }
    };

    return (
        <div>
            <input
                type="file"
                onChange={handleFileChange}
                disabled={isUploading}
            />
            
            {isUploading && (
                <div>
                    <progress value={progress * 100} max="100" />
                    <div>Uploading: {Math.round(progress * 100)}%</div>
                </div>
            )}
            
            {/* Optional: Show detailed part upload status */}
            {Object.entries(state.parts).map(([url, part]) => (
                <div key={url}>
                    Part {part.index + 1}: {part.loaded}/{part.total} bytes
                </div>
            ))}
        </div>
    );
}
```

## API Reference

### `useS3MultipartUploader(options)`

A React hook that provides S3 multipart upload functionality.

#### Options

- `threads` (number, optional): Number of concurrent uploads. Default is `4`.
- `initializeUpload` (async function): A function that initializes the multipart upload. Receives file info and should return:
  - `urls`: Array of presigned URLs for each part
  - `uploadId`: The S3 upload ID
  - `fileKey`: The S3 object key
  - `chunkSize`: Size of each chunk in bytes
- `finalizeUpload` (async function): A function called to complete the upload. Receives upload info and parts array, should return the final result.

#### Returns

An object with:
- `upload`: Function to start the upload process. Accepts a File object and options.
- `state`: Current upload state including individual part status.
- `progress`: Overall upload progress (0 to 1).
- `isUploading`: Boolean indicating if an upload is in progress.
- `clearState`: Function to reset the upload state.

## Error Handling

The hook throws an `UploadInProgressError` if you try to start a new upload while one is already in progress. You can import and check for this error:

```jsx
try {
    await upload(file);
} catch (error) {
    if (error.name === 'UploadInProgressError') {
        console.log('An upload is already in progress');
    }
}
```
