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
  | 'workbench-invalid'
  | 'write-failed'
  | 'file-corrupt'
  | 'not-found'
  | 'too-large'
  /** The shell offers no native folder chooser; the manual path form is the fallback. */
  | 'picker-unavailable'
  /** The shell's folder chooser was offered but opening it failed. */
  | 'picker-failed'
  /** Last-resort code for unexpected failures and unknown RPC methods. */
  | 'internal';

/** Stable base message per code; details are appended after a colon. */
const BASE_MESSAGE: Record<WorkbenchErrorCode, string> = {
  'root-unset': '尚未设置工作台根目录',
  'root-unreachable': '无法访问工作台根目录',
  'id-invalid': '工作台 id 不合法',
  'workbench-invalid': '工作台配置不合法',
  'write-failed': '写入失败',
  'file-corrupt': '文件损坏',
  'not-found': '未找到该工作台',
  'too-large': '文件超过 256KB 上限',
  'picker-unavailable': '系统文件夹选择框不可用，请手动填写路径',
  'picker-failed': '系统文件夹选择框调用失败，请手动填写路径',
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
