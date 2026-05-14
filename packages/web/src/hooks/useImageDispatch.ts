import { useCallback } from 'react';
import type { TFunction } from 'i18next';
import type { ApiClient } from '@/api/client';
import { shellQuote } from '@/lib/shellQuote';
import type { UploadProgressApi } from './useUploadProgress';
import type { ToastEntry } from '@/stores/ui';

export interface ImageDispatchDeps {
  apiClient: ApiClient | null;
  /** write returns true if the bytes were handed to the WebSocket, false if WS is closed. */
  write: (text: string) => boolean;
  uploadProgress: UploadProgressApi;
  pushToast: (toast: Omit<ToastEntry, 'id'>) => void;
  t: TFunction;
}

export interface ImageDispatchApi {
  dispatch: (files: File[]) => Promise<void>;
}

export function useImageDispatch(deps: ImageDispatchDeps): ImageDispatchApi {
  const dispatch = useCallback(
    async (files: File[]): Promise<void> => {
      if (files.length === 0) return;
      if (!deps.apiClient) return;
      if (deps.uploadProgress.active) {
        deps.pushToast({ type: 'error', message: deps.t('terminal.uploadBusy') });
        return;
      }
      deps.uploadProgress.begin(files.length);
      for (const file of files) {
        deps.uploadProgress.markStart(file.name);
        let path: string;
        try {
          const res = await deps.apiClient.uploadFile(file);
          path = res.path;
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          deps.uploadProgress.fail(msg);
          deps.pushToast({
            type: 'error',
            message: deps.t('terminal.uploadError', { message: msg }),
          });
          setTimeout(() => deps.uploadProgress.finish(), 3000);
          return;
        }
        deps.uploadProgress.markDone();
        const ok = deps.write(`${shellQuote(path)} `);
        if (!ok) {
          deps.uploadProgress.fail(deps.t('terminal.notConnected'));
          deps.pushToast({ type: 'error', message: deps.t('terminal.notConnected') });
          setTimeout(() => deps.uploadProgress.finish(), 3000);
          return;
        }
      }
      deps.pushToast({
        type: 'success',
        message: deps.t('terminal.uploadDone', { count: files.length }),
      });
      setTimeout(() => deps.uploadProgress.finish(), 1500);
    },
    [deps],
  );
  return { dispatch };
}
