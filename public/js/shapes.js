// public/js/shapes.js
// PowerPointの主要図形定義、黄色い調整ハンドル、SVGパス生成

window.ShapeDefinitions = (function() {
  const PI = Math.PI;

  // ヘルパー：角度から度への変換など
  function toRad(deg) { return deg * PI / 180; }
  function toDeg(rad) { return rad * 180 / PI; }

  /*
    各図形定義の仕様:
    - id: 識別子
    - name: 表示名
    - category: 分類 (rect, basic, arrow, callout, star)
    - defaultAdjustments: 黄色い調整ハンドルの初期値(0.0から1.0)
    - getAdjustmentHandles(shape): 現在の形状における黄色いハンドルのローカル座標一覧
    - setAdjustmentFromPoint(shape, handleIndex, localX, localY): ハンドルドラッグ時の調整値更新
    - generatePath(shape): SVGパス文字列(d属性)または描画コマンドの生成
    - toPathPoints(shape): 「頂点の編集」用アンカーポイント・ベジェ制御点の配列へ変換
  */

  const definitions = {
    // --- 1. 長方形系 ---
    rect: {
      name: "長方形",
      category: "rectangles",
      defaultAdjustments: {},
      getAdjustmentHandles: () => [],
      setAdjustmentFromPoint: () => {},
      generatePath: (w, h) => `M 0 0 L ${w} 0 L ${w} ${h} L 0 ${h} Z`,
      toPathPoints: (w, h) => [
        { x: 0, y: 0, type: "corner" },
        { x: w, y: 0, type: "corner" },
        { x: w, y: h, type: "corner" },
        { x: 0, y: h, type: "corner" }
      ]
    },

    rounded_rect: {
      name: "角丸四角形",
      category: "rectangles",
      defaultAdjustments: { radius: 0.2 }, // 0.0から0.5 (短辺に対する比率)
      getAdjustmentHandles: (w, h, adj) => {
        const rRatio = Math.max(0, Math.min(0.5, adj.radius ?? 0.2));
        const r = Math.min(w, h) * rRatio;
        return [{ id: "radius", x: r, y: 0 }];
      },
      setAdjustmentFromPoint: (w, h, adj, handleId, lx, ly) => {
        const shortEdge = Math.min(w, h);
        const rRatio = Math.max(0, Math.min(0.5, lx / shortEdge));
        adj.radius = rRatio;
      },
      generatePath: (w, h, adj) => {
        const rRatio = Math.max(0, Math.min(0.5, adj?.radius ?? 0.2));
        const r = Math.min(w, h) * rRatio;
        if (r <= 0) return `M 0 0 L ${w} 0 L ${w} ${h} L 0 ${h} Z`;
        return `M ${r} 0 L ${w - r} 0 Q ${w} 0 ${w} ${r} L ${w} ${h - r} Q ${w} ${h} ${w - r} ${h} L ${r} ${h} Q 0 ${h} 0 ${h - r} L 0 ${r} Q 0 0 ${r} 0 Z`;
      },
      toPathPoints: (w, h, adj) => {
        const rRatio = Math.max(0, Math.min(0.5, adj?.radius ?? 0.2));
        const r = Math.min(w, h) * rRatio;
        const k = 0.5522847498 * r;
        return [
          { x: r, y: 0, type: "smooth", hIn: { x: r - k, y: 0 }, hOut: { x: r + k, y: 0 } },
          { x: w - r, y: 0, type: "smooth", hIn: { x: w - r - k, y: 0 }, hOut: { x: w - r + k, y: 0 } },
          { x: w, y: r, type: "smooth", hIn: { x: w, y: r - k }, hOut: { x: w, y: r + k } },
          { x: w, y: h - r, type: "smooth", hIn: { x: w, y: h - r - k }, hOut: { x: w, y: h - r + k } },
          { x: w - r, y: h, type: "smooth", hIn: { x: w - r + k, y: h }, hOut: { x: w - r - k, y: h } },
          { x: r, y: h, type: "smooth", hIn: { x: r + k, y: h }, hOut: { x: r - k, y: h } },
          { x: 0, y: h - r, type: "smooth", hIn: { x: 0, y: h - r + k }, hOut: { x: 0, y: h - r - k } },
          { x: 0, y: r, type: "smooth", hIn: { x: 0, y: r + k }, hOut: { x: 0, y: r - k } }
        ];
      }
    },

    snip_rect: {
      name: "1か所面取り四角形",
      category: "rectangles",
      defaultAdjustments: { snip: 0.2 },
      getAdjustmentHandles: (w, h, adj) => {
        const s = Math.min(w, h) * (adj.snip ?? 0.2);
        return [{ id: "snip", x: w - s, y: 0 }];
      },
      setAdjustmentFromPoint: (w, h, adj, id, lx, ly) => {
        const s = Math.max(0, Math.min(Math.min(w, h) * 0.5, w - lx));
        adj.snip = s / Math.min(w, h);
      },
      generatePath: (w, h, adj) => {
        const s = Math.min(w, h) * (adj?.snip ?? 0.2);
        return `M 0 0 L ${w - s} 0 L ${w} ${s} L ${w} ${h} L 0 ${h} Z`;
      }
    },

    // --- 2. 基本図形 ---
    ellipse: {
      name: "楕円 / 円",
      category: "basic",
      defaultAdjustments: {},
      getAdjustmentHandles: () => [],
      setAdjustmentFromPoint: () => {},
      generatePath: (w, h) => {
        const rx = w / 2;
        const ry = h / 2;
        return `M ${rx} 0 A ${rx} ${ry} 0 1 0 ${rx} ${h} A ${rx} ${ry} 0 1 0 ${rx} 0 Z`;
      },
      toPathPoints: (w, h) => {
        const rx = w / 2, ry = h / 2;
        const kx = 0.5522847498 * rx;
        const ky = 0.5522847498 * ry;
        return [
          { x: rx, y: 0, type: "smooth", hIn: { x: rx - kx, y: 0 }, hOut: { x: rx + kx, y: 0 } },
          { x: w, y: ry, type: "smooth", hIn: { x: w, y: ry - ky }, hOut: { x: w, y: ry + ky } },
          { x: rx, y: h, type: "smooth", hIn: { x: rx + kx, y: h }, hOut: { x: rx - kx, y: h } },
          { x: 0, y: ry, type: "smooth", hIn: { x: 0, y: ry + ky }, hOut: { x: 0, y: ry - ky } }
        ];
      }
    },

    triangle: {
      name: "二等辺三角形",
      category: "basic",
      defaultAdjustments: { topX: 0.5 }, // 頂点の水平位置 (0.0から1.0)
      getAdjustmentHandles: (w, h, adj) => {
        const tx = w * (adj.topX ?? 0.5);
        return [{ id: "topX", x: tx, y: 0 }];
      },
      setAdjustmentFromPoint: (w, h, adj, id, lx, ly) => {
        adj.topX = Math.max(0, Math.min(1, lx / w));
      },
      generatePath: (w, h, adj) => {
        const tx = w * (adj?.topX ?? 0.5);
        return `M ${tx} 0 L ${w} ${h} L 0 ${h} Z`;
      },
      toPathPoints: (w, h, adj) => {
        const tx = w * (adj?.topX ?? 0.5);
        return [
          { x: tx, y: 0, type: "corner" },
          { x: w, y: h, type: "corner" },
          { x: 0, y: h, type: "corner" }
        ];
      }
    },

    right_triangle: {
      name: "直角三角形",
      category: "basic",
      defaultAdjustments: {},
      getAdjustmentHandles: () => [],
      setAdjustmentFromPoint: () => {},
      generatePath: (w, h) => `M 0 0 L 0 ${h} L ${w} ${h} Z`,
      toPathPoints: (w, h) => [
        { x: 0, y: 0, type: "corner" },
        { x: 0, y: h, type: "corner" },
        { x: w, y: h, type: "corner" }
      ]
    },

    trapezoid: {
      name: "台形",
      category: "basic",
      defaultAdjustments: { inset: 0.2 }, // 上底のインセット (0.0から0.5)
      getAdjustmentHandles: (w, h, adj) => {
        const ins = w * (adj.inset ?? 0.2);
        return [{ id: "inset", x: ins, y: 0 }];
      },
      setAdjustmentFromPoint: (w, h, adj, id, lx, ly) => {
        adj.inset = Math.max(0, Math.min(0.48, lx / w));
      },
      generatePath: (w, h, adj) => {
        const ins = w * (adj?.inset ?? 0.2);
        return `M ${ins} 0 L ${w - ins} 0 L ${w} ${h} L 0 ${h} Z`;
      },
      toPathPoints: (w, h, adj) => {
        const ins = w * (adj?.inset ?? 0.2);
        return [
          { x: ins, y: 0, type: "corner" },
          { x: w - ins, y: 0, type: "corner" },
          { x: w, y: h, type: "corner" },
          { x: 0, y: h, type: "corner" }
        ];
      }
    },

    parallelogram: {
      name: "平行四辺形",
      category: "basic",
      defaultAdjustments: { slant: 0.25 }, // 傾き (0.0から0.5)
      getAdjustmentHandles: (w, h, adj) => {
        const s = w * (adj.slant ?? 0.25);
        return [{ id: "slant", x: s, y: 0 }];
      },
      setAdjustmentFromPoint: (w, h, adj, id, lx, ly) => {
        adj.slant = Math.max(0, Math.min(0.5, lx / w));
      },
      generatePath: (w, h, adj) => {
        const s = w * (adj?.slant ?? 0.25);
        return `M ${s} 0 L ${w} 0 L ${w - s} ${h} L 0 ${h} Z`;
      },
      toPathPoints: (w, h, adj) => {
        const s = w * (adj?.slant ?? 0.25);
        return [
          { x: s, y: 0, type: "corner" },
          { x: w, y: 0, type: "corner" },
          { x: w - s, y: h, type: "corner" },
          { x: 0, y: h, type: "corner" }
        ];
      }
    },

    diamond: {
      name: "ひし形",
      category: "basic",
      defaultAdjustments: {},
      getAdjustmentHandles: () => [],
      setAdjustmentFromPoint: () => {},
      generatePath: (w, h) => `M ${w / 2} 0 L ${w} ${h / 2} L ${w / 2} ${h} L 0 ${h / 2} Z`,
      toPathPoints: (w, h) => [
        { x: w / 2, y: 0, type: "corner" },
        { x: w, y: h / 2, type: "corner" },
        { x: w / 2, y: h, type: "corner" },
        { x: 0, y: h / 2, type: "corner" }
      ]
    },

    cross: {
      name: "十字形",
      category: "basic",
      defaultAdjustments: { thickness: 0.25 }, // 十字の腕の太さ (0.1から0.4)
      getAdjustmentHandles: (w, h, adj) => {
        const t = Math.min(w, h) * (adj.thickness ?? 0.25);
        return [{ id: "thickness", x: (w - t) / 2, y: (h - t) / 2 }];
      },
      setAdjustmentFromPoint: (w, h, adj, id, lx, ly) => {
        const t = Math.min(w, h) - 2 * Math.min(lx, ly);
        adj.thickness = Math.max(0.1, Math.min(0.45, t / Math.min(w, h)));
      },
      generatePath: (w, h, adj) => {
        const t = Math.min(w, h) * (adj?.thickness ?? 0.25);
        const x1 = (w - t) / 2, x2 = (w + t) / 2;
        const y1 = (h - t) / 2, y2 = (h + t) / 2;
        return `M ${x1} 0 L ${x2} 0 L ${x2} ${y1} L ${w} ${y1} L ${w} ${y2} L ${x2} ${y2} L ${x2} ${h} L ${x1} ${h} L ${x1} ${y2} L 0 ${y2} L 0 ${y1} L ${x1} ${y1} Z`;
      }
    },

    donut: {
      name: "ドーナツ",
      category: "basic",
      defaultAdjustments: { holeRatio: 0.5 }, // 内径比率 (0.1から0.9)
      getAdjustmentHandles: (w, h, adj) => {
        const hr = adj.holeRatio ?? 0.5;
        const rx = w / 2, ry = h / 2;
        return [{ id: "holeRatio", x: rx + rx * hr, y: ry }];
      },
      setAdjustmentFromPoint: (w, h, adj, id, lx, ly) => {
        const rx = w / 2;
        adj.holeRatio = Math.max(0.1, Math.min(0.9, (lx - rx) / rx));
      },
      generatePath: (w, h, adj) => {
        const hr = adj?.holeRatio ?? 0.5;
        const rx = w / 2, ry = h / 2;
        const irx = rx * hr, iry = ry * hr;
        return `M ${rx} 0 A ${rx} ${ry} 0 1 0 ${rx} ${h} A ${rx} ${ry} 0 1 0 ${rx} 0 Z M ${rx} ${ry - iry} A ${irx} ${iry} 0 1 1 ${rx} ${ry + iry} A ${irx} ${iry} 0 1 1 ${rx} ${ry - iry} Z`;
      }
    },

    pie: {
      name: "扇形（パイ）",
      category: "basic",
      defaultAdjustments: { startAngle: 0, endAngle: 270 },
      getAdjustmentHandles: (w, h, adj) => {
        const rx = w / 2, ry = h / 2;
        const sRad = toRad(adj.startAngle ?? 0);
        const eRad = toRad(adj.endAngle ?? 270);
        return [
          { id: "startAngle", x: rx + rx * Math.cos(sRad), y: ry + ry * Math.sin(sRad) },
          { id: "endAngle", x: rx + rx * Math.cos(eRad), y: ry + ry * Math.sin(eRad) }
        ];
      },
      setAdjustmentFromPoint: (w, h, adj, id, lx, ly) => {
        const rx = w / 2, ry = h / 2;
        let deg = toDeg(Math.atan2((ly - ry) / ry, (lx - rx) / rx));
        if (deg < 0) deg += 360;
        if (id === "startAngle") adj.startAngle = deg;
        if (id === "endAngle") adj.endAngle = deg;
      },
      generatePath: (w, h, adj) => {
        const rx = w / 2, ry = h / 2;
        let sDeg = adj?.startAngle ?? 0;
        let eDeg = adj?.endAngle ?? 270;
        let diff = (eDeg - sDeg) % 360;
        if (diff < 0) diff += 360;
        const sRad = toRad(sDeg);
        const eRad = toRad(eDeg);
        const x1 = rx + rx * Math.cos(sRad);
        const y1 = ry + ry * Math.sin(sRad);
        const x2 = rx + rx * Math.cos(eRad);
        const y2 = ry + ry * Math.sin(eRad);
        const largeArc = diff > 180 ? 1 : 0;
        return `M ${rx} ${ry} L ${x1} ${y1} A ${rx} ${ry} 0 ${largeArc} 1 ${x2} ${y2} Z`;
      }
    },

    heart: {
      name: "ハート",
      category: "basic",
      defaultAdjustments: {},
      getAdjustmentHandles: () => [],
      setAdjustmentFromPoint: () => {},
      generatePath: (w, h) => {
        return `M ${w / 2} ${h * 0.8} C ${w * 0.1} ${h * 0.55} 0 ${h * 0.3} 0 ${h * 0.15} C 0 0 ${w * 0.25} 0 ${w / 2} ${h * 0.25} C ${w * 0.75} 0 ${w} 0 ${w} ${h * 0.15} C ${w} ${h * 0.3} ${w * 0.9} ${h * 0.55} ${w / 2} ${h * 0.8} Z`;
      }
    },

    lightning: {
      name: "稲妻",
      category: "basic",
      defaultAdjustments: {},
      getAdjustmentHandles: () => [],
      setAdjustmentFromPoint: () => {},
      generatePath: (w, h) => {
        return `M ${w * 0.55} 0 L ${w * 0.15} ${h * 0.55} L ${w * 0.45} ${h * 0.55} L ${w * 0.35} ${h} L ${w * 0.85} ${h * 0.45} L ${w * 0.55} ${h * 0.45} Z`;
      }
    },

    // --- 3. 矢印系 ---
    right_arrow: {
      name: "右矢印",
      category: "arrows",
      defaultAdjustments: { headLength: 0.35, headWidth: 0.35, shaftWidth: 0.3 },
      getAdjustmentHandles: (w, h, adj) => {
        const hl = w * (adj.headLength ?? 0.35);
        const hw = h * (adj.headWidth ?? 0.35);
        const sw = h * (adj.shaftWidth ?? 0.3);
        return [
          { id: "headLength", x: w - hl, y: (h - sw) / 2 },
          { id: "shaftWidth", x: 0, y: (h - sw) / 2 }
        ];
      },
      setAdjustmentFromPoint: (w, h, adj, id, lx, ly) => {
        if (id === "headLength") {
          adj.headLength = Math.max(0.1, Math.min(0.8, (w - lx) / w));
        } else if (id === "shaftWidth") {
          adj.shaftWidth = Math.max(0.1, Math.min(0.8, (h - 2 * ly) / h));
        }
      },
      generatePath: (w, h, adj) => {
        const hl = w * (adj?.headLength ?? 0.35);
        const sw = h * (adj?.shaftWidth ?? 0.3);
        const yTop = (h - sw) / 2;
        const yBot = (h + sw) / 2;
        const xShaftEnd = w - hl;
        return `M 0 ${yTop} L ${xShaftEnd} ${yTop} L ${xShaftEnd} 0 L ${w} ${h / 2} L ${xShaftEnd} ${h} L ${xShaftEnd} ${yBot} L 0 ${yBot} Z`;
      },
      toPathPoints: (w, h, adj) => {
        const hl = w * (adj?.headLength ?? 0.35);
        const sw = h * (adj?.shaftWidth ?? 0.3);
        const yTop = (h - sw) / 2;
        const yBot = (h + sw) / 2;
        const xShaftEnd = w - hl;
        return [
          { x: 0, y: yTop, type: "corner" },
          { x: xShaftEnd, y: yTop, type: "corner" },
          { x: xShaftEnd, y: 0, type: "corner" },
          { x: w, y: h / 2, type: "corner" },
          { x: xShaftEnd, y: h, type: "corner" },
          { x: xShaftEnd, y: yBot, type: "corner" },
          { x: 0, y: yBot, type: "corner" }
        ];
      }
    },

    left_arrow: {
      name: "左矢印",
      category: "arrows",
      defaultAdjustments: { headLength: 0.35, shaftWidth: 0.3 },
      getAdjustmentHandles: (w, h, adj) => {
        const hl = w * (adj.headLength ?? 0.35);
        const sw = h * (adj.shaftWidth ?? 0.3);
        return [{ id: "headLength", x: hl, y: (h - sw) / 2 }];
      },
      setAdjustmentFromPoint: (w, h, adj, id, lx, ly) => {
        adj.headLength = Math.max(0.1, Math.min(0.8, lx / w));
      },
      generatePath: (w, h, adj) => {
        const hl = w * (adj?.headLength ?? 0.35);
        const sw = h * (adj?.shaftWidth ?? 0.3);
        const yTop = (h - sw) / 2, yBot = (h + sw) / 2;
        return `M ${w} ${yTop} L ${hl} ${yTop} L ${hl} 0 L 0 ${h / 2} L ${hl} ${h} L ${hl} ${yBot} L ${w} ${yBot} Z`;
      }
    },

    left_right_arrow: {
      name: "左右両方向矢印",
      category: "arrows",
      defaultAdjustments: { headLength: 0.25, shaftWidth: 0.3 },
      getAdjustmentHandles: (w, h, adj) => {
        const hl = w * (adj.headLength ?? 0.25);
        const sw = h * (adj.shaftWidth ?? 0.3);
        return [{ id: "headLength", x: w - hl, y: (h - sw) / 2 }];
      },
      setAdjustmentFromPoint: (w, h, adj, id, lx, ly) => {
        adj.headLength = Math.max(0.1, Math.min(0.4, (w - lx) / w));
      },
      generatePath: (w, h, adj) => {
        const hl = w * (adj?.headLength ?? 0.25);
        const sw = h * (adj?.shaftWidth ?? 0.3);
        const yTop = (h - sw) / 2, yBot = (h + sw) / 2;
        return `M ${hl} ${yTop} L ${w - hl} ${yTop} L ${w - hl} 0 L ${w} ${h / 2} L ${w - hl} ${h} L ${w - hl} ${yBot} L ${hl} ${yBot} L ${hl} ${h} L 0 ${h / 2} L ${hl} 0 Z`;
      }
    },

    chevron: {
      name: "シェブロン（矢羽）",
      category: "arrows",
      defaultAdjustments: { slant: 0.3 },
      getAdjustmentHandles: (w, h, adj) => {
        const s = w * (adj.slant ?? 0.3);
        return [{ id: "slant", x: s, y: h / 2 }];
      },
      setAdjustmentFromPoint: (w, h, adj, id, lx, ly) => {
        adj.slant = Math.max(0.05, Math.min(0.6, lx / w));
      },
      generatePath: (w, h, adj) => {
        const s = w * (adj?.slant ?? 0.3);
        return `M 0 0 L ${w - s} 0 L ${w} ${h / 2} L ${w - s} ${h} L 0 ${h} L ${s} ${h / 2} Z`;
      }
    },

    // --- 4. 星・多角形系 ---
    star5: {
      name: "5方向の星",
      category: "stars",
      defaultAdjustments: { innerRadiusRatio: 0.382 }, // 内径比率 (0.1から0.8)
      getAdjustmentHandles: (w, h, adj) => {
        const rx = w / 2, ry = h / 2;
        const irRatio = adj.innerRadiusRatio ?? 0.382;
        // 最初の内角 (谷) の位置
        const angle = -PI / 2 + PI / 5;
        return [{ id: "innerRadius", x: rx + rx * irRatio * Math.cos(angle), y: ry + ry * irRatio * Math.sin(angle) }];
      },
      setAdjustmentFromPoint: (w, h, adj, id, lx, ly) => {
        const rx = w / 2, ry = h / 2;
        const dist = Math.hypot((lx - rx) / rx, (ly - ry) / ry);
        adj.innerRadiusRatio = Math.max(0.1, Math.min(0.8, dist));
      },
      generatePath: (w, h, adj) => {
        return generateNStarPath(w, h, 5, adj?.innerRadiusRatio ?? 0.382);
      }
    },

    star4: {
      name: "4方向の星",
      category: "stars",
      defaultAdjustments: { innerRadiusRatio: 0.3 },
      getAdjustmentHandles: (w, h, adj) => {
        const rx = w / 2, ry = h / 2;
        const ir = adj.innerRadiusRatio ?? 0.3;
        const angle = -PI / 2 + PI / 4;
        return [{ id: "innerRadius", x: rx + rx * ir * Math.cos(angle), y: ry + ry * ir * Math.sin(angle) }];
      },
      setAdjustmentFromPoint: (w, h, adj, id, lx, ly) => {
        const rx = w / 2, ry = h / 2;
        const dist = Math.hypot((lx - rx) / rx, (ly - ry) / ry);
        adj.innerRadiusRatio = Math.max(0.1, Math.min(0.8, dist));
      },
      generatePath: (w, h, adj) => generateNStarPath(w, h, 4, adj?.innerRadiusRatio ?? 0.3)
    },

    star6: {
      name: "6方向の星",
      category: "stars",
      defaultAdjustments: { innerRadiusRatio: 0.5 },
      getAdjustmentHandles: (w, h, adj) => {
        const rx = w / 2, ry = h / 2;
        const ir = adj.innerRadiusRatio ?? 0.5;
        const angle = -PI / 2 + PI / 6;
        return [{ id: "innerRadius", x: rx + rx * ir * Math.cos(angle), y: ry + ry * ir * Math.sin(angle) }];
      },
      setAdjustmentFromPoint: (w, h, adj, id, lx, ly) => {
        const rx = w / 2, ry = h / 2;
        adj.innerRadiusRatio = Math.max(0.1, Math.min(0.8, Math.hypot((lx - rx) / rx, (ly - ry) / ry)));
      },
      generatePath: (w, h, adj) => generateNStarPath(w, h, 6, adj?.innerRadiusRatio ?? 0.5)
    },

    star8: {
      name: "8方向の星",
      category: "stars",
      defaultAdjustments: { innerRadiusRatio: 0.54 },
      getAdjustmentHandles: (w, h, adj) => {
        const rx = w / 2, ry = h / 2;
        const ir = adj.innerRadiusRatio ?? 0.54;
        const angle = -PI / 2 + PI / 8;
        return [{ id: "innerRadius", x: rx + rx * ir * Math.cos(angle), y: ry + ry * ir * Math.sin(angle) }];
      },
      setAdjustmentFromPoint: (w, h, adj, id, lx, ly) => {
        const rx = w / 2, ry = h / 2;
        adj.innerRadiusRatio = Math.max(0.1, Math.min(0.85, Math.hypot((lx - rx) / rx, (ly - ry) / ry)));
      },
      generatePath: (w, h, adj) => generateNStarPath(w, h, 8, adj?.innerRadiusRatio ?? 0.54)
    },

    // --- 5. 吹き出し系 ---
    callout_rect: {
      name: "四角形吹き出し",
      category: "callouts",
      defaultAdjustments: { tailX: 0.2, tailY: 1.3, tailBase1: 0.15, tailBase2: 0.3 },
      getAdjustmentHandles: (w, h, adj) => {
        return [{ id: "tailTip", x: w * (adj.tailX ?? 0.2), y: h * (adj.tailY ?? 1.3) }];
      },
      setAdjustmentFromPoint: (w, h, adj, id, lx, ly) => {
        adj.tailX = lx / w;
        adj.tailY = ly / h;
      },
      generatePath: (w, h, adj) => {
        const tx = w * (adj?.tailX ?? 0.2);
        const ty = h * (adj?.tailY ?? 1.3);
        const b1 = w * (adj?.tailBase1 ?? 0.15);
        const b2 = w * (adj?.tailBase2 ?? 0.3);
        return `M 0 0 L ${w} 0 L ${w} ${h} L ${b2} ${h} L ${tx} ${ty} L ${b1} ${h} L 0 ${h} Z`;
      }
    },

    callout_rounded: {
      name: "角丸四角形吹き出し",
      category: "callouts",
      defaultAdjustments: { tailX: 0.2, tailY: 1.3, tailBase1: 0.2, tailBase2: 0.35, radius: 0.15 },
      getAdjustmentHandles: (w, h, adj) => {
        return [{ id: "tailTip", x: w * (adj.tailX ?? 0.2), y: h * (adj.tailY ?? 1.3) }];
      },
      setAdjustmentFromPoint: (w, h, adj, id, lx, ly) => {
        adj.tailX = lx / w;
        adj.tailY = ly / h;
      },
      generatePath: (w, h, adj) => {
        const r = Math.min(w, h) * (adj?.radius ?? 0.15);
        const tx = w * (adj?.tailX ?? 0.2);
        const ty = h * (adj?.tailY ?? 1.3);
        const b1 = Math.max(r, w * (adj?.tailBase1 ?? 0.2));
        const b2 = Math.min(w - r, w * (adj?.tailBase2 ?? 0.35));
        return `M ${r} 0 L ${w - r} 0 Q ${w} 0 ${w} ${r} L ${w} ${h - r} Q ${w} ${h} ${w - r} ${h} L ${b2} ${h} L ${tx} ${ty} L ${b1} ${h} L ${r} ${h} Q 0 ${h} 0 ${h - r} L 0 ${r} Q 0 0 ${r} 0 Z`;
      }
    },

    callout_oval: {
      name: "楕円形吹き出し",
      category: "callouts",
      defaultAdjustments: { tailX: 0.2, tailY: 1.3 },
      getAdjustmentHandles: (w, h, adj) => [{ id: "tailTip", x: w * (adj.tailX ?? 0.2), y: h * (adj.tailY ?? 1.3) }],
      setAdjustmentFromPoint: (w, h, adj, id, lx, ly) => {
        adj.tailX = lx / w;
        adj.tailY = ly / h;
      },
      generatePath: (w, h, adj) => {
        const rx = w / 2, ry = h / 2;
        const tx = w * (adj?.tailX ?? 0.2);
        const ty = h * (adj?.tailY ?? 1.3);
        // 楕円下部のしっぽ接続点
        const a1 = PI * 0.65, a2 = PI * 0.55;
        const x1 = rx + rx * Math.cos(a1), y1 = ry + ry * Math.sin(a1);
        const x2 = rx + rx * Math.cos(a2), y2 = ry + ry * Math.sin(a2);
        return `M ${x2} ${y2} A ${rx} ${ry} 0 1 0 ${x1} ${y1} L ${tx} ${ty} Z`;
      }
    },

    callout_cloud: {
      name: "雲形吹き出し",
      category: "callouts",
      defaultAdjustments: {},
      getAdjustmentHandles: () => [],
      setAdjustmentFromPoint: () => {},
      generatePath: (w, h) => {
        return `M ${w * 0.25} ${h * 0.3} C ${w * 0.15} ${h * 0.1} ${w * 0.45} 0 ${w * 0.55} ${h * 0.15} C ${w * 0.7} 0 ${w * 0.95} ${h * 0.15} ${w * 0.85} ${h * 0.35} C ${w * 1.05} ${h * 0.45} ${w * 0.95} ${h * 0.8} ${w * 0.75} ${h * 0.8} C ${w * 0.65} ${h * 0.95} ${w * 0.35} ${h * 0.95} ${w * 0.25} ${h * 0.8} C ${w * 0.05} ${h * 0.85} 0 ${h * 0.5} ${w * 0.15} ${h * 0.4} C ${w * 0.1} ${h * 0.35} ${w * 0.18} ${h * 0.3} ${w * 0.25} ${h * 0.3} Z`;
      }
    },

    // --- 追加四角形系 ---
    snip_2_rect: {
      name: "上2か所面取り四角形",
      category: "rectangles",
      defaultAdjustments: { snip: 0.2 },
      getAdjustmentHandles: (w, h, adj) => [{ id: "snip", x: Math.min(w, h) * (adj.snip ?? 0.2), y: 0 }],
      setAdjustmentFromPoint: (w, h, adj, id, lx) => {
        adj.snip = Math.max(0, Math.min(0.48, lx / Math.min(w, h)));
      },
      generatePath: (w, h, adj) => {
        const s = Math.min(w, h) * (adj?.snip ?? 0.2);
        return `M ${s} 0 L ${w - s} 0 L ${w} ${s} L ${w} ${h} L 0 ${h} L 0 ${s} Z`;
      },
      toPathPoints: (w, h, adj) => {
        const s = Math.min(w, h) * (adj?.snip ?? 0.2);
        return [
          { x: s, y: 0, type: "corner" }, { x: w - s, y: 0, type: "corner" },
          { x: w, y: s, type: "corner" }, { x: w, y: h, type: "corner" },
          { x: 0, y: h, type: "corner" }, { x: 0, y: s, type: "corner" }
        ];
      }
    },

    diag_snip_rect: {
      name: "対角2か所面取り四角形",
      category: "rectangles",
      defaultAdjustments: { snip: 0.2 },
      getAdjustmentHandles: (w, h, adj) => [{ id: "snip", x: Math.min(w, h) * (adj.snip ?? 0.2), y: 0 }],
      setAdjustmentFromPoint: (w, h, adj, id, lx) => {
        adj.snip = Math.max(0, Math.min(0.48, lx / Math.min(w, h)));
      },
      generatePath: (w, h, adj) => {
        const s = Math.min(w, h) * (adj?.snip ?? 0.2);
        return `M ${s} 0 L ${w} 0 L ${w} ${h - s} L ${w - s} ${h} L 0 ${h} L 0 ${s} Z`;
      },
      toPathPoints: (w, h, adj) => {
        const s = Math.min(w, h) * (adj?.snip ?? 0.2);
        return [
          { x: s, y: 0, type: "corner" }, { x: w, y: 0, type: "corner" },
          { x: w, y: h - s, type: "corner" }, { x: w - s, y: h, type: "corner" },
          { x: 0, y: h, type: "corner" }, { x: 0, y: s, type: "corner" }
        ];
      }
    },

    round_top_rect: {
      name: "上2か所角丸四角形",
      category: "rectangles",
      defaultAdjustments: { radius: 0.25 },
      getAdjustmentHandles: (w, h, adj) => [{ id: "radius", x: Math.min(w, h) * (adj.radius ?? 0.25), y: 0 }],
      setAdjustmentFromPoint: (w, h, adj, id, lx) => {
        adj.radius = Math.max(0, Math.min(0.5, lx / Math.min(w, h)));
      },
      generatePath: (w, h, adj) => {
        const r = Math.min(w, h) * (adj?.radius ?? 0.25);
        return `M ${r} 0 L ${w - r} 0 Q ${w} 0 ${w} ${r} L ${w} ${h} L 0 ${h} L 0 ${r} Q 0 0 ${r} 0 Z`;
      }
    },

    diag_round_rect: {
      name: "対角角丸四角形(葉形)",
      category: "rectangles",
      defaultAdjustments: { radius: 0.35 },
      getAdjustmentHandles: (w, h, adj) => [{ id: "radius", x: Math.min(w, h) * (adj.radius ?? 0.35), y: 0 }],
      setAdjustmentFromPoint: (w, h, adj, id, lx) => {
        adj.radius = Math.max(0, Math.min(0.5, lx / Math.min(w, h)));
      },
      generatePath: (w, h, adj) => {
        const r = Math.min(w, h) * (adj?.radius ?? 0.35);
        return `M ${r} 0 L ${w} 0 L ${w} ${h - r} Q ${w} ${h} ${w - r} ${h} L 0 ${h} L 0 ${r} Q 0 0 ${r} 0 Z`;
      }
    },

    // --- 追加基本図形(多角形・Canva風パーツ) ---
    pentagon: {
      name: "五角形",
      category: "basic",
      defaultAdjustments: {},
      getAdjustmentHandles: () => [],
      setAdjustmentFromPoint: () => {},
      generatePath: (w, h) => generateRegularPolygonPath(w, h, 5),
      toPathPoints: (w, h) => generateRegularPolygonPoints(w, h, 5)
    },

    hexagon: {
      name: "六角形",
      category: "basic",
      defaultAdjustments: {},
      getAdjustmentHandles: () => [],
      setAdjustmentFromPoint: () => {},
      generatePath: (w, h) => generateRegularPolygonPath(w, h, 6),
      toPathPoints: (w, h) => generateRegularPolygonPoints(w, h, 6)
    },

    octagon: {
      name: "八角形",
      category: "basic",
      defaultAdjustments: {},
      getAdjustmentHandles: () => [],
      setAdjustmentFromPoint: () => {},
      generatePath: (w, h) => generateRegularPolygonPath(w, h, 8),
      toPathPoints: (w, h) => generateRegularPolygonPoints(w, h, 8)
    },

    capsule: {
      name: "カプセル(ピル型)",
      category: "basic",
      defaultAdjustments: {},
      getAdjustmentHandles: () => [],
      setAdjustmentFromPoint: () => {},
      generatePath: (w, h) => {
        const r = Math.min(w, h) / 2;
        return `M ${r} 0 L ${w - r} 0 A ${r} ${r} 0 0 1 ${w - r} ${h} L ${r} ${h} A ${r} ${r} 0 0 1 ${r} 0 Z`;
      }
    },

    semicircle: {
      name: "半円",
      category: "basic",
      defaultAdjustments: {},
      getAdjustmentHandles: () => [],
      setAdjustmentFromPoint: () => {},
      generatePath: (w, h) => `M 0 ${h} A ${w / 2} ${h} 0 0 1 ${w} ${h} Z`
    },

    frame: {
      name: "額縁(フレーム)",
      category: "basic",
      defaultAdjustments: { thickness: 0.2 },
      getAdjustmentHandles: (w, h, adj) => [{ id: "thickness", x: Math.min(w, h) * (adj.thickness ?? 0.2), y: Math.min(w, h) * (adj.thickness ?? 0.2) }],
      setAdjustmentFromPoint: (w, h, adj, id, lx) => {
        adj.thickness = Math.max(0.05, Math.min(0.45, lx / Math.min(w, h)));
      },
      generatePath: (w, h, adj) => {
        const t = Math.min(w, h) * (adj?.thickness ?? 0.2);
        return `M 0 0 L ${w} 0 L ${w} ${h} L 0 ${h} Z M ${t} ${t} L ${t} ${h - t} L ${w - t} ${h - t} L ${w - t} ${t} Z`;
      }
    },

    l_shape: {
      name: "L字形",
      category: "basic",
      defaultAdjustments: { thicknessX: 0.35, thicknessY: 0.35 },
      getAdjustmentHandles: (w, h, adj) => [{ id: "thickness", x: w * (adj.thicknessX ?? 0.35), y: h * (1 - (adj.thicknessY ?? 0.35)) }],
      setAdjustmentFromPoint: (w, h, adj, id, lx, ly) => {
        adj.thicknessX = Math.max(0.1, Math.min(0.85, lx / w));
        adj.thicknessY = Math.max(0.1, Math.min(0.85, (h - ly) / h));
      },
      generatePath: (w, h, adj) => {
        const tx = w * (adj?.thicknessX ?? 0.35);
        const ty = h * (adj?.thicknessY ?? 0.35);
        return `M 0 0 L ${tx} 0 L ${tx} ${h - ty} L ${w} ${h - ty} L ${w} ${h} L 0 ${h} Z`;
      },
      toPathPoints: (w, h, adj) => {
        const tx = w * (adj?.thicknessX ?? 0.35);
        const ty = h * (adj?.thicknessY ?? 0.35);
        return [
          { x: 0, y: 0, type: "corner" }, { x: tx, y: 0, type: "corner" },
          { x: tx, y: h - ty, type: "corner" }, { x: w, y: h - ty, type: "corner" },
          { x: w, y: h, type: "corner" }, { x: 0, y: h, type: "corner" }
        ];
      }
    },

    moon: {
      name: "三日月",
      category: "basic",
      defaultAdjustments: { offset: 0.4 },
      getAdjustmentHandles: (w, h, adj) => [{ id: "offset", x: w * (adj.offset ?? 0.4), y: h / 2 }],
      setAdjustmentFromPoint: (w, h, adj, id, lx) => {
        adj.offset = Math.max(0.1, Math.min(0.85, lx / w));
      },
      generatePath: (w, h, adj) => {
        const off = w * (adj?.offset ?? 0.4);
        return `M ${w * 0.75} 0 A ${w * 0.75} ${h / 2} 0 1 0 ${w * 0.75} ${h} Q ${off} ${h / 2} ${w * 0.75} 0 Z`;
      }
    },

    cloud: {
      name: "雲",
      category: "basic",
      defaultAdjustments: {},
      getAdjustmentHandles: () => [],
      setAdjustmentFromPoint: () => {},
      generatePath: (w, h) => {
        return `M ${w * 0.25} ${h * 0.85} C ${w * 0.05} ${h * 0.85} 0 ${h * 0.6} ${w * 0.15} ${h * 0.45} C ${w * 0.1} ${h * 0.25} ${w * 0.3} ${h * 0.1} ${w * 0.45} ${h * 0.2} C ${w * 0.55} ${h * 0.05} ${w * 0.8} ${h * 0.1} ${w * 0.82} ${h * 0.35} C ${w * 1.0} ${h * 0.4} ${w * 1.0} ${h * 0.85} ${w * 0.78} ${h * 0.85} Z`;
      }
    },

    drop: {
      name: "しずく",
      category: "basic",
      defaultAdjustments: {},
      getAdjustmentHandles: () => [],
      setAdjustmentFromPoint: () => {},
      generatePath: (w, h) => {
        return `M ${w / 2} 0 C ${w * 0.9} ${h * 0.5} ${w} ${h * 0.7} ${w} ${h * 0.75} A ${w / 2} ${h * 0.25} 0 1 1 0 ${h * 0.75} C 0 ${h * 0.7} ${w * 0.1} ${h * 0.5} ${w / 2} 0 Z`;
      }
    },

    // --- 追加矢印系 ---
    up_arrow: {
      name: "上矢印",
      category: "arrows",
      defaultAdjustments: { headLength: 0.35, shaftWidth: 0.35 },
      getAdjustmentHandles: (w, h, adj) => [{ id: "headLength", x: (w - w * (adj.shaftWidth ?? 0.35)) / 2, y: h * (adj.headLength ?? 0.35) }],
      setAdjustmentFromPoint: (w, h, adj, id, lx, ly) => {
        adj.headLength = Math.max(0.1, Math.min(0.8, ly / h));
      },
      generatePath: (w, h, adj) => {
        const hl = h * (adj?.headLength ?? 0.35);
        const sw = w * (adj?.shaftWidth ?? 0.35);
        const x1 = (w - sw) / 2, x2 = (w + sw) / 2;
        return `M ${w / 2} 0 L ${w} ${hl} L ${x2} ${hl} L ${x2} ${h} L ${x1} ${h} L ${x1} ${hl} L 0 ${hl} Z`;
      }
    },

    down_arrow: {
      name: "下矢印",
      category: "arrows",
      defaultAdjustments: { headLength: 0.35, shaftWidth: 0.35 },
      getAdjustmentHandles: (w, h, adj) => [{ id: "headLength", x: (w - w * (adj.shaftWidth ?? 0.35)) / 2, y: h * (1 - (adj.headLength ?? 0.35)) }],
      setAdjustmentFromPoint: (w, h, adj, id, lx, ly) => {
        adj.headLength = Math.max(0.1, Math.min(0.8, (h - ly) / h));
      },
      generatePath: (w, h, adj) => {
        const hl = h * (adj?.headLength ?? 0.35);
        const sw = w * (adj?.shaftWidth ?? 0.35);
        const x1 = (w - sw) / 2, x2 = (w + sw) / 2;
        return `M ${x1} 0 L ${x2} 0 L ${x2} ${h - hl} L ${w} ${h - hl} L ${w / 2} ${h} L 0 ${h - hl} L ${x1} ${h - hl} Z`;
      }
    },

    up_down_arrow: {
      name: "上下両方向矢印",
      category: "arrows",
      defaultAdjustments: { headLength: 0.25, shaftWidth: 0.35 },
      getAdjustmentHandles: (w, h, adj) => [{ id: "headLength", x: (w - w * (adj.shaftWidth ?? 0.35)) / 2, y: h * (adj.headLength ?? 0.25) }],
      setAdjustmentFromPoint: (w, h, adj, id, lx, ly) => {
        adj.headLength = Math.max(0.1, Math.min(0.45, ly / h));
      },
      generatePath: (w, h, adj) => {
        const hl = h * (adj?.headLength ?? 0.25);
        const sw = w * (adj?.shaftWidth ?? 0.35);
        const x1 = (w - sw) / 2, x2 = (w + sw) / 2;
        return `M ${w / 2} 0 L ${w} ${hl} L ${x2} ${hl} L ${x2} ${h - hl} L ${w} ${h - hl} L ${w / 2} ${h} L 0 ${h - hl} L ${x1} ${h - hl} L ${x1} ${hl} L 0 ${hl} Z`;
      }
    },

    quad_arrow: {
      name: "4方向矢印",
      category: "arrows",
      defaultAdjustments: { headSize: 0.22, shaftWidth: 0.2 },
      getAdjustmentHandles: () => [],
      setAdjustmentFromPoint: () => {},
      generatePath: (w, h, adj) => {
        const hs = Math.min(w, h) * (adj?.headSize ?? 0.22);
        const sw = Math.min(w, h) * (adj?.shaftWidth ?? 0.2);
        const cx = w / 2, cy = h / 2, half = sw / 2;
        return `M ${cx} 0 L ${cx + hs} ${hs} L ${cx + half} ${hs} L ${cx + half} ${cy - half} L ${w - hs} ${cy - half} L ${w - hs} ${cy - hs} L ${w} ${cy} L ${w - hs} ${cy + hs} L ${w - hs} ${cy + half} L ${cx + half} ${cy + half} L ${cx + half} ${h - hs} L ${cx + hs} ${h - hs} L ${cx} ${h} L ${cx - hs} ${h - hs} L ${cx - half} ${h - hs} L ${cx - half} ${cy + half} L ${hs} ${cy + half} L ${hs} ${cy + hs} L 0 ${cy} L ${hs} ${cy - hs} L ${hs} ${cy - half} L ${cx - half} ${cy - half} L ${cx - half} ${hs} L ${cx - hs} ${hs} Z`;
      }
    },

    pentagon_arrow: {
      name: "ホームベース矢印",
      category: "arrows",
      defaultAdjustments: { tip: 0.25 },
      getAdjustmentHandles: (w, h, adj) => [{ id: "tip", x: w * (1 - (adj.tip ?? 0.25)), y: 0 }],
      setAdjustmentFromPoint: (w, h, adj, id, lx) => {
        adj.tip = Math.max(0.05, Math.min(0.8, (w - lx) / w));
      },
      generatePath: (w, h, adj) => {
        const t = w * (adj?.tip ?? 0.25);
        return `M 0 0 L ${w - t} 0 L ${w} ${h / 2} L ${w - t} ${h} L 0 ${h} Z`;
      },
      toPathPoints: (w, h, adj) => {
        const t = w * (adj?.tip ?? 0.25);
        return [
          { x: 0, y: 0, type: "corner" }, { x: w - t, y: 0, type: "corner" },
          { x: w, y: h / 2, type: "corner" }, { x: w - t, y: h, type: "corner" },
          { x: 0, y: h, type: "corner" }
        ];
      }
    },

    notched_right_arrow: {
      name: "V字ノッチ右矢印",
      category: "arrows",
      defaultAdjustments: { headLength: 0.3, shaftWidth: 0.45, notch: 0.15 },
      getAdjustmentHandles: () => [],
      setAdjustmentFromPoint: () => {},
      generatePath: (w, h, adj) => {
        const hl = w * (adj?.headLength ?? 0.3);
        const sw = h * (adj?.shaftWidth ?? 0.45);
        const n = w * (adj?.notch ?? 0.15);
        const y1 = (h - sw) / 2, y2 = (h + sw) / 2;
        return `M 0 ${y1} L ${w - hl} ${y1} L ${w - hl} 0 L ${w} ${h / 2} L ${w - hl} ${h} L ${w - hl} ${y2} L 0 ${y2} L ${n} ${h / 2} Z`;
      }
    },

    // --- 追加星・リボン・タグ ---
    star12: {
      name: "12方向の星",
      category: "stars",
      defaultAdjustments: { innerRadiusRatio: 0.72 },
      getAdjustmentHandles: (w, h, adj) => {
        const rx = w / 2, ry = h / 2, ir = adj.innerRadiusRatio ?? 0.72;
        const a = -PI / 2 + PI / 12;
        return [{ id: "innerRadius", x: rx + rx * ir * Math.cos(a), y: ry + ry * ir * Math.sin(a) }];
      },
      setAdjustmentFromPoint: (w, h, adj, id, lx, ly) => {
        adj.innerRadiusRatio = Math.max(0.2, Math.min(0.92, Math.hypot((lx - w / 2) / (w / 2), (ly - h / 2) / (h / 2))));
      },
      generatePath: (w, h, adj) => generateNStarPath(w, h, 12, adj?.innerRadiusRatio ?? 0.72),
      toPathPoints: (w, h, adj) => generateNStarPoints(w, h, 12, adj?.innerRadiusRatio ?? 0.72)
    },

    star16: {
      name: "16角バッジ(爆発)",
      category: "stars",
      defaultAdjustments: { innerRadiusRatio: 0.8 },
      getAdjustmentHandles: (w, h, adj) => {
        const rx = w / 2, ry = h / 2, ir = adj.innerRadiusRatio ?? 0.8;
        const a = -PI / 2 + PI / 16;
        return [{ id: "innerRadius", x: rx + rx * ir * Math.cos(a), y: ry + ry * ir * Math.sin(a) }];
      },
      setAdjustmentFromPoint: (w, h, adj, id, lx, ly) => {
        adj.innerRadiusRatio = Math.max(0.2, Math.min(0.95, Math.hypot((lx - w / 2) / (w / 2), (ly - h / 2) / (h / 2))));
      },
      generatePath: (w, h, adj) => generateNStarPath(w, h, 16, adj?.innerRadiusRatio ?? 0.8),
      toPathPoints: (w, h, adj) => generateNStarPoints(w, h, 16, adj?.innerRadiusRatio ?? 0.8)
    },

    ribbon_banner: {
      name: "リボン・バナー",
      category: "stars",
      defaultAdjustments: { cut: 0.15 },
      getAdjustmentHandles: (w, h, adj) => [{ id: "cut", x: w * (adj.cut ?? 0.15), y: h / 2 }],
      setAdjustmentFromPoint: (w, h, adj, id, lx) => {
        adj.cut = Math.max(0.05, Math.min(0.4, lx / w));
      },
      generatePath: (w, h, adj) => {
        const c = w * (adj?.cut ?? 0.15);
        return `M 0 0 L ${w} 0 L ${w - c} ${h / 2} L ${w} ${h} L 0 ${h} L ${c} ${h / 2} Z`;
      }
    },

    tag_badge: {
      name: "タグ・値札",
      category: "stars",
      defaultAdjustments: {},
      getAdjustmentHandles: () => [],
      setAdjustmentFromPoint: () => {},
      generatePath: (w, h) => {
        const r = Math.min(w, h) * 0.08;
        const cx = w * 0.22, cy = h / 2;
        return `M ${w * 0.25} 0 L ${w} 0 L ${w} ${h} L ${w * 0.25} ${h} L 0 ${h / 2} Z M ${cx - r} ${cy} A ${r} ${r} 0 1 0 ${cx + r} ${cy} A ${r} ${r} 0 1 0 ${cx - r} ${cy} Z`;
      }
    },

    bookmark_ribbon: {
      name: "しおり・縦リボン",
      category: "stars",
      defaultAdjustments: { cut: 0.22 },
      getAdjustmentHandles: (w, h, adj) => [{ id: "cut", x: w / 2, y: h * (1 - (adj.cut ?? 0.22)) }],
      setAdjustmentFromPoint: (w, h, adj, id, lx, ly) => {
        adj.cut = Math.max(0.05, Math.min(0.6, (h - ly) / h));
      },
      generatePath: (w, h, adj) => {
        const c = h * (adj?.cut ?? 0.22);
        return `M 0 0 L ${w} 0 L ${w} ${h} L ${w / 2} ${h - c} L 0 ${h} Z`;
      }
    },

    // --- 6. フローチャート ---
    flow_terminator: {
      name: "端子(開始/終了)",
      category: "flowchart",
      defaultAdjustments: {},
      getAdjustmentHandles: () => [],
      setAdjustmentFromPoint: () => {},
      generatePath: (w, h) => {
        const r = Math.min(w, h) * 0.45;
        return `M ${r} 0 L ${w - r} 0 Q ${w} 0 ${w} ${h / 2} Q ${w} ${h} ${w - r} ${h} L ${r} ${h} Q 0 ${h} 0 ${h / 2} Q 0 0 ${r} 0 Z`;
      }
    },

    flow_document: {
      name: "書類(ドキュメント)",
      category: "flowchart",
      defaultAdjustments: {},
      getAdjustmentHandles: () => [],
      setAdjustmentFromPoint: () => {},
      generatePath: (w, h) => {
        return `M 0 0 L ${w} 0 L ${w} ${h * 0.85} Q ${w * 0.75} ${h * 0.7} ${w / 2} ${h * 0.85} Q ${w * 0.25} ${h * 1.0} 0 ${h * 0.85} Z`;
      }
    },

    flow_database: {
      name: "データベース(円柱)",
      category: "flowchart",
      defaultAdjustments: {},
      getAdjustmentHandles: () => [],
      setAdjustmentFromPoint: () => {},
      generatePath: (w, h) => {
        const ry = h * 0.16;
        return `M 0 ${ry} A ${w / 2} ${ry} 0 1 1 ${w} ${ry} A ${w / 2} ${ry} 0 1 1 0 ${ry} M 0 ${ry} L 0 ${h - ry} A ${w / 2} ${ry} 0 0 0 ${w} ${h - ry} L ${w} ${ry}`;
      }
    }
  };

  // 正多角形のパス生成
  function generateRegularPolygonPath(w, h, sides) {
    const pts = generateRegularPolygonPoints(w, h, sides);
    return pts.map((p, i) => (i === 0 ? "M " : "L ") + `${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" ") + " Z";
  }

  function generateRegularPolygonPoints(w, h, sides) {
    const rx = w / 2, ry = h / 2;
    const pts = [];
    for (let i = 0; i < sides; i++) {
      const a = -PI / 2 + (2 * PI * i) / sides;
      pts.push({
        x: rx + rx * Math.cos(a),
        y: ry + ry * Math.sin(a),
        type: "corner"
      });
    }
    return pts;
  }

  // N角星のパス生成汎用関数
  function generateNStarPath(w, h, pointsCount, innerRatio) {
    const rx = w / 2, ry = h / 2;
    const step = PI / pointsCount;
    let path = "";
    for (let i = 0; i < 2 * pointsCount; i++) {
      const angle = -PI / 2 + i * step;
      const rRatio = (i % 2 === 0) ? 1.0 : innerRatio;
      const x = rx + rx * rRatio * Math.cos(angle);
      const y = ry + ry * rRatio * Math.sin(angle);
      path += (i === 0 ? "M " : "L ") + `${x.toFixed(2)} ${y.toFixed(2)} `;
    }
    path += "Z";
    return path;
  }

  function generateNStarPoints(w, h, pointsCount, innerRatio) {
    const rx = w / 2, ry = h / 2;
    const step = PI / pointsCount;
    const pts = [];
    for (let i = 0; i < 2 * pointsCount; i++) {
      const angle = -PI / 2 + i * step;
      const rRatio = (i % 2 === 0) ? 1.0 : innerRatio;
      pts.push({
        x: rx + rx * rRatio * Math.cos(angle),
        y: ry + ry * rRatio * Math.sin(angle),
        type: "corner"
      });
    }
    return pts;
  }

  return {
    definitions,
    getDefinition: (type) => definitions[type] || definitions.rect,
    getAllDefinitions: () => Object.entries(definitions).map(([id, def]) => ({ id, ...def }))
  };
})();
