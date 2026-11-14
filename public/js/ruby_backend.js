// public/js/ruby_backend.js
// Ruby処理（コード生成・解析・数式）の呼び出し先を決める層。
// Rubyサーバーがあればfetchで呼び、無ければ（GitHub Pagesなど）ruby.wasmでlib/*.rbをブラウザ内で動かす。

window.RubyBackend = (function() {
  const WASM_VERSION = "2.10.1";
  const WASM_JS_URL = `https://cdn.jsdelivr.net/npm/@ruby/wasm-wasi@${WASM_VERSION}/dist/browser/+esm`;
  const WASM_BINARY_URL = `https://cdn.jsdelivr.net/npm/@ruby/3.4-wasm-wasi@${WASM_VERSION}/dist/ruby+stdlib.wasm`;
  // 依存される順に並べる（require_relativeはブラウザ内では読み飛ばす）
  const LIB_FILES = [
    "font_5x7.rb",
    "shape_geometry.rb",
    "math_formula.rb",
    "ruby_code_generator.rb",
    "ruby_code_parser.rb",
    "api_core.rb"
  ];
  const LIB_BASE = "ruby/lib/";

  let serverPromise = null;
  let dispatchPromise = null;

  function hasServer() {
    if (!serverPromise) {
      serverPromise = fetch("/api/sync/status", { cache: "no-store" })
        .then(res => res.ok)
        .catch(() => false);
    }
    return serverPromise;
  }

  function t(key, fallback) {
    return window.I18N ? window.I18N.t(key) : fallback;
  }

  function showLoading() {
    if (typeof document === "undefined" || !document.body) return () => {};
    const el = document.createElement("div");
    el.className = "ruby-loading";
    el.setAttribute("role", "status");
    el.textContent = t("ruby.loading", "Ruby実行環境を読み込み中…（初回のみ約30MB）");
    document.body.appendChild(el);
    return () => el.remove();
  }

  async function loadDispatch() {
    const hide = showLoading();
    try {
      const { DefaultRubyVM } = await import(WASM_JS_URL);
      const wasmModule = await WebAssembly.compileStreaming(fetch(WASM_BINARY_URL));
      const { vm } = await DefaultRubyVM(wasmModule, { consolePrint: false });
      vm.eval([
        'require "json"',
        "module Kernel",
        "  private def require_relative(_path) = true",
        "end"
      ].join("\n"));
      for (const file of LIB_FILES) {
        const res = await fetch(LIB_BASE + file, { cache: "no-cache" });
        if (!res.ok) throw new Error(`${file}: HTTP ${res.status}`);
        vm.eval(await res.text());
      }
      const fn = vm.eval(
        "->(method, path, body) { PPTApp::ApiCore.dispatch(method.to_s, path.to_s, body.to_s).to_json }"
      );
      return (...args) => fn.call("call", ...args.map(a => vm.wrap(String(a)))).toString();
    } finally {
      hide();
    }
  }

  function makeResponse(status, contentType, body) {
    return {
      ok: status >= 200 && status < 300,
      status,
      headers: { get: name => (String(name).toLowerCase() === "content-type" ? contentType : null) },
      text: async () => body,
      json: async () => JSON.parse(body)
    };
  }

  async function requestViaWasm(method, path, body) {
    if (!dispatchPromise) {
      dispatchPromise = loadDispatch().catch(e => {
        dispatchPromise = null;
        throw e;
      });
    }
    const dispatch = await dispatchPromise;
    const [status, contentType, responseBody] = JSON.parse(dispatch(method, path, body || ""));
    return makeResponse(status, contentType, responseBody);
  }

  // fetchと同じ形の応答を返す。bodyはJSON文字列
  async function request(method, path, body) {
    if (await hasServer()) {
      const init = method === "GET"
        ? {}
        : { method, headers: { "Content-Type": "application/json" }, body };
      return fetch(path, init);
    }
    return requestViaWasm(method, path, body);
  }

  return {
    hasServer,
    request
  };
})();
