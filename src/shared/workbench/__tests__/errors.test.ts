import { describe, expect, it } from 'vitest';

import { WorkbenchStoreError, describeError } from '../errors';

describe('describeError', () => {
  it('returns the message of a thrown Error', () => {
    expect(describeError(new Error('磁盘已满'))).toBe('磁盘已满');
  });

  it('keeps a structured workbench error readable, code prefix included', () => {
    expect(describeError(new WorkbenchStoreError('write-failed', '磁盘已满'))).toBe(
      '写入失败：磁盘已满',
    );
  });

  it('stringifies a throw that is not an Error', () => {
    expect(describeError('boom')).toBe('boom');
    expect(describeError(42)).toBe('42');
  });
});
