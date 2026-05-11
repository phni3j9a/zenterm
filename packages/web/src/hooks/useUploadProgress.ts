import { useCallback, useState } from 'react';

export interface UploadProgressState {
  active: boolean;
  total: number;
  completed: number;
  currentFile?: string;
  error?: string;
}

export interface UploadProgressApi extends UploadProgressState {
  begin: (total: number) => void;
  markStart: (filename: string) => void;
  markDone: () => void;
  fail: (msg: string) => void;
  finish: () => void;
}

const INITIAL: UploadProgressState = {
  active: false,
  total: 0,
  completed: 0,
  currentFile: undefined,
  error: undefined,
};

export function useUploadProgress(): UploadProgressApi {
  const [state, setState] = useState<UploadProgressState>(INITIAL);
  const begin = useCallback((total: number) => {
    setState({ active: true, total, completed: 0, currentFile: undefined, error: undefined });
  }, []);
  const markStart = useCallback((filename: string) => {
    setState((s) => ({ ...s, currentFile: filename }));
  }, []);
  const markDone = useCallback(() => {
    setState((s) => ({ ...s, completed: s.completed + 1 }));
  }, []);
  const fail = useCallback((msg: string) => {
    setState((s) => ({ ...s, error: msg }));
  }, []);
  const finish = useCallback(() => setState(INITIAL), []);
  return { ...state, begin, markStart, markDone, fail, finish };
}
