// 由 scripts/build.mjs 从 src/host/** 生成 —— 不要手改本文件。
// src/shared/workbench/errors.ts
var BASE_MESSAGE = {
  "root-unset": "\u5C1A\u672A\u8BBE\u7F6E\u5DE5\u4F5C\u53F0\u6839\u76EE\u5F55",
  "root-unreachable": "\u65E0\u6CD5\u8BBF\u95EE\u5DE5\u4F5C\u53F0\u6839\u76EE\u5F55",
  "id-invalid": "\u5DE5\u4F5C\u53F0 id \u4E0D\u5408\u6CD5",
  "workbench-invalid": "\u5DE5\u4F5C\u53F0\u914D\u7F6E\u4E0D\u5408\u6CD5",
  "write-failed": "\u5199\u5165\u5931\u8D25",
  "file-corrupt": "\u6587\u4EF6\u635F\u574F",
  "not-found": "\u672A\u627E\u5230\u8BE5\u5DE5\u4F5C\u53F0",
  "too-large": "\u6587\u4EF6\u8D85\u8FC7 256KB \u4E0A\u9650",
  "picker-unavailable": "\u7CFB\u7EDF\u6587\u4EF6\u5939\u9009\u62E9\u6846\u4E0D\u53EF\u7528\uFF0C\u8BF7\u624B\u52A8\u586B\u5199\u8DEF\u5F84",
  "picker-failed": "\u7CFB\u7EDF\u6587\u4EF6\u5939\u9009\u62E9\u6846\u8C03\u7528\u5931\u8D25\uFF0C\u8BF7\u624B\u52A8\u586B\u5199\u8DEF\u5F84",
  "invalid-request": "\u8BF7\u6C42\u4E0D\u7B26\u5408 RPC \u534F\u8BAE",
  internal: "\u64CD\u4F5C\u5931\u8D25"
};
var WorkbenchStoreError = class extends Error {
  code;
  constructor(code, detail) {
    super(detail === void 0 || detail === "" ? BASE_MESSAGE[code] : `${BASE_MESSAGE[code]}\uFF1A${detail}`);
    this.name = "WorkbenchStoreError";
    this.code = code;
  }
};
function describeError(error) {
  return error instanceof Error ? error.message : String(error);
}

// src/shared/workbench/schema.ts
var WORKBENCH_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/;
function isWorkbenchId(value) {
  return typeof value === "string" && WORKBENCH_ID_PATTERN.test(value);
}
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isPositiveInteger(value) {
  return typeof value === "number" && Number.isInteger(value) && value >= 1;
}
function invalid(reason) {
  throw new WorkbenchStoreError("workbench-invalid", reason);
}
function validatePanel(raw, index) {
  if (!isRecord(raw)) invalid(`\u7B2C ${index + 1} \u4E2A\u5B50\u9762\u677F\u4E0D\u662F\u5BF9\u8C61`);
  const panel = raw;
  if (typeof panel["id"] !== "string" || panel["id"].trim() === "") {
    invalid(`\u7B2C ${index + 1} \u4E2A\u5B50\u9762\u677F\u7F3A\u5C11 id`);
  }
  if (typeof panel["title"] !== "string") invalid(`\u7B2C ${index + 1} \u4E2A\u5B50\u9762\u677F\u7F3A\u5C11\u6807\u9898`);
  if (typeof panel["type"] !== "string" || panel["type"].trim() === "") {
    invalid(`\u7B2C ${index + 1} \u4E2A\u5B50\u9762\u677F\u7F3A\u5C11\u7C7B\u578B`);
  }
  if (panel["sub"] !== void 0 && typeof panel["sub"] !== "string") {
    invalid(`\u7B2C ${index + 1} \u4E2A\u5B50\u9762\u677F\u7684\u526F\u6807\u9898\u5FC5\u987B\u662F\u5B57\u7B26\u4E32`);
  }
  for (const key of ["col", "row", "w", "h"]) {
    if (panel[key] !== void 0 && !isPositiveInteger(panel[key])) {
      invalid(`\u7B2C ${index + 1} \u4E2A\u5B50\u9762\u677F\u7684 ${key} \u5FC5\u987B\u662F\u6B63\u6574\u6570`);
    }
  }
  if (panel["expand"] !== void 0 && typeof panel["expand"] !== "boolean") {
    invalid(`\u7B2C ${index + 1} \u4E2A\u5B50\u9762\u677F\u7684 expand \u5FC5\u987B\u662F\u5E03\u5C14\u503C`);
  }
  return panel;
}
function validateWorkbench(raw) {
  if (!isRecord(raw)) invalid("\u914D\u7F6E\u5FC5\u987B\u662F JSON \u5BF9\u8C61");
  const workbench = raw;
  if (!isWorkbenchId(workbench["id"])) invalid("\u7F3A\u5C11\u5408\u6CD5\u7684 id");
  if (typeof workbench["name"] !== "string" || workbench["name"].trim() === "") invalid("\u7F3A\u5C11\u540D\u79F0");
  if (workbench["description"] !== void 0 && typeof workbench["description"] !== "string") {
    invalid("description \u5FC5\u987B\u662F\u5B57\u7B26\u4E32");
  }
  if (workbench["cols"] !== void 0 && !isPositiveInteger(workbench["cols"])) invalid("cols \u5FC5\u987B\u662F\u6B63\u6574\u6570");
  if (!Array.isArray(workbench["panels"])) invalid("panels \u5FC5\u987B\u662F\u6570\u7EC4");
  workbench["panels"].forEach((panel, index) => validatePanel(panel, index));
  return workbench;
}
function parseWorkbench(text) {
  let raw;
  try {
    raw = JSON.parse(text);
  } catch (error) {
    throw new WorkbenchStoreError("file-corrupt", error instanceof Error ? error.message : String(error));
  }
  return validateWorkbench(raw);
}
function serializeWorkbench(workbench) {
  return `${JSON.stringify(workbench, null, 2)}
`;
}

// src/shared/workbench/protocol.ts
var RPC_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
var WORKBENCH_RPC_ENDPOINT = "workbench";
function readWorkbenchRpcId(body) {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return null;
  const rpcId = body["rpcId"];
  return typeof rpcId === "string" && RPC_ID_PATTERN.test(rpcId) ? rpcId : null;
}
function parseWorkbenchCall(payload) {
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) return null;
  const record = payload;
  if (typeof record["method"] !== "string" || record["method"] === "") return null;
  return { method: record["method"], payload: record["payload"] };
}
function parseWorkbenchClientRequest(body) {
  const rpcId = readWorkbenchRpcId(body);
  if (rpcId === null) return null;
  const record = body;
  if (record["type"] !== "client-request") return null;
  const method = record["method"];
  if (typeof method !== "string" || method === "") return null;
  return { type: "client-request", rpcId, method, payload: record["payload"] };
}
function workbenchServerResponse(rpcId, result) {
  return { type: "server-response", rpcId, result };
}

// src/host/workbench/picker.ts
function isNative(capability) {
  return capability.kind === "native" && typeof capability.pick === "function";
}
function planRootPick(capability) {
  return capability !== void 0 && isNative(capability) ? { kind: "native" } : { kind: "unavailable" };
}
async function pickRootDirectory(lookup) {
  let capability;
  try {
    capability = lookup()?.capability();
  } catch {
    capability = void 0;
  }
  const plan = planRootPick(capability);
  if (plan.kind !== "native" || capability === void 0) {
    throw new WorkbenchStoreError("picker-unavailable");
  }
  try {
    const picked = await capability.pick(new AbortController().signal);
    if (picked === null) return { path: null };
    if (typeof picked !== "string" || picked.trim() === "") {
      throw new Error("\u9009\u62E9\u6846\u6CA1\u6709\u8FD4\u56DE\u6587\u4EF6\u5939\u8DEF\u5F84");
    }
    return { path: picked.trim() };
  } catch (error) {
    throw new WorkbenchStoreError("picker-failed", describeError(error));
  }
}

// src/host/workbench/store.ts
import * as nodeFs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

// src/shared/workbench/context-card.ts
var CONTEXT_CARD_PURPOSE_PLACEHOLDER = "\uFF08\u5F85\u8865\u5145\uFF09";
function contextCardMarkdown(workbench) {
  const purpose = workbench.description !== void 0 && workbench.description.trim() !== "" ? workbench.description.trim() : CONTEXT_CARD_PURPOSE_PLACEHOLDER;
  const id = workbench.id;
  return [
    `# ${workbench.name}`,
    "",
    `> \u5DE5\u4F5C\u53F0 id\uFF1A\`${id}\``,
    "",
    "## \u7528\u9014",
    "",
    purpose,
    "",
    "## \u8FB9\u754C",
    "",
    `- \u8FD9\u4EFD\u8BF4\u660E\u662F\u7ED9 AI \u7684\u4E0A\u4E0B\u6587\uFF0C\u4E0D\u53C2\u4E0E\u6E32\u67D3\uFF1B\u5DE5\u4F5C\u53F0\u7684\u6743\u5A01\u914D\u7F6E\u662F \`${id}/${id}.json\`\u3002`,
    "- \u4FEE\u6539\u8FD9\u4EFD\u8BF4\u660E\u4E0D\u4F1A\u5F71\u54CD\u5DE5\u4F5C\u53F0\u754C\u9762\uFF1B\u4FEE\u6539 JSON \u624D\u4F1A\u3002",
    "- \u53EA\u63CF\u8FF0\u8FD9\u4E2A\u5DE5\u4F5C\u53F0\u672C\u8EAB\uFF0C\u4E0D\u5199\u8DE8\u5DE5\u4F5C\u53F0\u7684\u7EA6\u5B9A\u3002",
    "",
    "## \u53EF\u4EE5\u653E\u4EC0\u4E48",
    "",
    "- \u8FD9\u4E2A\u5DE5\u4F5C\u53F0\u89E3\u51B3\u4EC0\u4E48\u95EE\u9898\u3001\u505A\u5230\u4EC0\u4E48\u7B97\u5B8C\u6210\uFF08\u6210\u529F\u6807\u51C6\uFF09\u3002",
    "- \u5404\u4E2A\u5B50\u9762\u677F\u5404\u81EA\u8D1F\u8D23\u4EC0\u4E48\u3001\u5F7C\u6B64\u600E\u4E48\u914D\u5408\u3002",
    "- \u4F9B AI \u53C2\u8003\u7684\u80CC\u666F\u8D44\u6599\u3001\u672F\u8BED\u4E0E\u65E2\u6709\u7EA6\u5B9A\u3002",
    "",
    "## \u4E0D\u8981\u653E\u4EC0\u4E48",
    "",
    "- \u5BC6\u7801\u3001\u4EE4\u724C\u3001\u79C1\u94A5\u7B49\u654F\u611F\u4FE1\u606F\u3002",
    "- \u4E0E\u8FD9\u4E2A\u5DE5\u4F5C\u53F0\u65E0\u5173\u7684\u901A\u7528\u8D44\u6599\u3002",
    "- \u9700\u8981\u5B9E\u65F6\u540C\u6B65\u7684\u72B6\u6001\uFF08\u4EE5 JSON \u6587\u4EF6\u548C\u754C\u9762\u4E3A\u51C6\uFF09\u3002",
    ""
  ].join("\n");
}

// src/host/workbench/store.ts
var CONFIG_DIR = "dsh-hello-word";
var CONFIG_FILE = "config.json";
var INDEX_FILE = "index.json";
var INDEX_VERSION = 1;
var CONTEXT_CARD_SUFFIX = "-context.md";
var MAX_FILE_BYTES = 256 * 1024;
var nodeFsAdapter = {
  readFile: (file, encoding) => nodeFs.readFile(file, encoding),
  writeFile: (file, data, encoding) => nodeFs.writeFile(file, data, encoding),
  rename: (from, to) => nodeFs.rename(from, to),
  rm: (target, options) => nodeFs.rm(target, options),
  mkdir: async (dir, options) => {
    await nodeFs.mkdir(dir, options);
  },
  async readdir(dir) {
    const entries = await nodeFs.readdir(dir, { withFileTypes: true });
    return entries.map((entry) => ({ name: entry.name, isDirectory: () => entry.isDirectory() }));
  },
  stat: (target) => nodeFs.stat(target)
};
function resolveDshHome(env) {
  const fromEnv = env["DSH_HOME"];
  return fromEnv !== void 0 && fromEnv.trim() !== "" ? fromEnv : path.join(os.homedir(), ".dsh");
}
var temporaryCounter = 0;
async function atomicWrite(fs, file, data) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  temporaryCounter += 1;
  const temporary = path.join(
    path.dirname(file),
    `.${path.basename(file)}.${process.pid}.${temporaryCounter}.tmp`
  );
  try {
    await fs.writeFile(temporary, data, "utf8");
    await fs.rename(temporary, file);
  } catch (error) {
    await fs.rm(temporary, { force: true }).catch(() => void 0);
    throw error;
  }
}
function isNotFound(error) {
  return typeof error === "object" && error !== null && error.code === "ENOENT";
}
async function assertRoot(fs, root) {
  try {
    const stats = await fs.stat(root);
    if (!stats.isDirectory()) throw new Error("\u4E0D\u662F\u6587\u4EF6\u5939");
  } catch (error) {
    throw new WorkbenchStoreError("root-unreachable", `\u8DEF\u5F84\u4E0D\u5B58\u5728\u6216\u4E0D\u662F\u6587\u4EF6\u5939\uFF1A${root}`);
  }
}
async function readIndex(fs, root) {
  let text;
  try {
    text = await fs.readFile(path.join(root, INDEX_FILE), "utf8");
  } catch (error) {
    if (isNotFound(error)) {
      return { data: { version: INDEX_VERSION, workbenches: [] }, created: true };
    }
    throw new WorkbenchStoreError("file-corrupt", `\u7D22\u5F15\u6587\u4EF6\u65E0\u6CD5\u8BFB\u53D6\uFF1A${describeError(error)}`);
  }
  let raw;
  try {
    raw = JSON.parse(text);
  } catch (error) {
    throw new WorkbenchStoreError("file-corrupt", `\u7D22\u5F15\u6587\u4EF6\u4E0D\u662F\u5408\u6CD5 JSON\uFF1A${describeError(error)}`);
  }
  const workbenches = typeof raw === "object" && raw !== null ? raw["workbenches"] : void 0;
  const valid = Array.isArray(workbenches) && workbenches.every((entry) => {
    if (typeof entry !== "object" || entry === null) return false;
    const row = entry;
    return typeof row["id"] === "string" && typeof row["order"] === "number" && Number.isInteger(row["order"]) && row["order"] >= 1;
  });
  if (!valid) throw new WorkbenchStoreError("file-corrupt", "\u7D22\u5F15\u6587\u4EF6\u7ED3\u6784\u4E0D\u6B63\u786E");
  const data = raw;
  return { data, created: false };
}
async function writeIndex(fs, root, data) {
  const next = {
    ...data,
    version: typeof data.version === "number" ? data.version : INDEX_VERSION,
    workbenches: data.workbenches
  };
  try {
    await atomicWrite(fs, path.join(root, INDEX_FILE), `${JSON.stringify(next, null, 2)}
`);
  } catch (error) {
    throw new WorkbenchStoreError("write-failed", describeError(error));
  }
}
async function scanWorkbenchIds(fs, root) {
  let entries;
  try {
    entries = await fs.readdir(root);
  } catch (error) {
    throw new WorkbenchStoreError("root-unreachable", `\u65E0\u6CD5\u8BFB\u53D6\u6839\u76EE\u5F55\uFF1A${root}\uFF08${describeError(error)}\uFF09`);
  }
  const ids = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || !isWorkbenchId(entry.name)) continue;
    try {
      const stats = await fs.stat(path.join(root, entry.name, `${entry.name}.json`));
      if (stats.isFile()) ids.push(entry.name);
    } catch {
    }
  }
  return ids.sort();
}
async function readWorkbenchOrNull(fs, file, expectedId) {
  try {
    const workbench = parseWorkbench(await fs.readFile(file, "utf8"));
    return workbench.id === expectedId ? workbench : null;
  } catch {
    return null;
  }
}
function idMismatchError(dirId, jsonId) {
  return new WorkbenchStoreError(
    "file-corrupt",
    `\u76EE\u5F55\u540D\u4E0E\u914D\u7F6E id \u4E0D\u4E00\u81F4\uFF1A${dirId}/${dirId}.json \u91CC\u7684 id \u662F ${jsonId}`
  );
}
async function backfillContextCard(fs, root, workbench) {
  try {
    await ensureContextCard(fs, root, workbench);
  } catch {
  }
}
async function ensureContextCard(fs, root, workbench) {
  const file = path.join(root, workbench.id, `${workbench.id}${CONTEXT_CARD_SUFFIX}`);
  try {
    await fs.stat(file);
    return;
  } catch (error) {
    if (!isNotFound(error)) {
      throw new WorkbenchStoreError("file-corrupt", `\u65E0\u6CD5\u8BFB\u53D6\u5B9A\u4F4D\u5361\uFF1A${describeError(error)}`);
    }
  }
  try {
    await atomicWrite(fs, file, contextCardMarkdown(workbench));
  } catch (error) {
    throw new WorkbenchStoreError("write-failed", describeError(error));
  }
}
function assertWorkbenchId(value) {
  if (!isWorkbenchId(value)) {
    throw new WorkbenchStoreError("id-invalid", typeof value === "string" ? value : "");
  }
  return value;
}
function deletionKey(root, id) {
  return `${root}\0${id}`;
}
function rootFrom(payload) {
  const raw = typeof payload === "object" && payload !== null ? payload["root"] : payload;
  if (typeof raw !== "string" || raw.trim() === "") {
    throw new WorkbenchStoreError("root-unreachable", "\u8BF7\u586B\u5199\u6587\u4EF6\u5939\u8DEF\u5F84");
  }
  return raw.trim();
}
async function assertWritable(fs, root) {
  temporaryCounter += 1;
  const probe = path.join(root, `.workbench-write-probe-${process.pid}-${temporaryCounter}`);
  try {
    await fs.writeFile(probe, "", "utf8");
  } catch (error) {
    throw new WorkbenchStoreError("root-unreachable", describeError(error));
  } finally {
    await fs.rm(probe, { force: true }).catch(() => void 0);
  }
}
function createWorkbenchStore(options) {
  const fs = options.fs ?? nodeFsAdapter;
  const configFile = path.join(options.dshHome, CONFIG_DIR, CONFIG_FILE);
  const adoptedByRoot = /* @__PURE__ */ new Map();
  function adoptedFor(root) {
    let ids = adoptedByRoot.get(root);
    if (ids === void 0) {
      ids = /* @__PURE__ */ new Set();
      adoptedByRoot.set(root, ids);
    }
    return ids;
  }
  const deleting = /* @__PURE__ */ new Set();
  async function getRootConfig() {
    let text;
    try {
      text = await fs.readFile(configFile, "utf8");
    } catch {
      return { root: null };
    }
    try {
      const raw = JSON.parse(text);
      const root = typeof raw === "object" && raw !== null ? raw["root"] : void 0;
      return { root: typeof root === "string" && root.trim() !== "" ? path.resolve(root) : null };
    } catch {
      return { root: null };
    }
  }
  async function setRoot(payload) {
    const root = path.resolve(rootFrom(payload));
    try {
      const stats = await fs.stat(root);
      if (!stats.isDirectory()) throw new Error("\u4E0D\u662F\u6587\u4EF6\u5939");
    } catch (error) {
      throw new WorkbenchStoreError("root-unreachable", `\u8DEF\u5F84\u4E0D\u5B58\u5728\u6216\u4E0D\u662F\u6587\u4EF6\u5939\uFF1A${root}\uFF08${describeError(error)}\uFF09`);
    }
    await assertWritable(fs, root);
    try {
      await atomicWrite(fs, configFile, `${JSON.stringify({ root }, null, 2)}
`);
    } catch (error) {
      throw new WorkbenchStoreError("write-failed", describeError(error));
    }
    return { root };
  }
  async function list(rootInput) {
    const root = path.resolve(rootInput);
    await assertRoot(fs, root);
    const { data: index, created } = await readIndex(fs, root);
    const scanned = await scanWorkbenchIds(fs, root);
    const scannedSet = new Set(scanned);
    const registered = new Set(index.workbenches.map((entry) => entry.id));
    const adopted = adoptedFor(root);
    let nextOrder = index.workbenches.reduce((max, entry) => Math.max(max, entry.order), 0);
    let changed = created;
    for (const id of scanned) {
      if (registered.has(id)) continue;
      nextOrder += 1;
      index.workbenches.push({ id, order: nextOrder });
      adopted.add(id);
      changed = true;
    }
    if (changed) await writeIndex(fs, root, index);
    const ordered = [...index.workbenches].sort(
      (left, right) => left.order - right.order || left.id.localeCompare(right.id)
    );
    const entries = [];
    for (const entry of ordered) {
      if (!scannedSet.has(entry.id)) {
        entries.push({ id: entry.id, name: entry.id, status: "missing", order: entry.order });
        continue;
      }
      const workbench = await readWorkbenchOrNull(
        fs,
        path.join(root, entry.id, `${entry.id}.json`),
        entry.id
      );
      if (workbench === null) {
        entries.push({ id: entry.id, name: entry.id, status: "corrupt", order: entry.order });
        continue;
      }
      await backfillContextCard(fs, root, workbench);
      entries.push({
        id: entry.id,
        name: workbench.name,
        status: adopted.has(entry.id) ? "adopted" : "ok",
        order: entry.order
      });
    }
    return { root, entries };
  }
  async function read(rootInput, idInput) {
    const id = assertWorkbenchId(idInput);
    const root = path.resolve(rootInput);
    await assertRoot(fs, root);
    const file = path.join(root, id, `${id}.json`);
    let text;
    try {
      text = await fs.readFile(file, "utf8");
    } catch (error) {
      if (isNotFound(error)) throw new WorkbenchStoreError("not-found", `\u5DE5\u4F5C\u53F0 ${id}`);
      throw new WorkbenchStoreError("file-corrupt", `\u65E0\u6CD5\u8BFB\u53D6 ${id}/${id}.json\uFF1A${describeError(error)}`);
    }
    if (Buffer.byteLength(text, "utf8") > MAX_FILE_BYTES) {
      throw new WorkbenchStoreError("too-large", `${id}/${id}.json`);
    }
    let workbench;
    try {
      workbench = parseWorkbench(text);
    } catch (error) {
      if (error instanceof WorkbenchStoreError) throw error;
      throw new WorkbenchStoreError("file-corrupt", describeError(error));
    }
    if (workbench.id !== id) throw idMismatchError(id, workbench.id);
    await backfillContextCard(fs, root, workbench);
    adoptedByRoot.get(root)?.delete(id);
    return { workbench };
  }
  async function save(rootInput, payload) {
    const root = path.resolve(rootInput);
    const rawId = typeof payload === "object" && payload !== null ? payload["id"] : void 0;
    const id = assertWorkbenchId(rawId);
    if (deleting.has(deletionKey(root, id))) {
      throw new WorkbenchStoreError("write-failed", `\u5DE5\u4F5C\u53F0 ${id} \u6B63\u5728\u5220\u9664\uFF0C\u5DF2\u62D2\u7EDD\u8FD9\u6B21\u4FDD\u5B58`);
    }
    const workbench = validateWorkbench(payload);
    const text = serializeWorkbench(workbench);
    if (Buffer.byteLength(text, "utf8") > MAX_FILE_BYTES) {
      throw new WorkbenchStoreError("too-large", `${id}/${id}.json`);
    }
    await assertRoot(fs, root);
    try {
      await atomicWrite(fs, path.join(root, id, `${id}.json`), text);
    } catch (error) {
      throw new WorkbenchStoreError("write-failed", describeError(error));
    }
    await ensureContextCard(fs, root, workbench);
    const { data: index } = await readIndex(fs, root);
    if (!index.workbenches.some((entry) => entry.id === id)) {
      const nextOrder = index.workbenches.reduce((max, entry) => Math.max(max, entry.order), 0) + 1;
      index.workbenches.push({ id, order: nextOrder });
      await writeIndex(fs, root, index);
    }
    return { workbench };
  }
  async function deleteWorkbench(rootInput, idInput) {
    const id = assertWorkbenchId(idInput);
    const root = path.resolve(rootInput);
    const tombstone = deletionKey(root, id);
    deleting.add(tombstone);
    try {
      await assertRoot(fs, root);
      const dir = path.join(root, id);
      let exists = false;
      try {
        exists = (await fs.stat(dir)).isDirectory();
      } catch {
        exists = false;
      }
      const { data: index } = await readIndex(fs, root);
      const hadEntry = index.workbenches.some((entry) => entry.id === id);
      if (!exists && !hadEntry) throw new WorkbenchStoreError("not-found", `\u5DE5\u4F5C\u53F0 ${id}`);
      if (exists) {
        try {
          await fs.rm(dir, { recursive: true, force: true });
        } catch (error) {
          throw new WorkbenchStoreError("write-failed", describeError(error));
        }
      }
      if (hadEntry) {
        index.workbenches = index.workbenches.filter((entry) => entry.id !== id);
        await writeIndex(fs, root, index);
      }
      adoptedByRoot.get(root)?.delete(id);
      return { id };
    } finally {
      deleting.delete(tombstone);
    }
  }
  return { getRootConfig, setRoot, list, read, save, delete: deleteWorkbench };
}

// src/host/workbench/rpc.ts
var WORKBENCH_RPC_PATH = "/api/workbench";
function field(payload, key) {
  return typeof payload === "object" && payload !== null ? payload[key] : void 0;
}
function failure(error) {
  if (error instanceof WorkbenchStoreError) {
    return { ok: false, error: { code: error.code, message: error.message, details: {} } };
  }
  return {
    ok: false,
    error: { code: "internal", message: describeError(error), details: {} }
  };
}
function createWorkbenchRpc(options) {
  const store = createWorkbenchStore(options);
  const getDirectoryPicker = options.getDirectoryPicker ?? (() => void 0);
  async function resolveRoot() {
    const config = await store.getRootConfig();
    if (config.root === null) throw new WorkbenchStoreError("root-unset");
    return config.root;
  }
  async function dispatch(request) {
    if (typeof request !== "object" || request === null || typeof request["method"] !== "string") {
      return failure(new WorkbenchStoreError("internal", "RPC \u8BF7\u6C42\u7F3A\u5C11 method"));
    }
    const call = request;
    try {
      switch (call.method) {
        case "getRootConfig":
          return { ok: true, value: await store.getRootConfig() };
        case "setRoot":
          return { ok: true, value: await store.setRoot(call.payload) };
        case "pickRoot":
          return { ok: true, value: await pickRootDirectory(getDirectoryPicker) };
        case "list":
          return { ok: true, value: await store.list(await resolveRoot()) };
        case "read":
          return { ok: true, value: await store.read(await resolveRoot(), field(call.payload, "id")) };
        case "save":
          return { ok: true, value: await store.save(await resolveRoot(), field(call.payload, "workbench")) };
        case "delete":
          return { ok: true, value: await store.delete(await resolveRoot(), field(call.payload, "id")) };
        default:
          return failure(new WorkbenchStoreError("internal", `\u672A\u77E5\u7684 RPC \u65B9\u6CD5\uFF1A${call.method}`));
      }
    } catch (error) {
      return failure(error);
    }
  }
  function invalidRequest(detail) {
    return failure(new WorkbenchStoreError("invalid-request", detail));
  }
  function envelopeInvalidRequest(rpcId, detail) {
    return Response.json(workbenchServerResponse(rpcId, invalidRequest(detail)));
  }
  async function route(request) {
    if (request.method !== "POST") {
      return new Response("method not allowed", { status: 405 });
    }
    let body;
    try {
      body = await request.json();
    } catch {
      return new Response("request body is not JSON", { status: 400 });
    }
    const rpcId = readWorkbenchRpcId(body);
    if (rpcId === null) {
      return new Response("invalid client-request envelope", { status: 400 });
    }
    const envelope = parseWorkbenchClientRequest(body);
    if (envelope === null) {
      return envelopeInvalidRequest(rpcId, "\u8BF7\u6C42\u4E0D\u7B26\u5408\u5916\u58F3 client-request \u4FE1\u5C01\u7EA6\u5B9A");
    }
    if (envelope.method !== WORKBENCH_RPC_ENDPOINT) {
      return envelopeInvalidRequest(
        rpcId,
        `\u672A\u77E5\u7684 RPC \u7AEF\u70B9\uFF1A${envelope.method}\uFF08\u671F\u671B ${WORKBENCH_RPC_ENDPOINT}\uFF09`
      );
    }
    const call = parseWorkbenchCall(envelope.payload);
    if (call === null) {
      return envelopeInvalidRequest(rpcId, "\u8BF7\u6C42\u7F3A\u5C11 workbench \u65B9\u6CD5");
    }
    const result = await dispatch({ method: call.method, payload: call.payload });
    return Response.json(workbenchServerResponse(rpcId, result));
  }
  return { dispatch, route };
}

// src/host/index.ts
var inject = ["connection"];
function lookupDirectoryPicker(ctx) {
  try {
    return ctx.get("directoryPicker");
  } catch {
    return void 0;
  }
}
function apply(ctx) {
  let registered = false;
  const register = () => {
    if (registered) return;
    const registry = ctx.get("connection")?.fetch;
    if (registry === void 0 || typeof registry.register !== "function") return;
    const rpc = createWorkbenchRpc({
      dshHome: resolveDshHome(process.env),
      getDirectoryPicker: () => lookupDirectoryPicker(ctx)
    });
    try {
      const dispose = registry.register({
        path: WORKBENCH_RPC_PATH,
        methods: ["POST"],
        requestBody: "buffered",
        fetch: (request) => rpc.route(request)
      });
      registered = true;
      if (typeof dispose === "function" && typeof ctx.effect === "function") {
        ctx.effect(() => dispose, "dsh-hello-word: workbench RPC route");
      }
    } catch {
    }
  };
  if (typeof ctx.inject === "function") {
    try {
      ctx.inject(["connection"], register);
      return;
    } catch {
    }
  }
  register();
}
export {
  apply,
  inject
};
