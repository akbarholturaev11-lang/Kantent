import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { ESLint } from "eslint";

// Real ReferenceErrors this scan caught: mcp-server.mjs called narrationHash()
// without importing it (V8-02), and render-episode.mjs (f15725b8) kept calling
// buildCaptionSections() after its import was replaced, so every lesson render
// crashed writing SRT AFTER the MP4s were already rendered from paid voice.
const nodeGlobals = Object.fromEntries([
  "process", "console", "Buffer", "URL", "URLSearchParams", "fetch", "Response", "Request",
  "Headers", "AbortSignal", "AbortController", "setTimeout", "clearTimeout", "setInterval",
  "clearInterval", "setImmediate", "structuredClone", "TextEncoder", "TextDecoder", "queueMicrotask",
  "FormData", "Blob", "performance", "crypto", "atob", "btoa",
].map((name) => [name, "readonly"]));

test("every production script only uses defined identifiers", async () => {
  const eslint = new ESLint({
    cwd: fileURLToPath(new URL("..", import.meta.url)),
    overrideConfigFile: true,
    overrideConfig: [{
      files: ["scripts/**/*.mjs"],
      languageOptions: { ecmaVersion: 2025, sourceType: "module", globals: nodeGlobals },
      rules: { "no-undef": "error" },
    }],
  });
  const results = await eslint.lintFiles(["scripts/*.mjs"]);
  const problems = results.flatMap((result) => result.messages.map((message) =>
    `${result.filePath.split("/scripts/")[1]}:${message.line} ${message.message}`));
  assert.ok(results.length > 50, "the scan covers the scripts directory");
  assert.deepEqual(problems, []);
});
