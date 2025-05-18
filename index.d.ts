export interface UploadPartProgress {
  loaded: number;
  total: number;
  index: number;
  ETag?: string;
  PartNumber?: number;
}

export interface UploadState {
  isUploading: boolean;
  parts: Record<string, UploadPartProgress>;
}

export interface InitializeUploadParams {
  name: string;
  size: number;
  type: string;
}

export interface InitializeUploadResponse {
  urls: string[];
  uploadId: string;
  fileKey: string;
  chunkSize: number;
}

export interface FinalizeUploadParams {
  fileKey: string;
  uploadId: string;
}

export interface CompletePart {
  ETag: string;
  PartNumber: number;
}

export interface UseS3MultipartUploaderOptions<T> {
  /** Number of concurrent uploads (default: 4) */
  threads?: number;
  
  /** Function to initialize the upload and get pre-signed URLs */
  initializeUpload: (fileInfo: InitializeUploadParams) => Promise<InitializeUploadResponse>;
  
  /** Function to finalize the upload after all parts are uploaded */
  finalizeUpload: (params: FinalizeUploadParams, parts: CompletePart[]) => Promise<T>;
}

export interface S3MultipartUploader<T> {
  /** Current upload state */
  state: UploadState;
  
  /** Whether an upload is in progress */
  isUploading: boolean;
  
  /** Upload progress (0-1) */
  progress: number;
  
  /** Clear the current upload state */
  clearState: () => void;
  
  /**
   * Upload a file
   * @param file The file to upload
   * @param options Upload options
   * @returns Promise that resolves with the file key when upload is complete
   */
  upload: (
    file: File,
    options?: {
      processChunk?: (chunk: Blob) => Blob | Promise<Blob>;
    }
  ) => Promise<T>;
}

export class UploadInProgressError extends Error {
  constructor();
}

/**
 * React hook for handling S3 multipart uploads with progress tracking
 * @param options Configuration options for the uploader
 * @returns Object with upload controls and state
 */
declare function useS3MultipartUploader<T>(
  options: UseS3MultipartUploaderOptions<T>
): S3MultipartUploader<T>;

export { useS3MultipartUploader }
