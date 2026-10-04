# Chrome Dev 157 — Experimental Flags (Browser Intelligence Stack)

> **Verified live 2026-10-04** on Chrome Dev `157.0.8081.0` (debug port 9222).
> All 20 flags below are **enabled and persisted** in `Local State` →
> `browser.enabled_labs_experiments`. Hardware: NVIDIA RTX 5090 (24 GB VRAM),
> 63.4 GB RAM, 24 logical cores.

The goal of this stack is to turn the browser into a **local AI + GPU compute
runtime**: an on-device LLM (Gemma 4), neural-network inference (WebNN), raw GPU
access (WebGPU), and a fast WebAssembly JIT — all callable from any web page with
zero server round-trip. This is the "browser intelligence" layer that lets Mavis
run models, summarize, rewrite, and compute **inside the browser** instead of
shelling out to a CLI.

---

## 1. Built-in AI — on-device LLM (Gemma 4)

### 1.1 `gemma4-for-built-in-ai` — the on-device model
**What it does:** Downloads and enables the **Gemma 4** model as Chrome's
built-in AI foundation model. Without this flag, none of the Prompt/Summarizer/
Writer/Rewriter APIs have a model to run against.

**Code example (availability check):**
```js
const status = await LanguageModel.availability();
console.log(status); // "available" | "downloadable" | "downloading" | "unavailable"
```

**The plus:** This is the single most important flag — it is the *engine*.
Everything else in section 1 is an API surface on top of this model. First run
downloads ~22 GB of weights; after that, inference is fully local and private.

---

### 1.2 `prompt-api` — the Prompt API (LanguageModel)
**What it does:** Exposes `LanguageModel` so any web page can prompt an on-device
LLM. Set to **Enabled Multilingual** (supports non-English prompts).

**Code example:**
```js
const session = await LanguageModel.create({
  systemPrompt: "You are Mavis, a precise engineering assistant.",
  temperature: 0.2,
  topK: 40,
});
const stream = session.promptStreaming("Explain WebGPU in 3 bullets.");
for await (const chunk of stream) console.log(chunk);
```

**The plus:** A private, offline LLM callable from any page — no API key, no
network, no token cost. This is the foundation for in-browser agents.

---

### 1.3 `prompt-api-multimodal-input` — image + audio input
**What it does:** Extends the Prompt API with image and audio input types, so the
model can reason over visual/auditory data.

**Code example:**
```js
const session = await LanguageModel.create();
const image = { type: "image/png", data: await readFileAsBase64("shot.png") };
const result = await session.prompt([
  { role: "user", content: "Describe this UI.", images: [image] },
]);
```

**The plus:** Lets Mavis *see* screenshots and *hear* audio directly in the
browser — the basis for visual UI review without an external vision model.

---

### 1.4 `prompt-api-tool-use` — function calling
**What it does:** Enables **tool use / function calling** in the Prompt API — the
model can emit structured calls to your own functions.

**Code example:**
```js
const session = await LanguageModel.create({
  tools: [{
    type: "function",
    name: "run_shell",
    description: "Run a shell command",
    parameters: { type: "object", properties: { cmd: { type: "string" } } },
  }],
});
const result = await session.prompt("List files in /tmp");
console.log(result.toolCalls); // [{ name: "run_shell", args: { cmd: "ls /tmp" } }]
```

**The plus:** This is what makes the browser LLM an *agent* — it can decide to
call tools (shell, filesystem, browser) instead of only returning text.

---

### 1.5 `prompt-api-sampling-mode` — sampling control
**What it does:** Enables fine-grained sampling controls (temperature, top-k,
top-p, repetition penalty) on the Prompt API.

**Code example:**
```js
const session = await LanguageModel.create({
  temperature: 0.1,   // deterministic
  topK: 1,            // greedy
  topP: 0.9,
});
```

**The plus:** Deterministic output when we need it (code generation, structured
JSON) vs. creative output when we don't — full control over the model's behavior.

---

### 1.6 `summarizer-api` — Summarizer API
**What it does:** Exposes `Summarizer` for one-shot text summarization. Set to
**Enabled Multilingual**.

**Code example:**
```js
const summarizer = await Summarizer.create({
  type: "tl;dr",
  format: "markdown",
  length: "medium",
});
const summary = await summarizer.summarize(longDocumentText);
```

**The plus:** Instant local summarization of docs, PRs, and logs — no external
API. Mavis can digest a 50-page spec into a paragraph offline.

---

### 1.7 `writer-api` — Writer API
**What it does:** Exposes `Writer` for drafting text with a built-in LLM. Set to
**Enabled Multilingual**.

**Code example:**
```js
const writer = await Writer.create({ tone: "formal", length: "short" });
const draft = await writer.write("Write a commit message for a flag-doc update.");
```

**The plus:** Local drafting of commit messages, docs, and release notes with a
consistent tone — no round-trip to a cloud model.

---

### 1.8 `rewriter-api` — Rewriter API
**What it does:** Exposes `Rewriter` for rewriting existing text (tone, length,
style). Set to **Enabled Multilingual**.

**Code example:**
```js
const rewriter = await Rewriter.create({ tone: "more-formal" });
const rewritten = await rewriter.rewrite("this is kinda messy tbh");
```

**The plus:** On-device copy editing — tighten, formalize, or simplify text
without leaving the browser.

---

### 1.9 `on-device-model-speculative-decoding` — faster inference
**What it does:** Enables **speculative decoding** — a small draft model proposes
tokens that the main model verifies in parallel, speeding up generation.

**The plus:** Lower latency and higher throughput for every API above, at no
accuracy cost. Critical for interactive agent loops.

---

### 1.10 `semantic-embedder-api` — embeddings
**What it does:** Exposes `SemanticEmbedder` for on-device text embeddings
(vector representations for similarity search / RAG).

**Code example:**
```js
const embedder = await SemanticEmbedder.create();
const vec = await embedder.embed("What is WebGPU?");
// vec is a Float32Array usable for cosine-similarity search
```

**The plus:** Local vector search / RAG over the user's own docs — the retrieval
half of a fully in-browser agent memory.

---

## 2. WebGPU — raw GPU compute

### 2.1 `enable-unsafe-webgpu` — unsafe/experimental GPU features
**What it does:** Unlocks experimental WebGPU features (e.g. `chromium-experimental-*`
extensions, more shader capabilities) that are gated behind "unsafe" for stability.

**Code example:**
```js
const adapter = await navigator.gpu.requestAdapter();
const device = await adapter.requestDevice({
  requiredFeatures: ["chromium-experimental-dp4a"], // only with this flag
});
```

**The plus:** Access to the RTX 5090's full shader feature set (DP4a, subgroup
ops, etc.) for maximum GPU throughput on ML and compute workloads.

---

### 2.2 `enable-webgpu-developer-features` — debugging
**What it does:** Enables developer-oriented WebGPU features (validation layers,
error messages, `pushErrorScope`).

**Code example:**
```js
device.pushErrorScope("validation");
// ... run a shader ...
const err = await device.popErrorScope();
if (err) console.error(err.message);
```

**The plus:** Real error messages instead of silent GPU failures — essential for
debugging shaders and compute kernels during development.

---

## 3. WebNN — neural-network inference

### 3.1 `experimental-web-machine-learning-neural-network` — WebNN API
**What it does:** Exposes the **WebNN** API — build and run neural-network graphs
directly on the GPU/NPU via `navigator.ml`.

**Code example:**
```js
const context = await navigator.ml.createContext();
const builder = new MLGraphBuilder(context);
const input = builder.input("input", { dataType: "float32", dimensions: [1, 784] });
const output = builder.gemm(input, weights, { c: bias });
const graph = await builder.build({ output });
const result = await context.compute(graph, { input: tensor });
```

**The plus:** Hardware-accelerated inference (GPU/NPU) for custom models without
WebGPU shader code — a higher-level, faster path for ML in the browser.

---

### 3.2 `webnn-onnxruntime` — ONNX Runtime backend
**What it does:** Enables the **ONNX Runtime Web** backend for WebNN, so `.onnx`
models run through WebNN's hardware acceleration.

**Code example:**
```js
import * as ort from "onnxruntime-web/webgpu";
const session = await ort.InferenceSession.create("model.onnx", {
  executionProviders: ["webnn"], // hardware-accelerated via WebNN
});
const results = await session.run({ input: tensor });
```

**The plus:** Run the entire ONNX model zoo (thousands of pre-trained models) at
native speed in the browser — no conversion, no server.

---

## 4. WebAssembly — fast JIT

### 4.1 `enable-experimental-webassembly-features` — new WASM features
**What it does:** Enables experimental WebAssembly proposals (SIMD extensions,
relaxed SIMD, etc.) ahead of standardization.

**The plus:** Access to the newest WASM instructions for faster numeric/vector
code — the same features v86 and other emulators use for speed.

---

### 4.2 `enable-experimental-webassembly-shared-everything` — shared-everything threads
**What it does:** Enables the **shared-everything threads** proposal — WASM modules
can share memory and use real threads (not just workers).

**Code example:**
```js
const { instance } = await WebAssembly.instantiateStreaming(fetch("threads.wasm"));
// module can spawn threads sharing one linear memory
```

**The plus:** True multi-threaded WASM on the 24-core CPU — parallel compute in
the browser, unlocking heavy workloads (emulation, encoding, ML).

---

### 4.3 `enable-experimental-webassembly-stack-switching` — async/continuations
**What it does:** Enables the **stack-switching** proposal — WASM functions can
suspend/resume, enabling async/await and generators inside WASM.

**The plus:** Non-blocking WASM that can yield to the event loop — long-running
compute no longer freezes the page.

---

### 4.4 `enable-webassembly-baseline` — baseline compiler
**What it does:** Enables the **Liftoff** baseline compiler — compiles WASM to
machine code quickly (lower startup latency, less optimization).

**The plus:** Near-instant WASM startup — critical for large modules (v86, ONNX
runtime) that would otherwise stall on first load.

---

### 4.5 `enable-webassembly-lazy-compilation` — lazy compilation
**What it does:** Compiles WASM functions **on first use** instead of eagerly at
load time.

**The plus:** Faster page load and lower memory for large WASM binaries — only
the code paths actually executed get compiled.

---

### 4.6 `enable-webassembly-tiering` — tiered compilation
**What it does:** Enables **tiering** — hot functions get recompiled by the
optimizing compiler (TurboFan) after the baseline compiler warms them up.

**The plus:** Best of both worlds: fast startup (baseline) + peak performance
(optimizing) for long-running WASM workloads.

---

## 5. Web platform

### 5.1 `enable-experimental-web-platform-features` — experimental web APIs
**What it does:** Enables experimental Web Platform features in development
(new APIs, CSS, and platform capabilities not yet standardized).

**The plus:** Early access to the newest browser capabilities — lets Mavis use
cutting-edge APIs before they ship to stable.

---

## Summary table

| # | Flag | Category | Benefit |
|---|------|----------|---------|
| 1 | `gemma4-for-built-in-ai` | Built-in AI | On-device LLM engine |
| 2 | `prompt-api` | Built-in AI | Prompt an LLM from any page |
| 3 | `prompt-api-multimodal-input` | Built-in AI | Image + audio input |
| 4 | `prompt-api-tool-use` | Built-in AI | Function calling (agent) |
| 5 | `prompt-api-sampling-mode` | Built-in AI | Temperature/top-k control |
| 6 | `summarizer-api` | Built-in AI | Local summarization |
| 7 | `writer-api` | Built-in AI | Local drafting |
| 8 | `rewriter-api` | Built-in AI | Local rewriting |
| 9 | `on-device-model-speculative-decoding` | Built-in AI | Faster inference |
| 10 | `semantic-embedder-api` | Built-in AI | Local embeddings / RAG |
| 11 | `enable-unsafe-webgpu` | WebGPU | Full GPU feature set |
| 12 | `enable-webgpu-developer-features` | WebGPU | GPU debugging |
| 13 | `experimental-web-machine-learning-neural-network` | WebNN | Hardware NN inference |
| 14 | `webnn-onnxruntime` | WebNN | ONNX models at native speed |
| 15 | `enable-experimental-webassembly-features` | WASM | Newest WASM instructions |
| 16 | `enable-experimental-webassembly-shared-everything` | WASM | Real threads |
| 17 | `enable-experimental-webassembly-stack-switching` | WASM | Async/continuations |
| 18 | `enable-webassembly-baseline` | WASM | Fast startup |
| 19 | `enable-webassembly-lazy-compilation` | WASM | Lazy compile |
| 20 | `enable-webassembly-tiering` | WASM | Tiered optimization |
| 21 | `enable-experimental-web-platform-features` | Platform | Newest web APIs |

---

## How to apply (reproducible)

```powershell
# 1. Launch Chrome Dev with a debug port
& "C:\Program Files\Google\Chrome Dev\Application\chrome.exe" `
  --no-default-browser-check --no-first-run `
  --remote-debugging-address=127.0.0.1 --remote-debugging-port=9222 `
  --user-data-dir="C:\Users\fvegi\.agent-browsers\chrome-dev-debug"

# 2. Open chrome://flags, then run the setter (sets all 12 non-default flags)
node scripts/set-flags.js

# 3. Relaunch Chrome Dev to apply (flags persist in Local State)
```

The flags are stored in:
`C:\Users\fvegi\.agent-browsers\chrome-dev-debug\Local State` →
`browser.enabled_labs_experiments`.
