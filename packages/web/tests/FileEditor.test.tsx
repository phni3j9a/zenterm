import type { FileContentResponse, FileWriteResponse } from '@zenterm/shared';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as apiClient from '../src/api/client';
import { FileEditor } from '../src/components/FileManager/FileEditor';

vi.mock('../src/api/client', () => ({
  getFileContent: vi.fn(),
  writeFileContent: vi.fn(),
}));

const mockedGetFileContent = vi.mocked(apiClient.getFileContent);
const mockedWriteFileContent = vi.mocked(apiClient.writeFileContent);
const filePath = '/tmp/test.txt';
let container: HTMLDivElement;
let root: Root;

function getTextarea(): HTMLTextAreaElement {
  const textarea = container.querySelector('textarea');
  if (!textarea) throw new Error('textarea not found');
  return textarea;
}

function findButton(label: string): HTMLButtonElement | null {
  return Array.from(container.querySelectorAll('button')).find(
    (button) => button.textContent === label,
  ) ?? null;
}

function setTextareaValue(textarea: HTMLTextAreaElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLTextAreaElement.prototype,
    'value',
  )?.set;
  if (!setter) throw new Error('textarea value setter not found');
  setter.call(textarea, value);
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
}

async function flushEffects(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
  });
}

async function renderEditor(response: FileContentResponse): Promise<void> {
  mockedGetFileContent.mockResolvedValueOnce(response);
  await act(async () => {
    root.render(<FileEditor path={filePath} onClose={vi.fn()} />);
  });
  await flushEffects();
}

describe('FileEditor', () => {
  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    mockedGetFileContent.mockReset();
    mockedWriteFileContent.mockReset();
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it('truncated=true のとき警告を表示して readOnly にする', async () => {
    await renderEditor({
      path: filePath,
      content: 'first line',
      lines: 1000,
      truncated: true,
    });

    expect(container.textContent).toContain(
      'File too large to edit (first 1000 lines shown)',
    );
    expect(getTextarea().readOnly).toBe(true);
    expect(findButton('Save')).toBeNull();
  });

  it('truncated=true のとき Ctrl+S で保存しない', async () => {
    await renderEditor({
      path: filePath,
      content: 'before',
      lines: 1000,
      truncated: true,
    });

    const textarea = getTextarea();
    await act(async () => {
      setTextareaValue(textarea, 'after');
    });

    await act(async () => {
      textarea.dispatchEvent(new KeyboardEvent('keydown', {
        key: 's',
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      }));
    });

    expect(mockedWriteFileContent).not.toHaveBeenCalled();
  });

  it('truncated=false のとき Ctrl+S で保存する', async () => {
    const writeResponse: FileWriteResponse = { path: filePath, bytes: 5 };
    mockedWriteFileContent.mockResolvedValueOnce(writeResponse);
    await renderEditor({
      path: filePath,
      content: 'before',
      lines: 1,
      truncated: false,
    });

    const textarea = getTextarea();
    await act(async () => {
      setTextareaValue(textarea, 'after');
    });

    expect(findButton('Save')).not.toBeNull();

    await act(async () => {
      textarea.dispatchEvent(new KeyboardEvent('keydown', {
        key: 's',
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      }));
      await Promise.resolve();
    });

    expect(mockedWriteFileContent).toHaveBeenCalledWith(filePath, 'after');
  });
});
