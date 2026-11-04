/**
 * The Host half runs in Node (cordis plugin, esbuild target node20) and the
 * data layer is exercised by vitest in Node. The root tsconfig keeps
 * `types: []` so the Client half cannot accidentally reach Node globals; this
 * one reference scopes the Node declarations to the programs that include it.
 */
/// <reference types="node" />
