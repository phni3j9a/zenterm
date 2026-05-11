import { describe, expect, it } from 'vitest';
import { languageForFilename } from '../languageForFilename';

describe('languageForFilename', () => {
  it('returns javascript extension for .ts', async () => {
    const ext = await languageForFilename('main.ts');
    expect(ext).not.toBeNull();
  });
  it('returns javascript extension for .tsx', async () => {
    const ext = await languageForFilename('App.tsx');
    expect(ext).not.toBeNull();
  });
  it('returns json for .json', async () => {
    const ext = await languageForFilename('package.json');
    expect(ext).not.toBeNull();
  });
  it('returns markdown for .md', async () => {
    const ext = await languageForFilename('README.md');
    expect(ext).not.toBeNull();
  });
  it('returns python for .py', async () => {
    const ext = await languageForFilename('main.py');
    expect(ext).not.toBeNull();
  });
  it('returns html for .html', async () => {
    const ext = await languageForFilename('index.html');
    expect(ext).not.toBeNull();
  });
  it('returns css for .css', async () => {
    const ext = await languageForFilename('styles.css');
    expect(ext).not.toBeNull();
  });
  it('returns null for unknown extension', async () => {
    const ext = await languageForFilename('weird.xyz');
    expect(ext).toBeNull();
  });
  it('returns null for no extension', async () => {
    const ext = await languageForFilename('LICENSE');
    expect(ext).toBeNull();
  });
});
