import type {
  FileListResponse, FileContentResponse, FileWriteResponse,
  FileDeleteResponse, FileRenameResponse, FileCopyResponse,
  FileMoveResponse, FileMkdirResponse, FileUploadResponse,
} from '@zenterm/shared';
import { useFilesStore } from '@/stores/files';

export interface FilesApiClient {
  listFiles(path: string, showHidden: boolean): Promise<FileListResponse>;
  getFileContent(path: string): Promise<FileContentResponse>;
  writeFileContent(path: string, content: string): Promise<FileWriteResponse>;
  deleteFile(path: string): Promise<FileDeleteResponse>;
  renameFile(path: string, newName: string): Promise<FileRenameResponse>;
  copyFiles(sources: string[], destination: string): Promise<FileCopyResponse>;
  moveFiles(sources: string[], destination: string): Promise<FileMoveResponse>;
  createDirectory(path: string): Promise<FileMkdirResponse>;
  uploadFile(file: File, destPath: string): Promise<FileUploadResponse>;
  buildRawFileUrl(path: string): string;
}

export async function loadDirectory(
  client: Pick<FilesApiClient, 'listFiles'>,
  path: string,
  showHidden: boolean,
): Promise<void> {
  const store = useFilesStore.getState();
  store.setLoading(true);
  store.setError(null);
  try {
    const res = await client.listFiles(path, showHidden);
    useFilesStore.getState().setCurrentPath(path);
    useFilesStore.getState().setEntries(res.entries);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    useFilesStore.getState().setError(msg);
  } finally {
    useFilesStore.getState().setLoading(false);
  }
}
