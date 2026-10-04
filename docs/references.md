# 25 References — Why Top Devs Use This Browser Intelligence Stack

> Curated 2026-10-04. Each entry is a primary source (spec, official doc, or the
> canonical repo) plus the reason top developers adopt it. Grouped by the same
> five layers as `chrome-flags.md`.

---

## Built-in AI (on-device LLM)

1. **Chrome Built-in AI — official docs**
   https://developer.chrome.com/docs/ai/built-in
   *Google Chrome team.* The canonical entry point. Top devs use it because it
   runs an LLM **fully on-device** — no server, no API key, no data leaving the
   machine. Privacy + zero marginal cost is the headline reason.

2. **Prompt API (LanguageModel)**
   https://developer.chrome.com/docs/ai/built-in-apis
   *Google Chrome team.* The `LanguageModel` interface. Devs adopt it to embed an
   LLM directly into a web app with a single `create()` call — no SDK, no backend.

3. **Summarizer API**
   https://developer.chrome.com/docs/ai/summarizer-api
   *Google Chrome team.* One-shot summarization. Used for digesting long docs,
   PRs, and logs locally — the "tl;dr" primitive for agent tooling.

4. **Writer API**
   https://developer.chrome.com/docs/ai/writer-api
   *Google Chrome team.* Drafting with a consistent tone. Devs use it for commit
   messages, release notes, and docs without a cloud round-trip.

5. **Rewriter API**
   https://developer.chrome.com/docs/ai/rewriter-api
   *Google Chrome team.* Tone/length/style rewriting. The on-device copy-editor.

6. **Translator API**
   https://developer.chrome.com/docs/ai/translator-api
   *Google Chrome team.* Local translation. Adopted for i18n without sending
   user text to a third-party translation service.

7. **Language Detector API**
   https://developer.chrome.com/docs/ai/language-detection
   *Google Chrome team.* Local language identification — the routing primitive
   before translation or summarization.

8. **Gemma 4 (the on-device model)**
   https://ai.google.dev/gemma
   *Google DeepMind.* The open model behind `gemma4-for-built-in-ai`. Top devs
   choose Gemma because it is open-weight, runs on consumer GPUs, and is the
   default foundation model for Chrome's built-in AI.

9. **Chrome built-in AI — explainer & samples**
   https://github.com/explainers-by-googlers/prompt-api
   *Google explainers.* The design rationale and sample code. Devs read this to
   understand *why* the API is shaped the way it is before building on it.

10. **On-device AI in the browser (Chrome Developers blog)**
    https://developer.chrome.com/blog/august2024-summary
    *Chrome team.* The rollout narrative for built-in AI. The "why now" — local
    models finally fit in a browser tab.

---

## WebGPU (raw GPU compute)

11. **WebGPU — W3C specification**
    https://www.w3.org/TR/webgpu/
    *W3C GPU for the Web WG.* The standard. Top devs use WebGPU because it is the
    first browser API with **direct, low-overhead GPU access** — compute shaders,
    storage buffers, and zero driver indirection.

12. **WebGPU — MDN**
    https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API
    *MDN.* The practical reference. Adopted for ML inference, image processing,
    and physics in the browser at near-native speed.

13. **WebGPU compute shaders (Google Codelab)**
    https://codelabs.developers.google.com/your-first-webgpu-app
    *Google.* The canonical "your first WebGPU app". Devs start here to run
    parallel compute on the GPU from JavaScript.

14. **WebGPU — "From 0 to glTF" (Google Chrome team)**
    https://developer.chrome.com/blog/from-webgl-to-webgpu
    *Chrome team.* The WebGL→WebGPU migration story. The reason to switch:
    WebGPU exposes the modern GPU feature set (compute, storage buffers) that
    WebGL never could.

---

## WebNN (neural-network inference)

15. **WebNN — W3C specification**
    https://www.w3.org/TR/webnn/
    *W3C Web Machine Learning WG.* The standard for hardware-accelerated NN
    inference. Top devs use WebNN because it targets the **NPU/GPU directly** —
    faster and more power-efficient than WebGPU for inference.

16. **WebNN — MDN**
    https://developer.mozilla.org/en-US/docs/Web/API/WebNN_API
    *MDN.* The practical reference for `navigator.ml` and `MLGraphBuilder`.

17. **ONNX Runtime Web**
    https://onnxruntime.ai/docs/tutorials/web/
    *Microsoft.* The runtime that runs `.onnx` models in the browser. Devs use it
    because the ONNX ecosystem has **thousands of pre-trained models** — drop one
    in and run it at native speed via WebGPU/WebNN.

18. **WebNN explainer**
    https://github.com/webmachinelearning/webnn
    *Web Machine Learning Community Group.* The design rationale. The "why": a
    dedicated inference API beats hand-writing WebGPU shaders for every model.

---

## WebAssembly (fast JIT)

19. **WebAssembly — official site**
    https://webassembly.org/
    *W3C WebAssembly CG.* The home of the spec. Top devs use WASM for
    **near-native performance** of compiled C/C++/Rust in the browser.

20. **WebAssembly — MDN**
    https://developer.mozilla.org/en-US/docs/WebAssembly
    *MDN.* The practical reference for `WebAssembly.instantiateStreaming` and the
    JS/WASM interop surface.

21. **v86 — x86 emulator in WebAssembly**
    https://github.com/copy/v86
    *Fabian Hemmer.* The proof that WASM can run a **full x86 OS in the browser**.
    Devs cite it as the canonical example of WASM's raw compute ceiling.

22. **WebAssembly threads (shared-everything) proposal**
    https://github.com/WebAssembly/shared-everything-threads
    *WebAssembly CG.* The proposal behind `enable-experimental-webassembly-shared-everything`.
    The "why": real shared-memory threads unlock parallel compute on multi-core CPUs.

23. **WebAssembly stack-switching proposal**
    https://github.com/WebAssembly/stack-switching
    *WebAssembly CG.* The proposal behind `enable-experimental-webassembly-stack-switching`.
    The "why": async/await and generators inside WASM, so long compute no longer blocks the page.

---

## Web platform + tooling

24. **Chrome DevTools Protocol (CDP)**
    https://chromedevtools.github.io/devtools-protocol/
    *Google.* The protocol used to drive Chrome programmatically (the `set-flags.js`
    and `cdp-eval.js` scripts in this repo). Top devs use CDP to automate the
    browser end-to-end — the same mechanism Playwright and Puppeteer build on.

25. **linuxserver/webtop — full Linux desktop in the browser**
    https://github.com/linuxserver/docker-webtop
    *linuxserver.io.* The container that serves a full Ubuntu+Xfce desktop over
    the web (Selkies). Devs use it to get a **complete Linux GUI in a browser tab**
    — the "one place" consolidation layer this repo documents.
