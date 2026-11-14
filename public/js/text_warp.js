// public/js/text_warp.js
// PowerPointの「文字の効果」→「変形 (Text Transform / Warp)」機能の実装

window.TextWarpRenderer = (function() {
  const PI = Math.PI;

  const WARP_PRESETS = [
    { id: "none", name: "なし (Plain)" },
    { id: "arch_up", name: "上アーチ (Arch Up)" },
    { id: "arch_down", name: "下アーチ (Arch Down)" },
    { id: "circle", name: "円形 (Circle)" },
    { id: "wave", name: "波 (Wave)" },
    { id: "triangle_up", name: "上向き三角形 (Triangle Up)" },
    { id: "triangle_down", name: "下向き三角形 (Triangle Down)" },
    { id: "inflate", name: "インフレート（膨らみ）" },
    { id: "deflate", name: "デフレート（くびれ）" },
    { id: "fade_right", name: "フェード右 (Fade Right)" },
    { id: "fade_left", name: "フェード左 (Fade Left)" }
  ];

  // Canvas上に変形テキストを描画
  function renderWarpText(ctx, shape) {
    const text = shape.text || "";
    if (!text) return;

    const w = shape.width;
    const h = shape.height;
    const warp = shape.textWarp || "none";
    const fontSize = shape.fontSize || 28;
    const fontFamily = shape.fontFamily || "sans-serif";
    const fontWeight = shape.fontWeight || "normal";
    const fontStyle = shape.fontStyle || "normal";

    ctx.save();
    ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;
    ctx.fillStyle = shape.fill || "#2c3e50";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    if (warp === "none") {
      // 通常のテキスト配置（アラインメント・改行考慮）
      ctx.textAlign = shape.textAlign || "center";
      const tx = shape.textAlign === "left" ? 10 : (shape.textAlign === "right" ? w - 10 : w / 2);
      const lines = text.split("\n");
      const lineHeight = fontSize * 1.2;
      const startY = (h - lines.length * lineHeight) / 2 + lineHeight / 2;
      lines.forEach((line, idx) => {
        ctx.fillText(line, tx, startY + idx * lineHeight);
      });
      ctx.restore();
      return;
    }

    const chars = text.split("");
    const count = chars.length;
    if (count === 0) {
      ctx.restore();
      return;
    }

    // 各文字をパス/カーブに沿って配置
    for (let i = 0; i < count; i++) {
      const ch = chars[i];
      const u = count === 1 ? 0.5 : i / (count - 1); // 0.0から1.0

      ctx.save();
      let charX = w * u;
      let charY = h / 2;
      let charAngle = 0;
      let charScaleY = 1.0;

      switch (warp) {
        case "arch_up": {
          // 上向きの弧
          const arcAngle = (u - 0.5) * (PI * 0.65);
          const r = w * 0.75;
          charX = w / 2 + r * Math.sin(arcAngle);
          charY = h * 0.8 - r * Math.cos(arcAngle) + r * Math.cos(0);
          charAngle = arcAngle;
          break;
        }
        case "arch_down": {
          // 下向きの弧
          const arcAngle = (u - 0.5) * (PI * 0.65);
          const r = w * 0.75;
          charX = w / 2 + r * Math.sin(arcAngle);
          charY = h * 0.2 + r * Math.cos(arcAngle) - r * Math.cos(0);
          charAngle = -arcAngle;
          break;
        }
        case "circle": {
          // 円形に沿う
          const arcAngle = -PI / 2 + (u - 0.5) * (2 * PI * 0.85);
          const r = Math.min(w, h) * 0.4;
          charX = w / 2 + r * Math.cos(arcAngle);
          charY = h / 2 + r * Math.sin(arcAngle);
          charAngle = arcAngle + PI / 2;
          break;
        }
        case "wave": {
          // 正弦波
          charX = w * u;
          charY = h / 2 + Math.sin(u * 2 * PI) * (h * 0.3);
          charAngle = Math.cos(u * 2 * PI) * 0.45;
          break;
        }
        case "triangle_up": {
          // 中央が高くなる
          const factor = 1.0 - 2 * Math.abs(u - 0.5);
          charScaleY = 0.5 + factor * 0.9;
          charX = w * u;
          charY = h / 2;
          break;
        }
        case "triangle_down": {
          // 中央が低くなる
          const factor = 2 * Math.abs(u - 0.5);
          charScaleY = 0.5 + factor * 0.9;
          charX = w * u;
          charY = h / 2;
          break;
        }
        case "inflate": {
          // 中央が膨らむ
          const factor = Math.sin(u * PI);
          charScaleY = 0.7 + factor * 0.8;
          charX = w * u;
          charY = h / 2;
          break;
        }
        case "deflate": {
          // 中央がくびれる
          const factor = 1.0 - Math.sin(u * PI) * 0.6;
          charScaleY = factor;
          charX = w * u;
          charY = h / 2;
          break;
        }
        case "fade_right": {
          // 右に行くほど拡大
          charScaleY = 0.4 + u * 1.0;
          charX = w * u;
          charY = h / 2;
          break;
        }
        case "fade_left": {
          // 左に行くほど拡大
          charScaleY = 1.4 - u * 1.0;
          charX = w * u;
          charY = h / 2;
          break;
        }
      }

      ctx.translate(charX, charY);
      ctx.rotate(charAngle);
      ctx.scale(1.0, charScaleY);
      ctx.fillText(ch, 0, 0);
      ctx.restore();
    }

    ctx.restore();
  }

  // SVG用の変形テキスト要素群を生成
  function generateSvgWarpText(shape) {
    const text = shape.text || "";
    if (!text) return "";

    const w = shape.width;
    const h = shape.height;
    const warp = shape.textWarp || "none";
    const fontSize = shape.fontSize || 28;
    const fontFamily = shape.fontFamily || "sans-serif";
    const fontWeight = shape.fontWeight || "normal";
    const fontStyle = shape.fontStyle || "normal";
    const fill = shape.fill || "#2c3e50";

    const fontFamilyEsc = escapeXml(String(fontFamily));
    const fontWeightEsc = escapeXml(String(fontWeight));
    const fontStyleEsc = escapeXml(String(fontStyle));
    const fillEsc = escapeXml(String(fill));

    if (warp === "none") {
      const align = shape.textAlign || "center";
      const textAnchor = align === "center" ? "middle" : (align === "right" ? "end" : "start");
      const tx = align === "center" ? w / 2 : (align === "right" ? w - 10 : 10);
      const lines = text.split("\n");
      if (lines.length <= 1) {
        return `<text x="${tx}" y="${h / 2}" font-family="${fontFamilyEsc}" font-size="${fontSize}" font-weight="${fontWeightEsc}" font-style="${fontStyleEsc}" fill="${fillEsc}" text-anchor="${textAnchor}" dominant-baseline="middle">${escapeXml(text)}</text>`;
      }
      const lineHeight = fontSize * 1.2;
      const startY = (h - lines.length * lineHeight) / 2 + lineHeight / 2;
      const tspans = lines.map((line, idx) => {
        const ly = startY + idx * lineHeight;
        const content = line.length === 0 ? "&#160;" : escapeXml(line);
        return `<tspan x="${tx}" y="${ly}">${content}</tspan>`;
      }).join("");
      return `<text x="${tx}" y="${startY}" font-family="${fontFamilyEsc}" font-size="${fontSize}" font-weight="${fontWeightEsc}" font-style="${fontStyleEsc}" fill="${fillEsc}" text-anchor="${textAnchor}" dominant-baseline="middle">${tspans}</text>`;
    }

    const chars = text.split("");
    const count = chars.length;
    let svgItems = [];

    for (let i = 0; i < count; i++) {
      const ch = chars[i];
      const u = count === 1 ? 0.5 : i / (count - 1);

      let charX = w * u;
      let charY = h / 2;
      let charAngleDeg = 0;
      let charScaleY = 1.0;

      switch (warp) {
        case "arch_up": {
          const arcAngle = (u - 0.5) * (PI * 0.65);
          const r = w * 0.75;
          charX = w / 2 + r * Math.sin(arcAngle);
          charY = h * 0.8 - r * Math.cos(arcAngle) + r * Math.cos(0);
          charAngleDeg = arcAngle * 180 / PI;
          break;
        }
        case "arch_down": {
          const arcAngle = (u - 0.5) * (PI * 0.65);
          const r = w * 0.75;
          charX = w / 2 + r * Math.sin(arcAngle);
          charY = h * 0.2 + r * Math.cos(arcAngle) - r * Math.cos(0);
          charAngleDeg = -arcAngle * 180 / PI;
          break;
        }
        case "circle": {
          const arcAngle = -PI / 2 + (u - 0.5) * (2 * PI * 0.85);
          const r = Math.min(w, h) * 0.4;
          charX = w / 2 + r * Math.cos(arcAngle);
          charY = h / 2 + r * Math.sin(arcAngle);
          charAngleDeg = (arcAngle + PI / 2) * 180 / PI;
          break;
        }
        case "wave": {
          charX = w * u;
          charY = h / 2 + Math.sin(u * 2 * PI) * (h * 0.3);
          charAngleDeg = Math.cos(u * 2 * PI) * 0.45 * 180 / PI;
          break;
        }
        case "triangle_up": {
          const factor = 1.0 - 2 * Math.abs(u - 0.5);
          charScaleY = 0.5 + factor * 0.9;
          break;
        }
        case "triangle_down": {
          const factor = 2 * Math.abs(u - 0.5);
          charScaleY = 0.5 + factor * 0.9;
          break;
        }
        case "inflate": {
          charScaleY = 0.7 + Math.sin(u * PI) * 0.8;
          break;
        }
        case "deflate": {
          charScaleY = 1.0 - Math.sin(u * PI) * 0.6;
          break;
        }
        case "fade_right": {
          charScaleY = 0.4 + u * 1.0;
          break;
        }
        case "fade_left": {
          charScaleY = 1.4 - u * 1.0;
          break;
        }
      }

      let transform = `translate(${charX.toFixed(2)}, ${charY.toFixed(2)})`;
      if (charAngleDeg !== 0) transform += ` rotate(${charAngleDeg.toFixed(2)})`;
      if (charScaleY !== 1.0) transform += ` scale(1, ${charScaleY.toFixed(2)})`;

      svgItems.push(`<text transform="${transform}" font-family="${fontFamilyEsc}" font-size="${fontSize}" font-weight="${fontWeightEsc}" font-style="${fontStyleEsc}" fill="${fillEsc}" text-anchor="middle" dominant-baseline="middle">${escapeXml(ch)}</text>`);
    }

    return `<g class="warped-text">${svgItems.join("")}</g>`;
  }

  function escapeXml(unsafe) {
    return unsafe.replace(/[<>&'"]/g, c => {
      switch (c) {
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '&': return '&amp;';
        case '\'': return '&apos;';
        case '"': return '&quot;';
      }
    });
  }

  return {
    WARP_PRESETS,
    renderWarpText,
    generateSvgWarpText
  };
})();
