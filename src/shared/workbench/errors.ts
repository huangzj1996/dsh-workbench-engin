/**
 * Structured errors shared by the workbench data layer and the Host RPC.
 *
 * The Client shows `message` verbatim, so every message is a readable Chinese
 * sentence; `code` is the stable machine-readable half of the contract.
 */

/** The error codes the workbench Host RPC promises to the Client. */
export type WorkbenchErrorCode =
  | 'root-unset'
  | 'root-unreachable'
  | 'id-invalid'
  | 'scene-invalid'
  | 'write-failed'
  | 'file-corrupt'
  | 'not-found'
  | 'too-large'
  /** Last-resort code for unexpected failures and unknown RPC methods. */
  | 'internal';

/** Stable base message per code; details are appended after a colon. */
const BASE_MESSAGE: Record<WorkbenchErrorCode, string> = {
  'root-unset': '尚未设置工作台根目录',
  'root-unreachable': '无法访问工作台根目录',
  'id-invalid': '工作台 id 不合法',
  'scene-invalid': '工作台配置不合法',
  'write-failed': '写入失败',
  'file-corrupt': '文件损坏',
  'not-found': '未找到该工作台',
  'too-large': '文件超过 256KB 上限',
  internal: '操作失败',
};

/** The one error type thrown by the data layer and mapped by the RPC layer. */
export class WorkbenchStoreError extends Error {
  readonly code: WorkbenchErrorCode;

  constructor(code: WorkbenchErrorCode, detail?: string) {
    super(detail === undefined || detail === '' ? BASE_MESSAGE[code] : `${BASE_MESSAGE[code]}：${detail}`);
    this.name = 'WorkbenchStoreError';
    this.code = code;
  }
}
