// public/js/exporter.js
// SVGおよびPPM（P6 / P3）のエクスポート処理

window.PPTExporter = (function() {

  function escapeXml(unsafe) {
    return String(unsafe ?? "").replace(/[<>&'"]/g, c => {
      switch (c) {
        case "<": return "&lt;";
        case ">": return "&gt;";
        case "&": return "&amp;";
        case "'": return "&apos;";
        case '"': return "&quot;";
      }
    });
  }

  // 親を含めて表示状態の描画順リストを取得
  function getVisibleOrderedShapes(canvasInstance) {
    const raw = (canvasInstance && Array.isArray(canvasInstance.shapes)) ? canvasInstance.shapes : [];
    const ordered = (typeof PPTCanvas !== "undefined" && typeof PPTCanvas.getRenderOrderedShapes === "function")
      ? PPTCanvas.getRenderOrderedShapes(raw)
      : raw;
    if (canvasInstance && typeof canvasInstance.isEffectivelyVisible === "function") {
      return ordered.filter(s => canvasInstance.isEffectivelyVisible(s));
    }
    return ordered.filter(s => s && s.visible !== false);
  }

  // 図形一覧の外接矩形(バウンディングボックス)を計算
  function getShapesBoundingBox(shapes, margin = 10) {
    const visibleShapes = (shapes || []).filter(s => s && s.visible !== false);
    if (visibleShapes.length === 0) {
      return { x: 0, y: 0, width: 400, height: 400 };
    }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    visibleShapes.forEach(s => {
      const cx = s.x + s.width / 2;
      const cy = s.y + s.height / 2;
      const rot = (s.rotation || 0) * Math.PI / 180;
      const cos = Math.abs(Math.cos(rot));
      const sin = Math.abs(Math.sin(rot));

      const hw = (s.width / 2) * cos + (s.height / 2) * sin;
      const hh = (s.width / 2) * sin + (s.height / 2) * cos;

      minX = Math.min(minX, cx - hw);
      minY = Math.min(minY, cy - hh);
      maxX = Math.max(maxX, cx + hw);
      maxY = Math.max(maxY, cy + hh);
    });

    const x = Math.max(0, Math.floor(minX - margin));
    const y = Math.max(0, Math.floor(minY - margin));
    const width = Math.max(10, Math.ceil(maxX - minX + margin * 2));
    const height = Math.max(10, Math.ceil(maxY - minY + margin * 2));

    return { x, y, width, height };
  }

  // --- 1. SVG生成 ---
  function buildSvgString(canvasInstance, options = {}) {
    let width = canvasInstance.width;
    let height = canvasInstance.height;
    let bg = canvasInstance.backgroundColor || "#ffffff";
    let offsetX = 0;
    let offsetY = 0;

    const visibleShapes = getVisibleOrderedShapes(canvasInstance);

    if (options.cropToShapes) {
      const bbox = getShapesBoundingBox(visibleShapes, 10);
      width = bbox.width;
      height = bbox.height;
      offsetX = bbox.x;
      offsetY = bbox.y;
    }

    let svg = [];
    svg.push(`<?xml version="1.0" encoding="UTF-8"?>`);
    svg.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">`);
    svg.push(`  <defs>`);
    svg.push(`    <style>`);
    svg.push(`      .warped-text text { font-smooth: always; }`);
    svg.push(`    </style>`);
    visibleShapes.forEach(s => {
      if (s.type === "frame" && s.clipContent && s.id) {
        const fx = s.x - offsetX;
        const fy = s.y - offsetY;
        const rx = Math.min(Math.max(0, Number(s.cornerRadius) || 0), s.width / 2, s.height / 2);
        const tAttr = buildTransformAttr({ ...s, x: fx, y: fy });
        svg.push(`    <clipPath id="clip_${escapeXml(s.id)}"><rect x="${fx}" y="${fy}" width="${s.width}" height="${s.height}" rx="${rx}" ry="${rx}" ${tAttr}/></clipPath>`);
      }
    });
    svg.push(`  </defs>`);

    if (!options.cropToShapes && bg !== "transparent" && bg !== "none") {
      svg.push(`  <rect width="100%" height="100%" fill="${escapeXml(bg)}"/>`);
    }

    const byId = new Map();
    visibleShapes.forEach(s => {
      if (s.id) byId.set(s.id, s);
    });
    const hasAncestor = (shape, pid) => {
      let cur = shape;
      const seen = new Set();
      while (cur && cur.parentId && !seen.has(cur.parentId)) {
        if (cur.parentId === pid) return true;
        seen.add(cur.parentId);
        cur = byId.get(cur.parentId);
      }
      return false;
    };

    const clipStack = [];
    const closeFinishedClips = (nextShape) => {
      while (clipStack.length > 0) {
        const topId = clipStack[clipStack.length - 1];
        if (nextShape && hasAncestor(nextShape, topId)) break;
        svg.push(`  </g>`);
        clipStack.pop();
      }
    };

    visibleShapes.forEach(s => {
      closeFinishedClips(s);
      const cloned = { ...s, x: s.x - offsetX, y: s.y - offsetY };
      const piece = shapeToSvg(cloned);
      if (piece) svg.push(piece);
      if (s.type === "frame" && s.clipContent && s.id) {
        svg.push(`  <g clip-path="url(#clip_${escapeXml(s.id)})">`);
        clipStack.push(s.id);
      }
    });
    closeFinishedClips(null);

    svg.push(`</svg>`);
    return svg.join("\n");
  }

  function buildTransformAttr(s) {
    const cx = s.x + s.width / 2;
    const cy = s.y + s.height / 2;

    const transform = [`translate(${cx}, ${cy})`];
    if (s.rotation) transform.push(`rotate(${s.rotation})`);
    const sx = s.flipH ? -1 : 1;
    const sy = s.flipV ? -1 : 1;
    if (sx !== 1 || sy !== 1) transform.push(`scale(${sx}, ${sy})`);
    if (s.shearX || s.shearY) {
      const tanX = Math.tan((s.shearX || 0) * Math.PI / 180);
      const tanY = Math.tan((s.shearY || 0) * Math.PI / 180);
      transform.push(`matrix(1, ${tanY}, ${tanX}, 1, 0, 0)`);
    }
    transform.push(`translate(${-cx}, ${-cy})`);

    return `transform="${transform.join(' ')}"`;
  }

  function shapeToSvg(s) {
    const cx = s.x + s.width / 2;
    const cy = s.y + s.height / 2;
    const tAttr = buildTransformAttr(s);

    if (s.type === "text") {
      const textGroup = TextWarpRenderer.generateSvgWarpText(s);
      return `  <g ${tAttr} transform-origin="${cx} ${cy}">\n    <g transform="translate(${s.x}, ${s.y})">\n      ${textGroup}\n    </g>\n  </g>`;
    }

    if (s.type === "frame") {
      const hasFill = s.fill && s.fill !== "none" && s.fill !== "transparent" && (s.fillOpacity ?? 1) > 0;
      const hasStroke = s.strokeWidth > 0 && s.stroke && s.stroke !== "none" && s.stroke !== "transparent";
      if (!hasFill && !hasStroke) return "";
      const fillAttr = hasFill ? escapeXml(s.fill) : "none";
      const fillOpAttr = hasFill ? (s.fillOpacity ?? 1.0) : 0;
      const strokeAttr = hasStroke ? escapeXml(s.stroke) : "none";
      const swAttr = hasStroke ? s.strokeWidth : 0;
      const rx = Math.max(0, Number(s.cornerRadius) || 0);
      let dashAttr = "";
      if (s.strokeDash === "dashed") dashAttr = ` stroke-dasharray="8 5"`;
      else if (s.strokeDash === "dotted") dashAttr = ` stroke-dasharray="3 3"`;
      return `  <g ${tAttr}>\n    <rect x="${s.x}" y="${s.y}" width="${s.width}" height="${s.height}" rx="${rx}" ry="${rx}" fill="${fillAttr}" fill-opacity="${fillOpAttr}" stroke="${strokeAttr}" stroke-width="${swAttr}"${dashAttr}/>\n  </g>`;
    }

    if (s.type === "math_plot") {
      const cfg = s.mathConfig || {};
      const data = s.mathData || {};
      const parts = [];
      if (s.fill && s.fill !== "none" && s.fill !== "transparent" && (s.fillOpacity ?? 0) > 0) {
        parts.push(`    <rect x="${s.x}" y="${s.y}" width="${s.width}" height="${s.height}" fill="${escapeXml(s.fill)}" fill-opacity="${s.fillOpacity ?? 1}"/>`);
      }
      if (s.strokeWidth > 0 && s.stroke && s.stroke !== "none" && s.stroke !== "transparent") {
        parts.push(`    <rect x="${s.x}" y="${s.y}" width="${s.width}" height="${s.height}" fill="none" stroke="${escapeXml(s.stroke)}" stroke-width="${s.strokeWidth}"/>`);
      } else if (cfg.showFrame === true) {
        parts.push(`    <rect x="${s.x}" y="${s.y}" width="${s.width}" height="${s.height}" fill="none" stroke="#94a3b8" stroke-opacity="0.45" stroke-width="1"/>`);
      }
      if (cfg.showAxes === true) {
        if (typeof data.axisXRatio === "number" && data.axisXRatio >= 0 && data.axisXRatio <= 1) {
          const ax = (s.x + data.axisXRatio * s.width).toFixed(2);
          parts.push(`    <line x1="${ax}" y1="${s.y}" x2="${ax}" y2="${s.y + s.height}" stroke="#94a3b8" stroke-width="1"/>`);
        }
        if (typeof data.axisYRatio === "number" && data.axisYRatio >= 0 && data.axisYRatio <= 1) {
          const ay = (s.y + data.axisYRatio * s.height).toFixed(2);
          parts.push(`    <line x1="${s.x}" y1="${ay}" x2="${s.x + s.width}" y2="${ay}" stroke="#94a3b8" stroke-width="1"/>`);
        }
      }
      if (Array.isArray(data.segments)) {
        const strokeColor = cfg.lineColor || (s.stroke && s.stroke !== "none" && s.stroke !== "transparent" ? s.stroke : "#2563eb");
        const lw = cfg.lineWidth || 3;
        data.segments.forEach(seg => {
          if (!Array.isArray(seg) || seg.length < 2) return;
          const pts = seg.map(pt => `${(s.x + pt.x * s.width).toFixed(2)},${(s.y + pt.y * s.height).toFixed(2)}`).join(" ");
          parts.push(`    <polyline points="${pts}" fill="none" stroke="${escapeXml(strokeColor)}" stroke-width="${lw}" stroke-linecap="round" stroke-linejoin="round"/>`);
        });
      }
      return `  <g ${tAttr}>\n${parts.join("\n")}\n  </g>`;
    }

    let d;
    if (s.points && s.points.length > 0) {
      d = EditPointsManager.pointsToSvgPath(s.points, s.isPathClosed ?? true);
    } else {
      const def = ShapeDefinitions.getDefinition(s.type);
      d = def.generatePath(s.width, s.height, s.adjustments);
    }

    const fill = escapeXml(s.fill || "none");
    const fillOpacity = s.fillOpacity ?? 1.0;
    const stroke = escapeXml(s.stroke || "none");
    const strokeWidth = s.strokeWidth || 0;
    let dashAttr = "";
    if (s.strokeDash === "dashed") dashAttr = `stroke-dasharray="8 5"`;
    else if (s.strokeDash === "dotted") dashAttr = `stroke-dasharray="3 3"`;

    return `  <g ${tAttr}>\n    <path d="${escapeXml(d)}" transform="translate(${s.x}, ${s.y})" fill="${fill}" fill-opacity="${fillOpacity}" stroke="${stroke}" stroke-width="${strokeWidth}" ${dashAttr}/>\n  </g>`;
  }

  // --- 2. PPM (P6 / P3) 生成 ---
  function generatePpmData(canvasInstance, format = "p6", options = {}) {
    let width = canvasInstance.width;
    let height = canvasInstance.height;
    let offsetX = 0;
    let offsetY = 0;

    const visibleShapes = getVisibleOrderedShapes(canvasInstance);

    if (options.cropToShapes) {
      const bbox = getShapesBoundingBox(visibleShapes, 10);
      width = bbox.width;
      height = bbox.height;
      offsetX = bbox.x;
      offsetY = bbox.y;
    }

    // オフスクリーンキャンバスで描画
    const offCanvas = document.createElement("canvas");
    offCanvas.width = width;
    offCanvas.height = height;
    const offCtx = offCanvas.getContext("2d");

    // 背景描画
    if (!options.cropToShapes && canvasInstance.backgroundColor && canvasInstance.backgroundColor !== "transparent") {
      offCtx.fillStyle = canvasInstance.backgroundColor;
      offCtx.fillRect(0, 0, width, height);
    } else {
      offCtx.fillStyle = "#ffffff";
      offCtx.fillRect(0, 0, width, height);
    }

    // 各図形をオフセット描画(クリップ含む共通描画パス)
    canvasInstance.drawShapesToContext(offCtx, canvasInstance.shapes, {
      showEditorGuides: false,
      offsetX,
      offsetY
    });

    const imageData = offCtx.getImageData(0, 0, width, height);
    const data = imageData.data; // RGBA 1次元配列

    if (format === "p6") {
      // P6 (バイナリ)
      const headerStr = `P6\n${width} ${height}\n255\n`;
      const headerBytes = new TextEncoder().encode(headerStr);
      const rgbLength = width * height * 3;
      const buffer = new Uint8Array(headerBytes.length + rgbLength);
      buffer.set(headerBytes, 0);

      let offset = headerBytes.length;
      for (let i = 0; i < data.length; i += 4) {
        buffer[offset++] = data[i];     // R
        buffer[offset++] = data[i + 1]; // G
        buffer[offset++] = data[i + 2]; // B
      }
      return { blob: new Blob([buffer], { type: "application/x-portable-pixmap" }), rawData: data, width, height };
    } else {
      // P3 (ASCIIテキスト)
      let lines = [`P3`, `${width} ${height}`, `255`];
      let currentLine = [];
      for (let i = 0; i < data.length; i += 4) {
        currentLine.push(`${data[i]} ${data[i + 1]} ${data[i + 2]}`);
        if (currentLine.length >= 5) {
          lines.push(currentLine.join(" "));
          currentLine = [];
        }
      }
      if (currentLine.length > 0) {
        lines.push(currentLine.join(" "));
      }
      const text = lines.join("\n") + "\n";
      return { blob: new Blob([text], { type: "text/plain" }), rawData: data, width, height };
    }
  }

  // RGBAバイト列をBase64文字列へ変換
  function uint8ToBase64(uint8Array) {
    let binary = "";
    const len = uint8Array.byteLength;
    const chunkSize = 8192;
    for (let i = 0; i < len; i += chunkSize) {
      const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, len));
      binary += String.fromCharCode.apply(null, chunk);
    }
    return btoa(binary);
  }

  // --- 3. ダウンロード ＆ サーバー保存トリガー ---
  async function exportSvg(canvasInstance, filename = "slide.svg", options = {}) {
    const svgStr = buildSvgString(canvasInstance, options);

    // クライアント側ダウンロード
    const blob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
    downloadBlob(blob, filename);

    // サーバー側へ保存POST
    try {
      const res = await fetch("/api/export/svg", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ svg: svgStr, filename })
      });
      if (res.ok) {
        console.log("SVG saved to server exports folder.");
      }
    } catch (e) {
      console.warn("Server export failed (offline mode):", e);
    }
  }

  async function exportPpm(canvasInstance, filename = "slide.ppm", format = "p6", options = {}) {
    const { blob, rawData, width, height } = generatePpmData(canvasInstance, format, options);

    // クライアント側ダウンロード
    downloadBlob(blob, filename);

    // サーバー側へ保存POST
    try {
      const base64Rgba = uint8ToBase64(rawData);
      const res = await fetch("/api/export/ppm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          width: width,
          height: height,
          format,
          rgba_base64: base64Rgba,
          filename
        })
      });
      if (res.ok) {
        console.log("PPM saved to server exports folder.");
      }
    } catch (e) {
      console.warn("Server PPM export failed (offline mode):", e);
    }
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  }

  return {
    getShapesBoundingBox,
    buildSvgString,
    exportSvg,
    exportPpm
  };
})();
