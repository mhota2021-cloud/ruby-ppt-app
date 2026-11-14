// public/js/ruby_code_generator.js
// Rubyサーバー上のコード生成・解析APIと通信する薄いクライアント層

window.RubyCodeGenerator = (function() {

  function buildPayload(canvasInstance) {
    const rawShapes = canvasInstance.shapes || [];
    const ordered = (typeof PPTCanvas !== "undefined" && typeof PPTCanvas.getRenderOrderedShapes === "function")
      ? PPTCanvas.getRenderOrderedShapes(rawShapes)
      : rawShapes;
    const visibleShapes = ordered.filter(s => (
      typeof canvasInstance.isEffectivelyVisible === "function"
        ? canvasInstance.isEffectivelyVisible(s)
        : (s && s.visible !== false)
    ));
    return {
      width: canvasInstance.width,
      height: canvasInstance.height,
      backgroundColor: canvasInstance.backgroundColor || "#ffffff",
      shapes: visibleShapes.map(s => ({ ...s }))
    };
  }

  // サーバーが無いときはRubyBackendがruby.wasmで同じRuby処理を動かす
  function post(path, body) {
    if (window.RubyBackend) return window.RubyBackend.request("POST", path, body);
    return fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body });
  }

  async function generateViaServer(canvasInstance, options = {}) {
    const res = await post("/api/export/ruby", JSON.stringify({
      project: buildPayload(canvasInstance),
      cropToShapes: !!options.cropToShapes,
      filename: options.filename,
      save: options.save !== false
    }));
    if (!res.ok) {
      const msg = window.I18N ? window.I18N.t("msg.serverGenFail", { status: res.status }) : `Rubyサーバーでのコード生成に失敗した (HTTP ${res.status})`;
      throw new Error(msg);
    }
    return await res.text();
  }

  async function parseViaServer(codeText) {
    const res = await post("/api/import/ruby", JSON.stringify({ code: codeText }));
    const data = await res.json();
    if (!res.ok || !data.success) {
      const msg = window.I18N ? window.I18N.t("msg.serverParseFail", { status: res.status }) : `Rubyコードの解析に失敗した (HTTP ${res.status})`;
      throw new Error(data.error || msg);
    }
    return data.shapes || [];
  }

  return {
    generateViaServer,
    parseViaServer
  };
})();
