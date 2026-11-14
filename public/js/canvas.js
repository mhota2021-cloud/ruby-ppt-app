// public/js/canvas.js
// スライドキャンバス描画、ドラッグ＆ドロップ、8方向変形、回転、黄色調整、頂点編集

class PPTCanvas {
  constructor(canvasElement) {
    this.canvas = canvasElement;
    this.ctx = this.canvas.getContext("2d", { willReadFrequently: true });

    // スライド基本設定
    this.width = 960;
    this.height = 540;
    this.backgroundColor = "#ffffff";
    this.zoom = 1.0;
    this.showGrid = true;
    this.snapToGrid = false;
    this.gridSize = 20;

    // オブジェクト一覧
    this.shapes = [];
    this.selectedShapeIds = new Set();
    this.hoveredHandle = null;

    // 編集モード: "select" | "edit_points" | "create_frame"
    this.mode = "select";
    this.activePointIndex = null;
    this.activeHandleType = null; // "anchor" | "hIn" | "hOut"

    // ドラッグ・範囲選択・ドロップ・Figma操作状態
    this.dragState = null;
    this.marqueeRect = null;
    this.frameDraftRect = null;
    this.dropTargetFrameId = null;
    this.dropInsertionIndicator = null; // { frameId, index, x1, y1, x2, y2 }
    this.smartGuides = [];              // [{ type: "v"|"h", pos, start, end }]
    this.enteredContainerId = null;     // FigmaのEnter階層スコープ
    this.activeSpacingHover = null;     // { frameId, kind, index }
    this.activeSpacingDrag = null;      // { frameId, kind, value }
    this.clipboard = null;              // { subtrees, pasteCount, lastPastedIds }

    // 履歴スタック (アンドゥ / リドゥ)
    this.history = [];
    this.historyIndex = -1;

    // 初期サイズ適用
    this.updateCanvasDimensions();
    this.saveState();
  }

  updateCanvasDimensions() {
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this.canvas.style.width = `${this.width * this.zoom}px`;
    this.canvas.style.height = `${this.height * this.zoom}px`;
    this.render();
  }

  setCanvasSize(newWidth, newHeight) {
    const w = Math.max(50, Math.min(3840, Math.round(newWidth) || 960));
    const h = Math.max(50, Math.min(3840, Math.round(newHeight) || 540));
    if (w === this.width && h === this.height) return;
    this.width = w;
    this.height = h;
    this.updateCanvasDimensions();
    this.saveState();
    this.onDimensionChange && this.onDimensionChange();
  }

  setZoom(zoomVal) {
    this.zoom = Math.max(0.2, Math.min(3.0, zoomVal));
    this.updateCanvasDimensions();
  }

  // --- 履歴管理 ---
  saveState() {
    if (this._saveStateTimer) {
      clearTimeout(this._saveStateTimer);
      this._saveStateTimer = null;
    }
    // 現在の履歴以降を切り捨て
    if (this.historyIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.historyIndex + 1);
    }
    const snapshot = JSON.stringify({
      width: this.width,
      height: this.height,
      backgroundColor: this.backgroundColor,
      shapes: this.shapes
    });
    if (this.history.length > 0 && this.history[this.history.length - 1] === snapshot) {
      return;
    }
    this.history.push(snapshot);
    if (this.history.length > 50) this.history.shift();
    this.historyIndex = this.history.length - 1;
    this.onStateChange && this.onStateChange();
  }

  saveStateDebounced(delay = 350) {
    if (this._saveStateTimer) clearTimeout(this._saveStateTimer);
    this._saveStateTimer = setTimeout(() => {
      this._saveStateTimer = null;
      this.saveState();
    }, delay);
  }

  flushDebouncedSaveState() {
    if (this._saveStateTimer) {
      clearTimeout(this._saveStateTimer);
      this._saveStateTimer = null;
      this.saveState();
    }
  }

  undo() {
    if (this.historyIndex > 0) {
      this.historyIndex--;
      this.loadSnapshot(this.history[this.historyIndex]);
    }
  }

  redo() {
    if (this.historyIndex < this.history.length - 1) {
      this.historyIndex++;
      this.loadSnapshot(this.history[this.historyIndex]);
    }
  }

  loadSnapshot(jsonStr) {
    const data = JSON.parse(jsonStr);
    this.width = data.width;
    this.height = data.height;
    this.backgroundColor = data.backgroundColor;
    this.shapes = data.shapes || [];
    this.normalizeHierarchy();
    this.selectedShapeIds.clear();
    this.enteredContainerId = null;
    this.updateCanvasDimensions();
    this.onDimensionChange && this.onDimensionChange();
    this.onSelectionChange && this.onSelectionChange();
    this.onStateChange && this.onStateChange();
  }

  // --- 図形追加 ---
  addShape(type, options = {}) {
    const id = "shape_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
    const def = ShapeDefinitions.getDefinition(type);

    const fallbackW = type === "text" ? 240
      : (type === "frame" ? 320
      : (type === "math_plot" ? Math.min(320, Math.max(80, this.width - 40)) : 160));
    const defaultWidth = (options.width !== undefined && options.width !== null) ? options.width : fallbackW;

    const fallbackH = type === "text" ? 60
      : (type === "frame" ? 220
      : (type === "math_plot" ? Math.min(Math.round(defaultWidth * 0.75), Math.max(60, this.height - 40)) : 120));
    const defaultHeight = (options.height !== undefined && options.height !== null) ? options.height : fallbackH;

    // スライド中央に配置
    const x = options.x !== undefined ? options.x : Math.round((this.width - defaultWidth) / 2 + (Math.random() * 40 - 20));
    const y = options.y !== undefined ? options.y : Math.round((this.height - defaultHeight) / 2 + (Math.random() * 40 - 20));

    const newShape = {
      id,
      type,
      parentId: options.parentId || null,
      name: options.name || (window.I18N ? window.I18N.shapeName(type, def ? def.name : undefined) : (type === "math_plot" ? "関数グラフ" : (type === "frame" ? "フレーム" : (def ? def.name : "図形")))),
      x,
      y,
      width: defaultWidth,
      height: defaultHeight,
      rotation: 0,
      flipH: false,
      flipV: false,
      shearX: 0,
      shearY: 0,
      fill: options.fill || (type === "text" ? "#1e293b" : "#3b82f6"),
      fillOpacity: options.fillOpacity ?? 1.0,
      stroke: (options.stroke !== undefined && options.stroke !== null) ? options.stroke : "none",
      strokeWidth: (options.strokeWidth !== undefined && options.strokeWidth !== null) ? options.strokeWidth : 0,
      strokeDash: options.strokeDash || "solid", // solid, dashed, dotted
      shadow: options.shadow ?? false,
      shadowColor: options.shadowColor || "rgba(0,0,0,0.3)",
      shadowBlur: options.shadowBlur || 8,
      shadowOffsetX: options.shadowOffsetX || 4,
      shadowOffsetY: options.shadowOffsetY || 4,

      // テキスト専用プロパティ
      text: type === "text" ? (options.text || (window.I18N ? window.I18N.t("canvas.defaultText") : "テキストを入力")) : "",
      fontSize: options.fontSize || 28,
      fontFamily: options.fontFamily || "Segoe UI, Meiryo, sans-serif",
      fontWeight: options.fontWeight || "normal",
      fontStyle: options.fontStyle || "normal",
      textAlign: options.textAlign || "center",
      textWarp: options.textWarp || "none",

      // パワポ黄色調整ハンドル値
      adjustments: def && def.defaultAdjustments ? { ...def.defaultAdjustments } : {},

      // 頂点の編集用
      points: null,
      isPathClosed: true,

      // Figma互換プロパティ
      visible: options.visible !== undefined ? !!options.visible : true,
      locked: options.locked !== undefined ? !!options.locked : false,
      layoutPositioning: options.layoutPositioning || "auto", // "auto" | "absolute"
      constraints: options.constraints
        ? { horizontal: "left", vertical: "top", ...options.constraints }
        : { horizontal: "left", vertical: "top" },
      minWidth: options.minWidth ?? null,
      maxWidth: options.maxWidth ?? null,
      minHeight: options.minHeight ?? null,
      maxHeight: options.maxHeight ?? null
    };

    if (options.points) newShape.points = options.points;
    if (options.isPathClosed !== undefined) newShape.isPathClosed = options.isPathClosed;
    if (options.mathConfig) newShape.mathConfig = options.mathConfig;
    if (options.mathData) newShape.mathData = options.mathData;
    if (options.layoutSizingH) newShape.layoutSizingH = options.layoutSizingH;
    if (options.layoutSizingV) newShape.layoutSizingV = options.layoutSizingV;
    if (type === "frame") {
      newShape.cornerRadius = options.cornerRadius ?? 0;
      newShape.clipContent = options.clipContent ?? false;
      newShape.autoLayout = this.createDefaultAutoLayoutConfig(options.autoLayout || {});
    }

    this.shapes.push(newShape);
    this.normalizeHierarchy();
    if (newShape.parentId) {
      this.applyAutoLayout(newShape.parentId);
    }
    this.selectShape(id);
    this.saveState();
    this.render();
    return newShape;
  }

  // --- フレーム・階層・オートレイアウト管理 ---
  createDefaultAutoLayoutConfig(overrides = {}) {
    return {
      enabled: false,
      direction: "row", // "row" | "column" | "wrap"
      gapMode: "fixed", // "fixed" | "auto" (Space between)
      gap: 12,
      crossGap: null,   // nullならgap(非負)と同値、wrap時の行間
      paddingTop: 16,
      paddingRight: 16,
      paddingBottom: 16,
      paddingLeft: 16,
      align: "top-left", // 9方向: top/center/bottom + left/center/right ("center"は中央中央)
      sizingH: "hug", // "hug" | "fixed"
      sizingV: "hug", // "hug" | "fixed"
      canvasStacking: "last-on-top", // "last-on-top" | "first-on-top"
      ...overrides
    };
  }

  static getRenderOrderedShapes(shapesList) {
    if (!Array.isArray(shapesList) || shapesList.length === 0) return [];
    const byId = new Map();
    const childrenByParent = new Map();
    shapesList.forEach(s => {
      if (s && s.id != null) byId.set(s.id, s);
      const pid = (s && s.parentId) || null;
      if (!childrenByParent.has(pid)) childrenByParent.set(pid, []);
      childrenByParent.get(pid).push(s);
    });

    const ordered = [];
    const visited = new Set();
    const walk = (s) => {
      if (!s) return;
      const key = s.id != null ? s.id : s;
      if (visited.has(key)) return;
      visited.add(key);
      ordered.push(s);
      if (s.type === "frame" && s.id != null) {
        let kids = childrenByParent.get(s.id) || [];
        if (s.autoLayout && s.autoLayout.enabled && s.autoLayout.canvasStacking === "first-on-top") {
          kids = [...kids].reverse();
        }
        kids.forEach(walk);
      }
    };

    const topLevel = childrenByParent.get(null) || [];
    topLevel.forEach(walk);
    shapesList.forEach(s => {
      if (!s) return;
      const key = s.id != null ? s.id : s;
      if (!visited.has(key)) walk(s);
    });
    return ordered;
  }

  getRenderOrderedShapes() {
    return PPTCanvas.getRenderOrderedShapes(this.shapes);
  }

  isEffectivelyVisible(shape) {
    let cur = shape;
    const seen = new Set();
    while (cur && !seen.has(cur.id)) {
      if (cur.visible === false) return false;
      seen.add(cur.id);
      if (!cur.parentId) break;
      cur = this.getShapeById(cur.parentId);
    }
    return true;
  }

  isEffectivelyLocked(shape) {
    let cur = shape;
    const seen = new Set();
    while (cur && !seen.has(cur.id)) {
      if (cur.locked === true) return true;
      seen.add(cur.id);
      if (!cur.parentId) break;
      cur = this.getShapeById(cur.parentId);
    }
    return false;
  }

  getShapeById(id) {
    return this.shapes.find(s => s.id === id) || null;
  }

  getChildren(frameId) {
    return this.shapes.filter(s => s.parentId === frameId);
  }

  isDescendant(candidateId, ancestorId) {
    let cur = this.getShapeById(candidateId);
    const seen = new Set();
    while (cur && cur.parentId) {
      if (cur.parentId === ancestorId) return true;
      if (seen.has(cur.parentId)) break;
      seen.add(cur.parentId);
      cur = this.getShapeById(cur.parentId);
    }
    return false;
  }

  getDescendants(frameId) {
    const result = [];
    const seen = new Set([frameId]);
    const walk = (pid) => {
      this.shapes.forEach(s => {
        if (s.parentId === pid && !seen.has(s.id)) {
          seen.add(s.id);
          result.push(s);
          if (s.type === "frame") walk(s.id);
        }
      });
    };
    walk(frameId);
    return result;
  }

  getEffectiveRootIds(idSet) {
    const roots = [];
    idSet.forEach(id => {
      let cur = this.getShapeById(id);
      if (!cur) return;
      let hasSelectedAncestor = false;
      const seen = new Set([id]);
      while (cur.parentId && !seen.has(cur.parentId)) {
        if (idSet.has(cur.parentId)) {
          hasSelectedAncestor = true;
          break;
        }
        seen.add(cur.parentId);
        cur = this.getShapeById(cur.parentId);
        if (!cur) break;
      }
      if (!hasSelectedAncestor) roots.push(id);
    });
    return roots;
  }

  moveShapeWithDescendants(shape, dx, dy, visited = new Set()) {
    if (!shape || visited.has(shape.id)) return;
    visited.add(shape.id);
    shape.x += dx;
    shape.y += dy;
    if (shape.type === "frame") {
      this.getChildren(shape.id).forEach(child => {
        this.moveShapeWithDescendants(child, dx, dy, visited);
      });
    }
  }

  normalizeHierarchy() {
    const byId = new Map();
    this.shapes.forEach(s => {
      byId.set(s.id, s);
      if (s.visible === undefined) s.visible = true;
      if (s.locked === undefined) s.locked = false;
      if (!s.layoutPositioning) s.layoutPositioning = "auto";
      if (!s.constraints || typeof s.constraints !== "object") {
        s.constraints = { horizontal: "left", vertical: "top" };
      } else {
        if (!s.constraints.horizontal) s.constraints.horizontal = "left";
        if (!s.constraints.vertical) s.constraints.vertical = "top";
      }
      if (s.type === "frame") {
        s.autoLayout = this.createDefaultAutoLayoutConfig(s.autoLayout || {});
      }
    });

    // 存在しない親または非フレーム親や循環を解除
    this.shapes.forEach(s => {
      if (!s.parentId) {
        s.parentId = null;
        return;
      }
      const p = byId.get(s.parentId);
      if (!p || p.type !== "frame" || p.id === s.id) {
        s.parentId = null;
        return;
      }
      const seen = new Set([s.id]);
      let cur = p;
      while (cur && cur.parentId) {
        if (seen.has(cur.parentId)) {
          s.parentId = null;
          break;
        }
        seen.add(cur.parentId);
        cur = byId.get(cur.parentId);
      }
    });

    const ordered = [];
    const added = new Set();
    const visit = (s) => {
      if (added.has(s.id)) return;
      added.add(s.id);
      ordered.push(s);
      if (s.type === "frame") {
        this.shapes.forEach(child => {
          if (child.parentId === s.id) visit(child);
        });
      }
    };

    this.shapes.forEach(s => {
      if (!s.parentId) visit(s);
    });
    this.shapes.forEach(s => {
      if (!added.has(s.id)) {
        s.parentId = null;
        visit(s);
      }
    });
    this.shapes = ordered;
  }

  nextFrameName() {
    const count = this.shapes.filter(s => s.type === "frame").length + 1;
    const base = window.I18N ? window.I18N.t("shape.frame") : "フレーム";
    return `${base} ${count}`;
  }

  addFrame(options = {}) {
    return this.addShape("frame", {
      name: options.name || this.nextFrameName(),
      fill: options.fill !== undefined ? options.fill : "#ffffff",
      fillOpacity: options.fillOpacity !== undefined ? options.fillOpacity : 1.0,
      stroke: options.stroke !== undefined ? options.stroke : "#cbd5e1",
      strokeWidth: options.strokeWidth !== undefined ? options.strokeWidth : 1,
      width: options.width || 320,
      height: options.height || 220,
      ...options
    });
  }

  frameSelected(enableAutoLayout = false) {
    const hasSelection = this.selectedShapeIds.size > 0;
    const rootIds = this.getEffectiveRootIds(this.selectedShapeIds);
    const targets = rootIds.map(id => this.getShapeById(id)).filter(t => t && !this.isEffectivelyLocked(t));

    if (targets.length === 0) {
      if (hasSelection) return null;
      return this.addFrame({
        autoLayout: enableAutoLayout ? { enabled: true } : {}
      });
    }

    // 共通の親があるか判定
    const firstParent = targets[0].parentId || null;
    const commonParent = targets.every(t => (t.parentId || null) === firstParent) ? firstParent : null;

    // 外接矩形算出
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    targets.forEach(t => {
      minX = Math.min(minX, t.x);
      minY = Math.min(minY, t.y);
      maxX = Math.max(maxX, t.x + t.width);
      maxY = Math.max(maxY, t.y + t.height);
    });

    const pad = enableAutoLayout ? 16 : 0;
    const frameId = "shape_" + Date.now() + "_" + Math.floor(Math.random() * 1000);

    // オートレイアウト有効化時は子要素の配置から向き・間隔を推定
    let alOverrides = {};
    if (enableAutoLayout) {
      let direction = "row";
      let gap = 12;
      if (targets.length >= 2) {
        const spanX = maxX - minX;
        const spanY = maxY - minY;
        const avgW = targets.reduce((sum, t) => sum + t.width, 0) / targets.length;
        const avgH = targets.reduce((sum, t) => sum + t.height, 0) / targets.length;
        // 平均サイズに対する広がり比で横/縦を判定
        if ((spanY - avgH) > (spanX - avgW)) {
          direction = "column";
        }
        const sorted = [...targets].sort((a, b) => direction === "row" ? a.x - b.x : a.y - b.y);
        const gaps = [];
        for (let i = 1; i < sorted.length; i++) {
          const prevEnd = direction === "row" ? (sorted[i - 1].x + sorted[i - 1].width) : (sorted[i - 1].y + sorted[i - 1].height);
          const curStart = direction === "row" ? sorted[i].x : sorted[i].y;
          const d = Math.round(curStart - prevEnd);
          if (d >= 0) gaps.push(d);
        }
        if (gaps.length > 0) {
          gap = Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length);
        }
        // 並び順を座標順に揃える
        const sortedIds = sorted.map(t => t.id);
        const targetSet = new Set(sortedIds);
        let idxCursor = 0;
        const nextShapes = [];
        this.shapes.forEach(s => {
          if (targetSet.has(s.id)) {
            if (idxCursor === 0) {
              sorted.forEach(st => nextShapes.push(st));
              idxCursor = 1;
            }
          } else {
            nextShapes.push(s);
          }
        });
        this.shapes = nextShapes;
      }
      alOverrides = { enabled: true, direction, gap, paddingTop: pad, paddingRight: pad, paddingBottom: pad, paddingLeft: pad };
    }

    const frame = {
      id: frameId,
      type: "frame",
      parentId: commonParent,
      name: this.nextFrameName(),
      x: Math.round(minX - pad),
      y: Math.round(minY - pad),
      width: Math.max(40, Math.round(maxX - minX + pad * 2)),
      height: Math.max(40, Math.round(maxY - minY + pad * 2)),
      rotation: 0,
      flipH: false,
      flipV: false,
      shearX: 0,
      shearY: 0,
      fill: "transparent",
      fillOpacity: 1.0,
      stroke: "#cbd5e1",
      strokeWidth: 1,
      strokeDash: "solid",
      shadow: false,
      shadowColor: "rgba(0,0,0,0.3)",
      shadowBlur: 8,
      shadowOffsetX: 4,
      shadowOffsetY: 4,
      text: "",
      fontSize: 28,
      fontFamily: "Segoe UI, Meiryo, sans-serif",
      fontWeight: "normal",
      fontStyle: "normal",
      textAlign: "center",
      textWarp: "none",
      adjustments: {},
      points: null,
      isPathClosed: true,
      visible: true,
      locked: false,
      layoutPositioning: "auto",
      constraints: { horizontal: "left", vertical: "top" },
      minWidth: null,
      maxWidth: null,
      minHeight: null,
      maxHeight: null,
      cornerRadius: 0,
      clipContent: false,
      autoLayout: this.createDefaultAutoLayoutConfig(alOverrides)
    };

    const firstIdx = Math.min(...targets.map(t => this.shapes.indexOf(t)).filter(i => i >= 0));
    this.shapes.splice(Math.max(0, firstIdx), 0, frame);
    targets.forEach(t => {
      t.parentId = frameId;
    });

    this.normalizeHierarchy();
    if (enableAutoLayout) {
      this.applyAutoLayout(frameId);
    } else if (commonParent) {
      this.applyAutoLayout(commonParent);
    }
    this.selectedShapeIds = new Set([frameId]);
    this.saveState();
    this.render();
    this.onSelectionChange && this.onSelectionChange();
    return frame;
  }

  unframeSelected() {
    const selectedFrames = this.getSelectedShapes().filter(s => s.type === "frame" && !this.isEffectivelyLocked(s));
    if (selectedFrames.length === 0) return false;

    const removedIds = new Set(selectedFrames.map(f => f.id));
    const nextSelected = new Set();
    const affectedParents = new Set();

    selectedFrames.forEach(frame => {
      const parentOfFrame = frame.parentId || null;
      if (parentOfFrame && !removedIds.has(parentOfFrame)) {
        affectedParents.add(parentOfFrame);
      }
      this.getChildren(frame.id).forEach(child => {
        child.parentId = parentOfFrame;
        nextSelected.add(child.id);
      });
    });

    this.shapes = this.shapes.filter(s => !removedIds.has(s.id));
    this.normalizeHierarchy();
    affectedParents.forEach(pid => this.applyAutoLayout(pid));
    this.selectedShapeIds = nextSelected;
    this.saveState();
    this.render();
    this.onSelectionChange && this.onSelectionChange();
    return true;
  }

  toggleAutoLayoutSelected() {
    const selected = this.getSelectedShapes();
    if (selected.length === 1 && selected[0].type === "frame") {
      const frame = selected[0];
      if (this.isEffectivelyLocked(frame)) return;
      if (!frame.autoLayout) frame.autoLayout = this.createDefaultAutoLayoutConfig();
      const nextEnabled = !frame.autoLayout.enabled;
      frame.autoLayout.enabled = nextEnabled;
      if (nextEnabled) {
        const children = this.getChildren(frame.id);
        if (children.length >= 2) {
          const xs = children.map(c => c.x);
          const ys = children.map(c => c.y);
          const spanX = Math.max(...xs) - Math.min(...xs);
          const spanY = Math.max(...ys) - Math.min(...ys);
          frame.autoLayout.direction = spanY > spanX ? "column" : "row";
        }
        this.applyAutoLayout(frame.id);
      }
      this.saveState();
      this.render();
      this.onSelectionChange && this.onSelectionChange();
      return;
    }
    if (selected.length > 0 && selected.every(s => this.isEffectivelyLocked(s))) return;
    this.frameSelected(true);
  }

  removeFromParent(shapeId = null) {
    const rawTargets = shapeId ? [this.getShapeById(shapeId)].filter(Boolean) : this.getSelectedShapes();
    const targets = rawTargets.filter(s => !this.isEffectivelyLocked(s));
    const oldParents = new Set();
    let changed = false;
    targets.forEach(s => {
      if (!s.parentId) return;
      const oldPid = s.parentId;
      const parent = this.getShapeById(oldPid);
      s.parentId = parent ? (parent.parentId || null) : null;
      oldParents.add(oldPid);
      changed = true;
    });
    if (!changed) return;
    this.normalizeHierarchy();
    oldParents.forEach(pid => this.applyAutoLayout(pid));
    this.saveState();
    this.render();
    this.onSelectionChange && this.onSelectionChange();
  }

  reorderInParent(shapeId, delta) {
    const s = this.getShapeById(shapeId);
    if (!s || !s.parentId || this.isEffectivelyLocked(s)) return;
    const siblings = this.getChildren(s.parentId);
    const idx = siblings.indexOf(s);
    const nextIdx = idx + delta;
    if (idx < 0 || nextIdx < 0 || nextIdx >= siblings.length) return;

    const other = siblings[nextIdx];
    const i1 = this.shapes.indexOf(s);
    const i2 = this.shapes.indexOf(other);
    if (i1 < 0 || i2 < 0) return;
    this.shapes[i1] = other;
    this.shapes[i2] = s;

    this.normalizeHierarchy();
    this.applyAutoLayout(s.parentId);
    this.saveState();
    this.render();
    this.onSelectionChange && this.onSelectionChange();
  }

  propagateAutoLayoutFrom(shape) {
    if (!shape) return;
    if (shape.type === "frame" && shape.autoLayout && shape.autoLayout.enabled) {
      this.applyAutoLayout(shape.id);
    } else if (shape.parentId) {
      this.applyAutoLayout(shape.parentId);
    }
  }

  clampDimension(val, minV, maxV, fallbackMin = 5) {
    let v = Number.isFinite(val) ? val : fallbackMin;
    if (minV !== null && minV !== undefined && Number.isFinite(Number(minV)) && Number(minV) > 0) {
      v = Math.max(v, Number(minV));
    }
    if (maxV !== null && maxV !== undefined && Number.isFinite(Number(maxV)) && Number(maxV) > 0) {
      v = Math.min(v, Number(maxV));
    }
    return Math.max(fallbackMin, Math.round(v));
  }

  applyAutoLayout(frameId, visited = new Set(), options = {}) {
    if (!frameId || visited.has(frameId)) return;
    visited.add(frameId);

    const frame = this.getShapeById(frameId);
    if (!frame || frame.type !== "frame") return;

    const al = frame.autoLayout;
    if (!al || !al.enabled) {
      if (frame.parentId && !options.skipParent) this.applyAutoLayout(frame.parentId, visited);
      return;
    }

    const dir = al.direction || "row";
    const isAutoGap = (al.gapMode === "auto");
    const rawGap = Number.isFinite(Number(al.gap)) ? Number(al.gap) : 12;
    const hGap = isAutoGap ? 0 : rawGap;
    const vGap = (al.crossGap !== null && al.crossGap !== undefined && al.crossGap !== "" && Number.isFinite(Number(al.crossGap)))
      ? Number(al.crossGap)
      : Math.max(0, hGap);

    const pT = Math.max(0, Number(al.paddingTop) || 0);
    const pR = Math.max(0, Number(al.paddingRight) || 0);
    const pB = Math.max(0, Number(al.paddingBottom) || 0);
    const pL = Math.max(0, Number(al.paddingLeft) || 0);
    const sizingH = al.sizingH === "fixed" ? "fixed" : "hug";
    const sizingV = al.sizingV === "fixed" ? "fixed" : "hug";

    const align = al.align || "top-left";
    const alignV = align === "center" ? "center" : (align.startsWith("bottom") ? "bottom" : (align.startsWith("center-") ? "center" : "top"));
    const alignH = align === "center" ? "center" : (align.endsWith("right") ? "right" : (align.endsWith("-center") ? "center" : "left"));

    const allChildren = this.getChildren(frame.id);
    const flowChildren = allChildren.filter(c => c.visible !== false && c.layoutPositioning !== "absolute");

    if (flowChildren.length === 0) {
      if (sizingH === "hug") frame.width = this.clampDimension(pL + pR, frame.minWidth, frame.maxWidth, 40);
      if (sizingV === "hug") frame.height = this.clampDimension(pT + pB, frame.minHeight, frame.maxHeight, 40);
      if (frame.parentId && !options.skipParent) this.applyAutoLayout(frame.parentId, visited);
      return;
    }

    if (dir === "wrap") {
      const availW = Math.max(20, frame.width - pL - pR);
      const wrapStepGap = Math.max(0, hGap);
      const rows = [];
      let currentRow = [];
      let currentRowW = 0;

      flowChildren.forEach(c => {
        const w = this.clampDimension(c.width, c.minWidth, c.maxWidth, 5);
        const h = this.clampDimension(c.height, c.minHeight, c.maxHeight, 5);
        c.width = w;
        c.height = h;
        const needed = currentRow.length === 0 ? w : (currentRowW + wrapStepGap + w);
        if (currentRow.length > 0 && needed > availW) {
          rows.push(currentRow);
          currentRow = [{ item: c, w, h }];
          currentRowW = w;
        } else {
          currentRow.push({ item: c, w, h });
          currentRowW = needed;
        }
      });
      if (currentRow.length > 0) rows.push(currentRow);

      let maxRowW = 0;
      let totalRowsH = 0;
      const rowMetrics = rows.map((row, idx) => {
        const sumW = row.reduce((acc, r) => acc + r.w, 0);
        const rw = sumW + hGap * Math.max(0, row.length - 1);
        const rh = Math.max(...row.map(r => r.h));
        maxRowW = Math.max(maxRowW, rw);
        totalRowsH += rh + (idx > 0 ? vGap : 0);
        return { row, sumW, rw, rh };
      });

      if (sizingH === "hug") frame.width = this.clampDimension(pL + pR + maxRowW, frame.minWidth, frame.maxWidth, 40);
      if (sizingV === "hug") frame.height = this.clampDimension(pT + pB + totalRowsH, frame.minHeight, frame.maxHeight, 40);

      const finalAvailW = Math.max(0, frame.width - pL - pR);
      const finalAvailH = Math.max(0, frame.height - pT - pB);
      let startY = frame.y + pT;
      let effectiveVGap = vGap;
      if (isAutoGap && sizingV === "fixed" && rowMetrics.length >= 2) {
        const sumRowsH = rowMetrics.reduce((acc, m) => acc + m.rh, 0);
        effectiveVGap = Math.max(0, (finalAvailH - sumRowsH) / (rowMetrics.length - 1));
      } else {
        if (alignV === "center") startY += Math.max(0, (finalAvailH - totalRowsH) / 2);
        else if (alignV === "bottom") startY += Math.max(0, finalAvailH - totalRowsH);
      }

      let curY = startY;
      rowMetrics.forEach(({ row, sumW, rw, rh }) => {
        let curX = frame.x + pL;
        let rowGap = hGap;
        if (isAutoGap && row.length >= 2) {
          rowGap = Math.max(0, (finalAvailW - sumW) / (row.length - 1));
        } else {
          if (alignH === "center") curX += Math.max(0, (finalAvailW - rw) / 2);
          else if (alignH === "right") curX += Math.max(0, finalAvailW - rw);
        }

        row.forEach(({ item, w, h }) => {
          let itemY = curY;
          if (alignV === "center") itemY += (rh - h) / 2;
          else if (alignV === "bottom") itemY += (rh - h);
          const dx = Math.round(curX) - item.x;
          const dy = Math.round(itemY) - item.y;
          if (dx !== 0 || dy !== 0) this.moveShapeWithDescendants(item, dx, dy);
          curX += w + rowGap;
        });
        curY += rh + effectiveVGap;
      });

      if (frame.parentId && !options.skipParent) this.applyAutoLayout(frame.parentId, visited);
      return;
    }

    const isRow = dir === "row";
    const padMainStart = isRow ? pL : pT;
    const padMainEnd = isRow ? pR : pB;
    const padCrossStart = isRow ? pT : pL;
    const padCrossEnd = isRow ? pB : pR;
    const mainSizing = isRow ? sizingH : sizingV;
    const crossSizing = isRow ? sizingV : sizingH;

    // 親サイズ固定時、Fill設定の子要素を伸縮(Min/Max尊重＋入れ子Frame再計算)
    const nestedChanged = new Set();
    if (mainSizing === "fixed") {
      const gapForFill = isAutoGap ? 0 : hGap;
      const availMain = Math.max(20, (isRow ? frame.width : frame.height) - padMainStart - padMainEnd - gapForFill * Math.max(0, flowChildren.length - 1));
      const fillChildren = [];
      let fixedSum = 0;
      flowChildren.forEach(c => {
        const isFill = isRow ? (c.layoutSizingH === "fill") : (c.layoutSizingV === "fill");
        if (isFill) fillChildren.push(c);
        else fixedSum += isRow ? c.width : c.height;
      });
      if (fillChildren.length > 0) {
        const rawEach = (availMain - fixedSum) / fillChildren.length;
        fillChildren.forEach(c => {
          const nextDim = isRow
            ? this.clampDimension(rawEach, c.minWidth, c.maxWidth, 10)
            : this.clampDimension(rawEach, c.minHeight, c.maxHeight, 10);
          if (isRow && c.width !== nextDim) { c.width = nextDim; nestedChanged.add(c); }
          if (!isRow && c.height !== nextDim) { c.height = nextDim; nestedChanged.add(c); }
        });
      }
    }
    if (crossSizing === "fixed") {
      const availCross = Math.max(10, (isRow ? frame.height : frame.width) - padCrossStart - padCrossEnd);
      flowChildren.forEach(c => {
        const isFill = isRow ? (c.layoutSizingV === "fill") : (c.layoutSizingH === "fill");
        if (isFill) {
          const nextDim = isRow
            ? this.clampDimension(availCross, c.minHeight, c.maxHeight, 10)
            : this.clampDimension(availCross, c.minWidth, c.maxWidth, 10);
          if (isRow && c.height !== nextDim) { c.height = nextDim; nestedChanged.add(c); }
          if (!isRow && c.width !== nextDim) { c.width = nextDim; nestedChanged.add(c); }
        }
      });
    }

    // 子が入れ子AutoLayoutフレームならサイズ変更をトップダウンで子孫へ反映
    nestedChanged.forEach(c => {
      if (c.type === "frame" && c.autoLayout && c.autoLayout.enabled) {
        this.applyAutoLayout(c.id, new Set(visited), { skipParent: true });
      }
    });

    const sumChildrenMain = flowChildren.reduce((sum, c) => sum + (isRow ? c.width : c.height), 0);
    const fixedSpacingGap = isAutoGap ? 0 : hGap;
    const contentMainFixed = sumChildrenMain + fixedSpacingGap * Math.max(0, flowChildren.length - 1);
    const contentCross = Math.max(...flowChildren.map(c => (isRow ? c.height : c.width)));

    if (sizingH === "hug") {
      frame.width = this.clampDimension(pL + pR + (isRow ? contentMainFixed : contentCross), frame.minWidth, frame.maxWidth, 40);
    }
    if (sizingV === "hug") {
      frame.height = this.clampDimension(pT + pB + (isRow ? contentCross : contentMainFixed), frame.minHeight, frame.maxHeight, 40);
    }

    const availMain = Math.max(0, (isRow ? frame.width : frame.height) - padMainStart - padMainEnd);
    const availCross = Math.max(0, (isRow ? frame.height : frame.width) - padCrossStart - padCrossEnd);
    const alignMain = isRow ? alignH : alignV;
    const alignCross = isRow ? alignV : alignH;

    let effectiveGap = fixedSpacingGap;
    if (isAutoGap && mainSizing === "fixed" && flowChildren.length >= 2) {
      effectiveGap = Math.max(0, (availMain - sumChildrenMain) / (flowChildren.length - 1));
    }
    const contentMain = sumChildrenMain + effectiveGap * Math.max(0, flowChildren.length - 1);

    let mainCursor = (isRow ? frame.x : frame.y) + padMainStart;
    if (!(isAutoGap && mainSizing === "fixed" && flowChildren.length >= 2)) {
      if (alignMain === "center") mainCursor += Math.max(0, (availMain - contentMain) / 2);
      else if (alignMain === "right" || alignMain === "bottom") mainCursor += Math.max(0, availMain - contentMain);
    }

    const crossBase = (isRow ? frame.y : frame.x) + padCrossStart;

    flowChildren.forEach(c => {
      const cMain = isRow ? c.width : c.height;
      const cCross = isRow ? c.height : c.width;
      let crossPos = crossBase;
      if (alignCross === "center") crossPos += (availCross - cCross) / 2;
      else if (alignCross === "right" || alignCross === "bottom") crossPos += (availCross - cCross);

      const targetX = Math.round(isRow ? mainCursor : crossPos);
      const targetY = Math.round(isRow ? crossPos : mainCursor);
      const dx = targetX - c.x;
      const dy = targetY - c.y;
      if (dx !== 0 || dy !== 0) {
        this.moveShapeWithDescendants(c, dx, dy);
      }
      mainCursor += cMain + effectiveGap;
    });

    if (frame.parentId && !options.skipParent) this.applyAutoLayout(frame.parentId, visited);
  }

  // --- Constraints (通常Frameおよび絶対配置子のリサイズ追従) ---
  captureFrameResizeState(frame) {
    if (!frame || frame.type !== "frame") return null;
    const alEnabled = !!(frame.autoLayout && frame.autoLayout.enabled);
    const children = this.getChildren(frame.id);
    const trackedChildren = children
      .filter(c => !alEnabled || c.layoutPositioning === "absolute")
      .map(c => ({
        shape: c,
        x: c.x,
        y: c.y,
        width: c.width,
        height: c.height,
        nestedSnapshot: c.type === "frame" ? this.captureFrameResizeState(c) : null
      }));
    return {
      frame,
      x: frame.x,
      y: frame.y,
      width: frame.width,
      height: frame.height,
      alEnabled,
      children: trackedChildren
    };
  }

  applyConstraintsFromSnapshot(snapshot, ignoreConstraints = false) {
    if (!snapshot || !snapshot.frame) return;
    const f = snapshot.frame;
    const oldW = Math.max(1, snapshot.width);
    const oldH = Math.max(1, snapshot.height);
    const newW = Math.max(1, f.width);
    const newH = Math.max(1, f.height);

    if (ignoreConstraints) {
      return;
    }

    const oldFrameDx = f.x - snapshot.x;
    const oldFrameDy = f.y - snapshot.y;

    snapshot.children.forEach(entry => {
      const c = entry.shape;
      const con = c.constraints || { horizontal: "left", vertical: "top" };
      const ch = con.horizontal || "left";
      const cv = con.vertical || "top";

      const prevChildX = c.x;
      const prevChildY = c.y;
      const relLeft = entry.x - snapshot.x;
      const relRight = (snapshot.x + oldW) - (entry.x + entry.width);
      const relTop = entry.y - snapshot.y;
      const relBottom = (snapshot.y + oldH) - (entry.y + entry.height);

      let nextX = entry.x + oldFrameDx;
      let nextW = entry.width;
      if (ch === "right") {
        nextX = f.x + newW - relRight - entry.width;
      } else if (ch === "leftright") {
        nextX = f.x + relLeft;
        nextW = Math.max(5, newW - relLeft - relRight);
      } else if (ch === "center") {
        const oldCenterOffset = (entry.x + entry.width / 2) - (snapshot.x + oldW / 2);
        nextX = (f.x + newW / 2) + oldCenterOffset - entry.width / 2;
      } else if (ch === "scale") {
        nextX = f.x + (relLeft / oldW) * newW;
        nextW = Math.max(5, (entry.width / oldW) * newW);
      }

      let nextY = entry.y + oldFrameDy;
      let nextH = entry.height;
      if (cv === "bottom") {
        nextY = f.y + newH - relBottom - entry.height;
      } else if (cv === "topbottom") {
        nextY = f.y + relTop;
        nextH = Math.max(5, newH - relTop - relBottom);
      } else if (cv === "center") {
        const oldCenterOffset = (entry.y + entry.height / 2) - (snapshot.y + oldH / 2);
        nextY = (f.y + newH / 2) + oldCenterOffset - entry.height / 2;
      } else if (cv === "scale") {
        nextY = f.y + (relTop / oldH) * newH;
        nextH = Math.max(5, (entry.height / oldH) * newH);
      }

      c.x = Math.round(nextX);
      c.y = Math.round(nextY);
      c.width = Math.round(nextW);
      c.height = Math.round(nextH);

      if (c.type === "frame") {
        if (c.autoLayout && c.autoLayout.enabled) {
          const shiftX = c.x - prevChildX;
          const shiftY = c.y - prevChildY;
          if (shiftX !== 0 || shiftY !== 0) {
            this.getChildren(c.id).forEach(gc => this.moveShapeWithDescendants(gc, shiftX, shiftY));
          }
          this.applyAutoLayout(c.id, new Set(), { skipParent: true });
        } else if (entry.nestedSnapshot) {
          this.applyConstraintsFromSnapshot(entry.nestedSnapshot, false);
        }
      }
    });
  }

  // --- ドロップ先判定・挿入インジケータ・階層選択 ---
  findDropTargetFrame(worldX, worldY, excludeIds = new Set()) {
    const ordered = this.getRenderOrderedShapes();
    for (let i = ordered.length - 1; i >= 0; i--) {
      const s = ordered[i];
      if (s.type !== "frame" || excludeIds.has(s.id)) continue;
      if (!this.isEffectivelyVisible(s) || this.isEffectivelyLocked(s)) continue;
      if (worldX >= s.x && worldX <= s.x + s.width && worldY >= s.y && worldY <= s.y + s.height) {
        return s;
      }
    }
    return null;
  }

  computeAutoLayoutInsertion(frameId, pointerX, pointerY, excludeIds = new Set()) {
    const frame = this.getShapeById(frameId);
    if (!frame || frame.type !== "frame" || !frame.autoLayout || !frame.autoLayout.enabled) return null;

    const al = frame.autoLayout;
    const dir = al.direction || "row";
    const pT = Math.max(0, Number(al.paddingTop) || 0);
    const pR = Math.max(0, Number(al.paddingRight) || 0);
    const pB = Math.max(0, Number(al.paddingBottom) || 0);
    const pL = Math.max(0, Number(al.paddingLeft) || 0);

    const siblings = this.getChildren(frameId).filter(c => c.visible !== false && c.layoutPositioning !== "absolute" && !excludeIds.has(c.id));

    if (siblings.length === 0) {
      if (dir === "column") {
        return {
          frameId,
          index: 0,
          x1: frame.x + pL,
          y1: frame.y + pT + 4,
          x2: frame.x + Math.max(pL + 20, frame.width - pR),
          y2: frame.y + pT + 4
        };
      }
      return {
        frameId,
        index: 0,
        x1: frame.x + pL + 4,
        y1: frame.y + pT,
        x2: frame.x + pL + 4,
        y2: frame.y + Math.max(pT + 20, frame.height - pB)
      };
    }

    if (dir === "column") {
      let idx = siblings.length;
      for (let i = 0; i < siblings.length; i++) {
        const c = siblings[i];
        if (pointerY < c.y + c.height / 2) {
          idx = i;
          break;
        }
      }
      let lineY;
      if (idx === 0) lineY = siblings[0].y - 4;
      else if (idx === siblings.length) lineY = siblings[siblings.length - 1].y + siblings[siblings.length - 1].height + 4;
      else lineY = (siblings[idx - 1].y + siblings[idx - 1].height + siblings[idx].y) / 2;
      return {
        frameId,
        index: idx,
        x1: frame.x + Math.min(pL, 8),
        y1: lineY,
        x2: frame.x + frame.width - Math.min(pR, 8),
        y2: lineY
      };
    }

    if (dir === "wrap") {
      let bestIdx = siblings.length;
      let refItem = siblings[siblings.length - 1];
      let beforeRef = false;
      for (let i = 0; i < siblings.length; i++) {
        const c = siblings[i];
        const sameRow = pointerY >= c.y - 8 && pointerY <= c.y + c.height + 8;
        if (sameRow && pointerX < c.x + c.width / 2) {
          bestIdx = i;
          refItem = c;
          beforeRef = true;
          break;
        }
        if (pointerY < c.y - 8) {
          bestIdx = i;
          refItem = c;
          beforeRef = true;
          break;
        }
      }
      const lx = beforeRef ? refItem.x - 4 : refItem.x + refItem.width + 4;
      return {
        frameId,
        index: bestIdx,
        x1: lx,
        y1: refItem.y,
        x2: lx,
        y2: refItem.y + refItem.height
      };
    }

    // row
    let idx = siblings.length;
    for (let i = 0; i < siblings.length; i++) {
      const c = siblings[i];
      if (pointerX < c.x + c.width / 2) {
        idx = i;
        break;
      }
    }
    let lineX;
    if (idx === 0) lineX = siblings[0].x - 4;
    else if (idx === siblings.length) lineX = siblings[siblings.length - 1].x + siblings[siblings.length - 1].width + 4;
    else lineX = (siblings[idx - 1].x + siblings[idx - 1].width + siblings[idx].x) / 2;
    return {
      frameId,
      index: idx,
      x1: lineX,
      y1: frame.y + Math.min(pT, 8),
      x2: lineX,
      y2: frame.y + frame.height - Math.min(pB, 8)
    };
  }

  insertShapesIntoFrame(movingRootIds, targetFrameId, flowInsertIndex = null) {
    const targetFrame = this.getShapeById(targetFrameId);
    if (!targetFrame || targetFrame.type !== "frame") return;

    const movingSet = new Set();
    const validRoots = [];
    movingRootIds.forEach(rid => {
      const rs = this.getShapeById(rid);
      if (!rs || rs.id === targetFrameId || this.isDescendant(targetFrameId, rs.id)) return;
      validRoots.push(rs);
      movingSet.add(rs.id);
      this.getDescendants(rs.id).forEach(d => movingSet.add(d.id));
    });
    if (validRoots.length === 0) return;

    const movingBlocks = this.shapes.filter(s => movingSet.has(s.id));
    const remaining = this.shapes.filter(s => !movingSet.has(s.id));
    validRoots.forEach(rs => {
      rs.parentId = targetFrameId;
    });

    if (flowInsertIndex !== null && flowInsertIndex !== undefined) {
      const flowSiblings = remaining.filter(
        s => s.parentId === targetFrameId && s.visible !== false && s.layoutPositioning !== "absolute"
      );
      let insertPos;
      if (flowInsertIndex <= 0 && flowSiblings.length > 0) {
        insertPos = remaining.indexOf(flowSiblings[0]);
      } else if (flowInsertIndex < flowSiblings.length) {
        insertPos = remaining.indexOf(flowSiblings[flowInsertIndex]);
      } else {
        const lastDescOrSelf = (() => {
          const allUnder = remaining.filter(s => s.id === targetFrameId || this.isDescendantInArray(s, targetFrameId, remaining));
          return allUnder.length > 0 ? allUnder[allUnder.length - 1] : targetFrame;
        })();
        insertPos = remaining.indexOf(lastDescOrSelf) + 1;
      }
      remaining.splice(Math.max(0, insertPos), 0, ...movingBlocks);
      this.shapes = remaining;
    } else {
      this.shapes = remaining.concat(movingBlocks);
    }
    this.normalizeHierarchy();
  }

  isDescendantInArray(shape, ancestorId, list) {
    const byId = new Map();
    list.forEach(it => byId.set(it.id, it));
    let cur = shape;
    const seen = new Set();
    while (cur && cur.parentId && !seen.has(cur.parentId)) {
      if (cur.parentId === ancestorId) return true;
      seen.add(cur.parentId);
      cur = byId.get(cur.parentId);
    }
    return false;
  }

  // --- キャンバス上のPadding / Gapドラッグ用ハンドル計算 ---
  getAutoLayoutSpacingGuides(frame) {
    if (!frame || frame.type !== "frame" || !frame.autoLayout || !frame.autoLayout.enabled) return [];
    const al = frame.autoLayout;
    const pT = Math.max(0, Number(al.paddingTop) || 0);
    const pR = Math.max(0, Number(al.paddingRight) || 0);
    const pB = Math.max(0, Number(al.paddingBottom) || 0);
    const pL = Math.max(0, Number(al.paddingLeft) || 0);
    const guides = [];

    // Padding 4辺
    guides.push({
      kind: "padT", frameId: frame.id, value: Math.round(pT), axis: "y", dirSign: 1,
      rect: { x: frame.x, y: frame.y, width: frame.width, height: pT },
      hx: frame.x + frame.width / 2, hy: frame.y + pT / 2
    });
    guides.push({
      kind: "padB", frameId: frame.id, value: Math.round(pB), axis: "y", dirSign: -1,
      rect: { x: frame.x, y: frame.y + frame.height - pB, width: frame.width, height: pB },
      hx: frame.x + frame.width / 2, hy: frame.y + frame.height - pB / 2
    });
    guides.push({
      kind: "padL", frameId: frame.id, value: Math.round(pL), axis: "x", dirSign: 1,
      rect: { x: frame.x, y: frame.y, width: pL, height: frame.height },
      hx: frame.x + pL / 2, hy: frame.y + frame.height / 2
    });
    guides.push({
      kind: "padR", frameId: frame.id, value: Math.round(pR), axis: "x", dirSign: -1,
      rect: { x: frame.x + frame.width - pR, y: frame.y, width: pR, height: frame.height },
      hx: frame.x + frame.width - pR / 2, hy: frame.y + frame.height / 2
    });

    // Gap (fixed時、row/columnのみ)
    const dir = al.direction || "row";
    if (al.gapMode !== "auto" && (dir === "row" || dir === "column")) {
      const flow = this.getChildren(frame.id).filter(c => c.visible !== false && c.layoutPositioning !== "absolute");
      const gapVal = Math.round(Number(al.gap) || 0);
      for (let i = 0; i < flow.length - 1; i++) {
        const a = flow[i];
        const b = flow[i + 1];
        if (dir === "row") {
          const xStart = a.x + a.width;
          const gW = b.x - xStart;
          const yTop = Math.min(a.y, b.y);
          const yBot = Math.max(a.y + a.height, b.y + b.height);
          const rect = { x: Math.min(xStart, b.x), y: yTop, width: Math.abs(gW), height: yBot - yTop };
          guides.push({
            kind: "gap", index: i, frameId: frame.id, value: gapVal, axis: "x", dirSign: 1,
            rect, hx: xStart + gW / 2, hy: (yTop + yBot) / 2
          });
        } else {
          const yStart = a.y + a.height;
          const gH = b.y - yStart;
          const xLeft = Math.min(a.x, b.x);
          const xRight = Math.max(a.x + a.width, b.x + b.width);
          const rect = { x: xLeft, y: Math.min(yStart, b.y), width: xRight - xLeft, height: Math.abs(gH) };
          guides.push({
            kind: "gap", index: i, frameId: frame.id, value: gapVal, axis: "y", dirSign: 1,
            rect, hx: (xLeft + xRight) / 2, hy: yStart + gH / 2
          });
        }
      }
    }
    return guides;
  }

  // --- Figma階層選択ヘルパー ---
  getAncestorChain(shape) {
    const chain = [];
    let cur = shape;
    const seen = new Set();
    while (cur && !seen.has(cur.id)) {
      chain.unshift(cur);
      seen.add(cur.id);
      if (!cur.parentId) break;
      cur = this.getShapeById(cur.parentId);
    }
    return chain; // [topAncestor, ..., shape]
  }

  getFrameLabelRect(s) {
    if (!s || s.type !== "frame") return null;
    const isAL = !!(s.autoLayout && s.autoLayout.enabled);
    const label = s.name || (window.I18N ? window.I18N.t("shape.frame") : "フレーム");
    const prefix = isAL ? "[AL] " : "";
    const text = prefix + label;
    const anchor = this.shapeLocalToWorld(0, 0, s);
    const bottom = Math.max(14, anchor.y);
    const top = Math.max(0, bottom - 20);
    const width = Math.max(80, Math.min(240, text.length * 9 + 18));
    return { x: anchor.x, y: top, bottom, width, height: bottom - top, prefix, label };
  }

  hitTestFrameLabel(worldX, worldY) {
    const ordered = this.getRenderOrderedShapes();
    for (let i = ordered.length - 1; i >= 0; i--) {
      const s = ordered[i];
      if (s.type !== "frame") continue;
      if (!this.isEffectivelyVisible(s) || this.isEffectivelyLocked(s)) continue;
      const rect = this.getFrameLabelRect(s);
      if (worldX >= rect.x && worldX <= rect.x + rect.width && worldY >= rect.y && worldY <= rect.bottom) {
        if (this.isPointInsideClippedAncestors(worldX, worldY, s)) {
          return s;
        }
      }
    }
    return null;
  }

  renameShape(id, nextName) {
    const s = this.getShapeById(id);
    const trimmed = String(nextName || "").trim();
    if (!s || this.isEffectivelyLocked(s) || !trimmed || trimmed === s.name) return false;
    s.name = trimmed;
    this.saveState();
    this.render();
    this.onSelectionChange && this.onSelectionChange();
    return true;
  }

  resolveFigmaClickTarget(worldX, worldY, { direct = false } = {}) {
    // 1. 最前面のフレーム名ラベルクリックは常にそのフレーム自体を選択
    const labelHit = this.hitTestFrameLabel(worldX, worldY);
    if (labelHit) return labelHit;

    // 2. 直接ヒットした最前面要素を探す
    const directHit = this.hitTestDirect(worldX, worldY);
    if (!directHit) return null;
    if (direct || !directHit.parentId) {
      return directHit;
    }

    // 3. 祖先チェーンから現在の階層スコープに一致する対象を決定
    const chain = this.getAncestorChain(directHit); // [topFrame, ..., directHit]
    if (this.enteredContainerId) {
      const enteredIdx = chain.findIndex(item => item.id === this.enteredContainerId);
      if (enteredIdx >= 0 && enteredIdx + 1 < chain.length) {
        return chain[enteredIdx + 1];
      }
    }
    return chain[0];
  }

  enterContainerSelected(clickPos = null) {
    const selected = this.getSelectedShapes();
    if (selected.length !== 1 || selected[0].type !== "frame") return false;
    const frame = selected[0];
    const children = this.getChildren(frame.id).filter(c => this.isEffectivelyVisible(c) && !this.isEffectivelyLocked(c));
    if (children.length === 0) return false;

    this.enteredContainerId = frame.id;
    if (clickPos) {
      const directHit = this.hitTestDirect(clickPos.x, clickPos.y);
      if (directHit) {
        const chain = this.getAncestorChain(directHit);
        const fIdx = chain.findIndex(it => it.id === frame.id);
        if (fIdx >= 0 && fIdx + 1 < chain.length) {
          this.selectShape(chain[fIdx + 1].id, false);
          return true;
        }
      }
    }
    this.selectedShapeIds = new Set(children.map(c => c.id));
    this.render();
    this.onSelectionChange && this.onSelectionChange();
    return true;
  }

  selectParentFrame() {
    const s = this.getSelectedShape();
    if (!s || !s.parentId) return false;
    const parent = this.getShapeById(s.parentId);
    if (!parent) return false;
    this.enteredContainerId = parent.parentId || null;
    this.selectShape(parent.id, false);
    return true;
  }

  // --- レイヤーパネル向け操作 ---
  setLayerVisible(id, visible) {
    const s = this.getShapeById(id);
    if (!s) return;
    s.visible = !!visible;
    if (!s.visible && this.selectedShapeIds.has(id)) {
      this.selectedShapeIds.delete(id);
    }
    if (s.parentId) this.applyAutoLayout(s.parentId);
    this.saveState();
    this.render();
    this.onSelectionChange && this.onSelectionChange();
  }

  setLayerLocked(id, locked) {
    const s = this.getShapeById(id);
    if (!s) return;
    s.locked = !!locked;
    if (this.mode === "edit_points") {
      const sel = this.getSelectedShape();
      if (!sel || this.isEffectivelyLocked(sel)) {
        this.mode = "select";
        this.activePointIndex = null;
        this.activeHandleType = null;
        this.onModeChange && this.onModeChange(this.mode);
      }
    }
    this.saveState();
    this.render();
    this.onSelectionChange && this.onSelectionChange();
  }

  unlockSelected() {
    const selected = this.getSelectedShapes();
    if (selected.length === 0) return false;
    let changed = false;
    selected.forEach(s => {
      this.getAncestorChain(s).forEach(node => {
        if (node.locked) {
          node.locked = false;
          changed = true;
        }
      });
    });
    if (!changed) return false;
    this.saveState();
    this.render();
    this.onSelectionChange && this.onSelectionChange();
    return true;
  }

  moveLayerInHierarchy(draggedIds, targetId, position) {
    const target = this.getShapeById(targetId);
    if (!target) return false;
    if (position === "inside" && target.type === "frame" && this.isEffectivelyLocked(target)) return false;
    if (position !== "inside" && target.parentId) {
      const targetParent = this.getShapeById(target.parentId);
      if (targetParent && this.isEffectivelyLocked(targetParent)) return false;
    }
    const rootIds = this.getEffectiveRootIds(new Set(draggedIds));
    const validRoots = rootIds.map(id => this.getShapeById(id)).filter(rs => {
      if (!rs || rs.id === targetId || this.isEffectivelyLocked(rs)) return false;
      if (rs.type === "frame" && this.isDescendant(targetId, rs.id)) return false;
      return true;
    });
    if (validRoots.length === 0) return false;

    const oldParents = new Set();
    validRoots.forEach(rs => {
      if (rs.parentId) oldParents.add(rs.parentId);
    });

    const movingSet = new Set();
    validRoots.forEach(rs => {
      movingSet.add(rs.id);
      this.getDescendants(rs.id).forEach(d => movingSet.add(d.id));
    });
    const movingBlocks = this.shapes.filter(s => movingSet.has(s.id));
    const remaining = this.shapes.filter(s => !movingSet.has(s.id));

    if (position === "inside" && target.type === "frame") {
      validRoots.forEach(rs => { rs.parentId = target.id; });
      const targetSubtree = remaining.filter(s => s.id === target.id || this.isDescendantInArray(s, target.id, remaining));
      const lastNode = targetSubtree[targetSubtree.length - 1] || target;
      const insertAt = remaining.indexOf(lastNode) + 1;
      remaining.splice(insertAt, 0, ...movingBlocks);
      this.shapes = remaining;
      oldParents.add(target.id);
    } else {
      const nextParentId = target.parentId || null;
      validRoots.forEach(rs => { rs.parentId = nextParentId; });
      if (nextParentId) oldParents.add(nextParentId);

      // レイヤーUI上は上が前面(配列後方)、下が背面(配列前方)
      if (position === "before") {
        // targetより上(UI上) = 配列ではtargetサブツリーの直後(より手前)
        const targetSubtree = remaining.filter(s => s.id === target.id || this.isDescendantInArray(s, target.id, remaining));
        const lastNode = targetSubtree[targetSubtree.length - 1] || target;
        const insertAt = remaining.indexOf(lastNode) + 1;
        remaining.splice(insertAt, 0, ...movingBlocks);
      } else {
        // targetより下(UI上) = 配列ではtargetの直前(より奥)
        const insertAt = remaining.indexOf(target);
        remaining.splice(Math.max(0, insertAt), 0, ...movingBlocks);
      }
      this.shapes = remaining;
    }

    this.normalizeHierarchy();
    oldParents.forEach(pid => this.applyAutoLayout(pid));
    this.saveState();
    this.render();
    this.onSelectionChange && this.onSelectionChange();
    return true;
  }

  // --- 選択管理 ---
  selectShape(id, multi = false) {
    if (!multi) {
      this.selectedShapeIds.clear();
      if (id) {
        const target = this.getShapeById(id);
        this.enteredContainerId = target ? (target.parentId || null) : null;
        this.selectedShapeIds.add(id);
      } else {
        this.enteredContainerId = null;
      }
    } else if (id) {
      if (this.selectedShapeIds.has(id)) this.selectedShapeIds.delete(id);
      else this.selectedShapeIds.add(id);
    }
    this.render();
    this.onSelectionChange && this.onSelectionChange();
  }

  deselectAll() {
    this.selectedShapeIds.clear();
    this.enteredContainerId = null;
    this.exitEditPointsMode();
    this.render();
    this.onSelectionChange && this.onSelectionChange();
  }

  getSelectedShapes() {
    return this.shapes.filter(s => this.selectedShapeIds.has(s.id));
  }

  getSelectedShape() {
    const list = this.getSelectedShapes();
    return list.length > 0 ? list[0] : null;
  }

  getEditableSelectedShapes() {
    return this.getSelectedShapes().filter(s => !this.isEffectivelyLocked(s));
  }

  getEditableRootIds() {
    return this.getEffectiveRootIds(this.selectedShapeIds).filter(id => {
      const s = this.getShapeById(id);
      return s && !this.isEffectivelyLocked(s);
    });
  }

  // --- レイヤー順序（同一親グループ内で複数選択・相対順維持） ---
  reorderSelectedZOrder(mode) {
    const editableIds = new Set(this.getEditableRootIds());
    if (editableIds.size === 0) return false;

    const childrenByParent = new Map();
    this.shapes.forEach(s => {
      const pid = s.parentId || null;
      if (!childrenByParent.has(pid)) childrenByParent.set(pid, []);
      childrenByParent.get(pid).push(s);
    });

    const targetParents = new Set();
    this.shapes.forEach(s => {
      if (editableIds.has(s.id)) targetParents.add(s.parentId || null);
    });

    let anyChanged = false;
    const changedParents = new Set();

    targetParents.forEach(pid => {
      const siblings = childrenByParent.get(pid);
      if (!siblings || siblings.length <= 1) return;

      let nextSiblings = [...siblings];
      if (mode === "front") {
        const stay = siblings.filter(s => !editableIds.has(s.id));
        const move = siblings.filter(s => editableIds.has(s.id));
        nextSiblings = stay.concat(move);
      } else if (mode === "back") {
        const move = siblings.filter(s => editableIds.has(s.id));
        const stay = siblings.filter(s => !editableIds.has(s.id));
        nextSiblings = move.concat(stay);
      } else if (mode === "forward") {
        for (let i = nextSiblings.length - 2; i >= 0; i--) {
          if (editableIds.has(nextSiblings[i].id) && !editableIds.has(nextSiblings[i + 1].id)) {
            const tmp = nextSiblings[i];
            nextSiblings[i] = nextSiblings[i + 1];
            nextSiblings[i + 1] = tmp;
          }
        }
      } else if (mode === "backward") {
        for (let i = 1; i < nextSiblings.length; i++) {
          if (editableIds.has(nextSiblings[i].id) && !editableIds.has(nextSiblings[i - 1].id)) {
            const tmp = nextSiblings[i];
            nextSiblings[i] = nextSiblings[i - 1];
            nextSiblings[i - 1] = tmp;
          }
        }
      }

      if (nextSiblings.some((s, idx) => s !== siblings[idx])) {
        childrenByParent.set(pid, nextSiblings);
        anyChanged = true;
        if (pid) changedParents.add(pid);
      }
    });

    if (!anyChanged) return false;

    const ordered = [];
    const visited = new Set();
    const walk = (s) => {
      if (!s || visited.has(s.id)) return;
      visited.add(s.id);
      ordered.push(s);
      if (s.type === "frame") {
        (childrenByParent.get(s.id) || []).forEach(walk);
      }
    };
    (childrenByParent.get(null) || []).forEach(walk);
    this.shapes.forEach(s => {
      if (!visited.has(s.id)) walk(s);
    });

    this.shapes = ordered;
    this.normalizeHierarchy();
    changedParents.forEach(pid => this.applyAutoLayout(pid));
    this.saveState();
    this.render();
    this.onSelectionChange && this.onSelectionChange();
    return true;
  }

  bringToFront() {
    return this.reorderSelectedZOrder("front");
  }

  sendToBack() {
    return this.reorderSelectedZOrder("back");
  }

  bringForward() {
    return this.reorderSelectedZOrder("forward");
  }

  sendBackward() {
    return this.reorderSelectedZOrder("backward");
  }

  // コピー・貼り付け・複製
  hasClipboard() {
    return !!(this.clipboard && Array.isArray(this.clipboard.subtrees) && this.clipboard.subtrees.length > 0);
  }

  copySelected() {
    const rootIds = this.getEffectiveRootIds(this.selectedShapeIds);
    if (rootIds.length === 0) return false;

    const subtrees = [];
    rootIds.forEach(rid => {
      const root = this.getShapeById(rid);
      if (!root) return;
      const items = [root, ...this.getDescendants(rid)].map(item => JSON.parse(JSON.stringify(item)));
      subtrees.push({
        sourceParentId: root.parentId || null,
        items
      });
    });
    if (subtrees.length === 0) return false;

    this.clipboard = {
      subtrees,
      pasteCount: 0,
      lastPastedIds: new Set()
    };
    return true;
  }

  cutSelected() {
    const rootIds = this.getEditableRootIds();
    if (rootIds.length === 0) return false;

    const subtrees = [];
    rootIds.forEach(rid => {
      const root = this.getShapeById(rid);
      if (!root) return;
      const items = [root, ...this.getDescendants(rid)].map(item => JSON.parse(JSON.stringify(item)));
      subtrees.push({
        sourceParentId: root.parentId || null,
        items
      });
    });
    if (subtrees.length === 0) return false;

    this.clipboard = {
      subtrees,
      pasteCount: 0,
      lastPastedIds: new Set()
    };
    this.deleteSelected();
    return true;
  }

  _resolvePasteTargetParentId() {
    const copiedRootIds = new Set(this.clipboard ? this.clipboard.subtrees.map(st => st.items[0].id) : []);
    const pastedIds = this.clipboard && this.clipboard.lastPastedIds ? this.clipboard.lastPastedIds : new Set();
    const selected = this.getSelectedShapes();

    if (
      selected.length === 1 &&
      selected[0].type === "frame" &&
      !this.isEffectivelyLocked(selected[0]) &&
      !copiedRootIds.has(selected[0].id) &&
      !pastedIds.has(selected[0].id)
    ) {
      return selected[0].id;
    }
    if (selected.length > 0) {
      const pid = selected[0].parentId || null;
      if (pid) {
        const parent = this.getShapeById(pid);
        if (parent && parent.type === "frame" && !this.isEffectivelyLocked(parent)) {
          return pid;
        }
      }
    }
    if (this.enteredContainerId) {
      const entered = this.getShapeById(this.enteredContainerId);
      if (entered && entered.type === "frame" && !this.isEffectivelyLocked(entered)) {
        return entered.id;
      }
    }
    return null;
  }

  _instantiateSubtrees(subtrees, resolveTargetParentId, resolveOffset, options = {}) {
    const { unlockRoots = false } = options;
    const newSelectedIds = new Set();
    const affectedParents = new Set();
    let seq = 0;

    subtrees.forEach(sub => {
      if (!sub.items || sub.items.length === 0) return;
      const targetParentId = resolveTargetParentId(sub);
      const targetParent = targetParentId ? this.getShapeById(targetParentId) : null;
      const isALParent = !!(targetParent && targetParent.autoLayout && targetParent.autoLayout.enabled);
      const offset = isALParent ? 0 : resolveOffset(sub, targetParentId);

      const idMap = new Map();
      sub.items.forEach(item => {
        seq++;
        idMap.set(item.id, "shape_" + Date.now() + "_" + seq + "_" + Math.floor(Math.random() * 1000));
      });

      sub.items.forEach((item, idx) => {
        const clone = JSON.parse(JSON.stringify(item));
        clone.id = idMap.get(item.id);
        if (idx === 0) {
          clone.parentId = targetParentId;
          if (unlockRoots) clone.locked = false;
          if (clone.parentId) affectedParents.add(clone.parentId);
        } else {
          clone.parentId = idMap.get(item.parentId) || targetParentId;
        }
        clone.x += offset;
        clone.y += offset;
        this.shapes.push(clone);
        if (idx === 0) newSelectedIds.add(clone.id);
      });
    });

    if (newSelectedIds.size === 0) return null;

    this.normalizeHierarchy();
    affectedParents.forEach(pid => this.applyAutoLayout(pid));
    this.selectedShapeIds = newSelectedIds;
    this.saveState();
    this.render();
    this.onSelectionChange && this.onSelectionChange();
    return newSelectedIds;
  }

  pasteClipboard() {
    if (!this.hasClipboard()) return false;
    const targetParentId = this._resolvePasteTargetParentId();
    this.clipboard.pasteCount += 1;
    const offset = 20 * this.clipboard.pasteCount;
    const created = this._instantiateSubtrees(
      this.clipboard.subtrees,
      () => targetParentId,
      () => offset,
      { unlockRoots: true }
    );
    if (!created) return false;
    this.clipboard.lastPastedIds = new Set(created);
    return true;
  }

  duplicateSelected() {
    const rootIds = this.getEditableRootIds();
    if (rootIds.length === 0) return false;
    const subtrees = rootIds.map(rid => {
      const root = this.getShapeById(rid);
      if (!root) return null;
      return {
        sourceParentId: root.parentId || null,
        items: [root, ...this.getDescendants(rid)]
      };
    }).filter(Boolean);
    return !!this._instantiateSubtrees(
      subtrees,
      (sub) => sub.sourceParentId,
      (sub, parentId) => (parentId ? 0 : 20),
      { unlockRoots: false }
    );
  }

  // 削除
  deleteSelected() {
    if (this.selectedShapeIds.size === 0) return;
    const toDelete = new Set();
    const affectedParents = new Set();

    this.selectedShapeIds.forEach(id => {
      const s = this.getShapeById(id);
      if (!s || this.isEffectivelyLocked(s)) return;
      toDelete.add(id);
      if (s.parentId) affectedParents.add(s.parentId);
      if (s.type === "frame") {
        this.getDescendants(id).forEach(d => toDelete.add(d.id));
      }
    });
    if (toDelete.size === 0) return;

    this.shapes = this.shapes.filter(s => !toDelete.has(s.id));
    toDelete.forEach(id => this.selectedShapeIds.delete(id));
    this.exitEditPointsMode();
    this.normalizeHierarchy();
    affectedParents.forEach(pid => {
      if (!toDelete.has(pid)) this.applyAutoLayout(pid);
    });
    this.saveState();
    this.render();
    this.onSelectionChange && this.onSelectionChange();
  }

  // --- 変形機能（反転・シアー） ---
  toggleFlipAxis(axisProp) {
    const targets = this.getEditableSelectedShapes();
    if (targets.length === 0) return;
    targets.forEach(s => {
      s[axisProp] = !s[axisProp];
    });
    this.saveState();
    this.render();
  }

  toggleFlipH() {
    this.toggleFlipAxis("flipH");
  }

  toggleFlipV() {
    this.toggleFlipAxis("flipV");
  }

  setShear(shearX, shearY) {
    const targets = this.getEditableSelectedShapes();
    if (targets.length === 0) return;
    targets.forEach(s => {
      s.shearX = shearX;
      s.shearY = shearY;
    });
    this.saveState();
    this.render();
  }

  // --- 「頂点の編集」モード切替 ---
  enterEditPointsMode() {
    const selected = this.getSelectedShapes();
    if (selected.length !== 1) return;
    const s = selected[0];
    if (!s || this.isEffectivelyLocked(s) || s.type === "text" || s.type === "math_plot" || s.type === "frame") return;
    this.mode = "edit_points";
    if (!s.points) {
      s.points = EditPointsManager.initializePointsFromShape(s);
      s.type = "custom_path"; // パス化
    }
    this.activePointIndex = 0;
    this.activeHandleType = "anchor";
    this.render();
    this.onModeChange && this.onModeChange(this.mode);
  }

  setMode(mode) {
    if (this.mode === mode) return;
    if (this.mode === "edit_points") {
      this.activePointIndex = null;
      this.activeHandleType = null;
    }
    this.mode = mode;
    if (mode !== "create_frame") this.frameDraftRect = null;
    this.render();
    this.onModeChange && this.onModeChange(this.mode);
  }

  exitEditPointsMode() {
    if (this.mode === "edit_points") {
      this.mode = "select";
      this.activePointIndex = null;
      this.activeHandleType = null;
      this.saveState();
      this.render();
      this.onModeChange && this.onModeChange(this.mode);
    }
  }

  // --- 描画メイン ---
  render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    // 背景
    if (this.backgroundColor === "transparent" || (!this.backgroundColor && this.docType === "asset")) {
      this.drawCheckerboard(ctx, this.width, this.height);
    } else {
      ctx.fillStyle = this.backgroundColor || "#ffffff";
      ctx.fillRect(0, 0, this.width, this.height);
    }

    // グリッド線
    if (this.showGrid) {
      ctx.save();
      ctx.strokeStyle = "rgba(226, 232, 240, 0.8)";
      ctx.lineWidth = 1;
      for (let x = this.gridSize; x < this.width; x += this.gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, this.height);
        ctx.stroke();
      }
      for (let y = this.gridSize; y < this.height; y += this.gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(this.width, y);
        ctx.stroke();
      }
      ctx.restore();
    }

    // 各図形描画(クリップ・フレームガイド含む)
    this.drawShapesToContext(ctx, this.shapes, { showEditorGuides: true });

    // 選択図形の枠線・ハンドル描画
    if (this.mode === "select" || this.mode === "create_frame") {
      const isSingleSelection = (this.selectedShapeIds.size === 1);
      this.selectedShapeIds.forEach(id => {
        const s = this.shapes.find(it => it.id === id);
        if (s && this.isEffectivelyVisible(s)) {
          const locked = this.isEffectivelyLocked(s);
          this.renderSelectionHandles(ctx, s, { locked, showHandles: isSingleSelection && !locked });
          if (s.parentId && !locked) this.renderConstraintGuides(ctx, s);
        }
      });

      // 単一Auto Layoutフレーム選択時のPadding/Gapガイド描画
      if (isSingleSelection) {
        const sel = this.getSelectedShape();
        if (sel && sel.type === "frame" && sel.autoLayout && sel.autoLayout.enabled && this.isEffectivelyVisible(sel) && !this.isEffectivelyLocked(sel)) {
          this.renderAutoLayoutSpacingGuides(ctx, sel);
        }
      }
    } else if (this.mode === "edit_points") {
      const s = this.getSelectedShape();
      if (s && !this.isEffectivelyLocked(s)) this.renderEditPointsHandles(ctx, s);
    }

    // Auto Layoutドロップ挿入位置の青いインジケータ線
    if (this.dropInsertionIndicator) {
      const ind = this.dropInsertionIndicator;
      ctx.save();
      ctx.strokeStyle = "#2563eb";
      ctx.fillStyle = "#2563eb";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(ind.x1, ind.y1);
      ctx.lineTo(ind.x2, ind.y2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(ind.x1, ind.y1, 3.5, 0, Math.PI * 2);
      ctx.arc(ind.x2, ind.y2, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Fキーによるフレーム描画プレビュー
    if (this.frameDraftRect) {
      const r = this.frameDraftRect;
      ctx.save();
      ctx.fillStyle = "rgba(37, 99, 235, 0.08)";
      ctx.strokeStyle = "#2563eb";
      ctx.lineWidth = 1.5;
      ctx.fillRect(r.x, r.y, r.width, r.height);
      ctx.strokeRect(r.x, r.y, r.width, r.height);
      const label = `${Math.round(r.width)} x ${Math.round(r.height)}`;
      ctx.font = "600 11px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
      const tw = ctx.measureText(label).width + 10;
      const lx = r.x + r.width / 2 - tw / 2;
      const ly = r.y + r.height + 6;
      ctx.fillStyle = "#2563eb";
      ctx.fillRect(lx, ly, tw, 18);
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(label, r.x + r.width / 2, ly + 9);
      ctx.restore();
    }

    // ドラッグ範囲選択ボックス
    if (this.marqueeRect && (this.marqueeRect.width > 1 || this.marqueeRect.height > 1)) {
      ctx.save();
      ctx.fillStyle = "rgba(37, 99, 235, 0.12)";
      ctx.strokeStyle = "#2563eb";
      ctx.lineWidth = 1.5;
      ctx.fillRect(this.marqueeRect.x, this.marqueeRect.y, this.marqueeRect.width, this.marqueeRect.height);
      ctx.strokeRect(this.marqueeRect.x, this.marqueeRect.y, this.marqueeRect.width, this.marqueeRect.height);
      ctx.restore();
    }

    // スマートガイド(赤い配置・スナップ補助線)
    if (Array.isArray(this.smartGuides) && this.smartGuides.length > 0) {
      ctx.save();
      ctx.strokeStyle = "#ef4444";
      ctx.fillStyle = "#ef4444";
      ctx.lineWidth = 1.2;
      ctx.setLineDash([4, 3]);
      this.smartGuides.forEach(g => {
        ctx.beginPath();
        if (g.type === "v") {
          ctx.moveTo(g.pos, g.start);
          ctx.lineTo(g.pos, g.end);
        } else {
          ctx.moveTo(g.start, g.pos);
          ctx.lineTo(g.end, g.pos);
        }
        ctx.stroke();
      });
      ctx.setLineDash([]);
      this.smartGuides.forEach(g => {
        ctx.beginPath();
        if (g.type === "v") {
          ctx.arc(g.pos, g.start, 2.5, 0, Math.PI * 2);
          ctx.arc(g.pos, g.end, 2.5, 0, Math.PI * 2);
        } else {
          ctx.arc(g.start, g.pos, 2.5, 0, Math.PI * 2);
          ctx.arc(g.end, g.pos, 2.5, 0, Math.PI * 2);
        }
        ctx.fill();
      });
      ctx.restore();
    }
  }

  computeSmartGuides(bounds, excludeIds = new Set(), threshold = null) {
    if (!bounds) return { snapDx: 0, snapDy: 0, guides: [] };
    const th = threshold !== null ? threshold : (6 / Math.max(0.2, this.zoom || 1));

    const vTargets = [
      { pos: 0, start: 0, end: this.height },
      { pos: this.width / 2, start: 0, end: this.height },
      { pos: this.width, start: 0, end: this.height }
    ];
    const hTargets = [
      { pos: 0, start: 0, end: this.width },
      { pos: this.height / 2, start: 0, end: this.width },
      { pos: this.height, start: 0, end: this.width }
    ];

    this.shapes.forEach(s => {
      if (!s || excludeIds.has(s.id) || !this.isEffectivelyVisible(s)) return;
      const sx1 = s.x;
      const sx2 = s.x + s.width;
      const scx = s.x + s.width / 2;
      const sy1 = s.y;
      const sy2 = s.y + s.height;
      const scy = s.y + s.height / 2;
      vTargets.push({ pos: sx1, start: sy1, end: sy2 });
      vTargets.push({ pos: scx, start: sy1, end: sy2 });
      vTargets.push({ pos: sx2, start: sy1, end: sy2 });
      hTargets.push({ pos: sy1, start: sx1, end: sx2 });
      hTargets.push({ pos: scy, start: sx1, end: sx2 });
      hTargets.push({ pos: sy2, start: sx1, end: sx2 });
    });

    const mx = [bounds.x, bounds.x + bounds.width / 2, bounds.x + bounds.width];
    const my = [bounds.y, bounds.y + bounds.height / 2, bounds.y + bounds.height];

    let bestDx = null;
    let bestAbsX = th + 0.001;
    let snapVPos = null;
    mx.forEach(val => {
      vTargets.forEach(t => {
        const diff = t.pos - val;
        const ad = Math.abs(diff);
        if (ad < bestAbsX) {
          bestAbsX = ad;
          bestDx = diff;
          snapVPos = t.pos;
        }
      });
    });

    let bestDy = null;
    let bestAbsY = th + 0.001;
    let snapHPos = null;
    my.forEach(val => {
      hTargets.forEach(t => {
        const diff = t.pos - val;
        const ad = Math.abs(diff);
        if (ad < bestAbsY) {
          bestAbsY = ad;
          bestDy = diff;
          snapHPos = t.pos;
        }
      });
    });

    const snapDx = bestDx !== null ? bestDx : 0;
    const snapDy = bestDy !== null ? bestDy : 0;
    const snappedX = bounds.x + snapDx;
    const snappedY = bounds.y + snapDy;
    const guides = [];

    if (snapVPos !== null) {
      let minY = snappedY;
      let maxY = snappedY + bounds.height;
      vTargets.forEach(t => {
        if (Math.abs(t.pos - snapVPos) < 0.5) {
          minY = Math.min(minY, t.start);
          maxY = Math.max(maxY, t.end);
        }
      });
      guides.push({ type: "v", pos: snapVPos, start: minY, end: maxY });
    }

    if (snapHPos !== null) {
      let minX = snappedX;
      let maxX = snappedX + bounds.width;
      hTargets.forEach(t => {
        if (Math.abs(t.pos - snapHPos) < 0.5) {
          minX = Math.min(minX, t.start);
          maxX = Math.max(maxX, t.end);
        }
      });
      guides.push({ type: "h", pos: snapHPos, start: minX, end: maxX });
    }

    return { snapDx, snapDy, guides };
  }

  renderConstraintGuides(ctx, shape) {
    const parent = this.getShapeById(shape.parentId);
    if (!parent) return;
    const isParentAL = !!(parent.autoLayout && parent.autoLayout.enabled);
    if (isParentAL && shape.layoutPositioning !== "absolute") return;

    const con = shape.constraints || { horizontal: "left", vertical: "top" };
    const ch = con.horizontal || "left";
    const cv = con.vertical || "top";
    const cx = shape.x + shape.width / 2;
    const cy = shape.y + shape.height / 2;

    ctx.save();
    ctx.strokeStyle = "rgba(37, 99, 235, 0.75)";
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);

    const drawLine = (x1, y1, x2, y2) => {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    };

    if (ch === "left" || ch === "leftright") drawLine(parent.x, cy, shape.x, cy);
    if (ch === "right" || ch === "leftright") drawLine(shape.x + shape.width, cy, parent.x + parent.width, cy);
    if (ch === "center") drawLine(parent.x + parent.width / 2, parent.y, parent.x + parent.width / 2, parent.y + parent.height);

    if (cv === "top" || cv === "topbottom") drawLine(cx, parent.y, cx, shape.y);
    if (cv === "bottom" || cv === "topbottom") drawLine(cx, shape.y + shape.height, cx, parent.y + parent.height);
    if (cv === "center") drawLine(parent.x, parent.y + parent.height / 2, parent.x + parent.width, parent.y + parent.height / 2);

    ctx.restore();
  }

  renderAutoLayoutSpacingGuides(ctx, frame) {
    const guides = this.getAutoLayoutSpacingGuides(frame);
    if (guides.length === 0) return;
    ctx.save();
    guides.forEach(g => {
      const isActive =
        (this.activeSpacingDrag && this.activeSpacingDrag.frameId === g.frameId && this.activeSpacingDrag.kind === g.kind && (g.kind !== "gap" || this.activeSpacingDrag.index === g.index)) ||
        (this.activeSpacingHover && this.activeSpacingHover.frameId === g.frameId && this.activeSpacingHover.kind === g.kind && (g.kind !== "gap" || this.activeSpacingHover.index === g.index));

      if (isActive && g.rect.width > 0 && g.rect.height > 0) {
        ctx.fillStyle = g.kind === "gap" ? "rgba(236, 72, 153, 0.22)" : "rgba(59, 130, 246, 0.16)";
        ctx.fillRect(g.rect.x, g.rect.y, g.rect.width, g.rect.height);
      }

      // つまみ線
      const color = g.kind === "gap" ? "#ec4899" : "#3b82f6";
      ctx.strokeStyle = color;
      ctx.lineWidth = isActive ? 2 : 1.5;
      ctx.beginPath();
      if (g.axis === "x") {
        ctx.moveTo(g.hx, g.hy - 5);
        ctx.lineTo(g.hx, g.hy + 5);
      } else {
        ctx.moveTo(g.hx - 5, g.hy);
        ctx.lineTo(g.hx + 5, g.hy);
      }
      ctx.stroke();

      if (isActive) {
        const label = String(g.value);
        ctx.font = "600 10px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
        const tw = ctx.measureText(label).width + 8;
        ctx.fillStyle = color;
        ctx.fillRect(g.hx - tw / 2, g.hy - 9, tw, 18);
        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(label, g.hx, g.hy);
      }
    });
    ctx.restore();
  }

  drawRoundedRectPath(ctx, x, y, w, h, radius) {
    const r = Math.max(0, Math.min(radius || 0, Math.min(w, h) / 2));
    ctx.beginPath();
    if (r <= 0) {
      ctx.rect(x, y, w, h);
    } else {
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h - r);
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.lineTo(x + r, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
    }
  }

  hasAncestorInSet(shape, idSet, byId) {
    let cur = shape;
    const seen = new Set();
    while (cur && cur.parentId && !seen.has(cur.parentId)) {
      if (idSet.has(cur.parentId)) return true;
      seen.add(cur.parentId);
      cur = byId.get(cur.parentId);
    }
    return false;
  }

  drawShapesToContext(ctx, shapesList, options = {}) {
    const showEditorGuides = !!options.showEditorGuides;
    const offsetX = options.offsetX || 0;
    const offsetY = options.offsetY || 0;

    const byId = new Map();
    shapesList.forEach(s => {
      if (s && s.id != null) byId.set(s.id, s);
    });

    const isVis = (shape) => {
      let cur = shape;
      const seen = new Set();
      while (cur) {
        const key = cur.id != null ? cur.id : cur;
        if (seen.has(key)) break;
        if (cur.visible === false) return false;
        seen.add(key);
        cur = cur.parentId ? byId.get(cur.parentId) : null;
      }
      return true;
    };

    const orderedList = PPTCanvas.getRenderOrderedShapes(shapesList).filter(isVis);

    const clipStack = [];
    const popClipsBeforeNext = (nextShape) => {
      while (clipStack.length > 0) {
        const topId = clipStack[clipStack.length - 1];
        if (nextShape && this.hasAncestorInSet(nextShape, new Set([topId]), byId)) {
          break;
        }
        ctx.restore();
        clipStack.pop();
      }
    };

    for (let i = 0; i < orderedList.length; i++) {
      const orig = orderedList[i];
      const s = (offsetX !== 0 || offsetY !== 0) ? { ...orig, x: orig.x - offsetX, y: orig.y - offsetY } : orig;
      popClipsBeforeNext(orig);

      this.renderShape(ctx, s, { showEditorGuides });

      if (orig.type === "frame" && orig.clipContent) {
        ctx.save();
        const cx = s.x + s.width / 2;
        const cy = s.y + s.height / 2;
        if (s.rotation) {
          ctx.translate(cx, cy);
          ctx.rotate((s.rotation * Math.PI) / 180);
          ctx.translate(-cx, -cy);
        }
        this.drawRoundedRectPath(ctx, s.x, s.y, s.width, s.height, s.cornerRadius || 0);
        ctx.clip();
        clipStack.push(orig.id);
      }
    }
    popClipsBeforeNext(null);

    // フレーム名ラベルとドロップターゲットハイライトはクリップ外かつ前面に描く
    if (showEditorGuides) {
      orderedList.forEach(orig => {
        if (orig.type !== "frame") return;
        const s = (offsetX !== 0 || offsetY !== 0) ? { ...orig, x: orig.x - offsetX, y: orig.y - offsetY } : orig;
        ctx.save();
        const info = this.getFrameLabelRect(s);
        const isAL = !!(s.autoLayout && s.autoLayout.enabled);
        ctx.font = "600 11px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
        ctx.fillStyle = this.selectedShapeIds.has(orig.id) ? "#2563eb" : (isAL ? "#7c3aed" : "#64748b");
        ctx.textBaseline = "bottom";
        ctx.fillText(info.prefix + info.label, info.x, info.bottom - 4);

        if (this.dropTargetFrameId === orig.id) {
          const cx = s.x + s.width / 2;
          const cy = s.y + s.height / 2;
          ctx.translate(cx, cy);
          if (s.rotation) ctx.rotate((s.rotation * Math.PI) / 180);
          ctx.scale(s.flipH ? -1 : 1, s.flipV ? -1 : 1);
          if (s.shearX || s.shearY) {
            ctx.transform(1, Math.tan((s.shearY || 0) * Math.PI / 180), Math.tan((s.shearX || 0) * Math.PI / 180), 1, 0, 0);
          }
          ctx.translate(-cx, -cy);
          ctx.strokeStyle = "#2563eb";
          ctx.lineWidth = 2.5;
          ctx.setLineDash([]);
          this.drawRoundedRectPath(ctx, s.x, s.y, s.width, s.height, s.cornerRadius || 0);
          ctx.stroke();
        }
        ctx.restore();
      });
    }
  }

  renderFrameShape(ctx, shape, showEditorGuides) {
    ctx.save();
    const radius = Math.max(0, Number(shape.cornerRadius) || 0);
    const hasFill = shape.fill && shape.fill !== "none" && shape.fill !== "transparent" && (shape.fillOpacity ?? 1) > 0;
    const hasStroke = shape.strokeWidth > 0 && shape.stroke && shape.stroke !== "none" && shape.stroke !== "transparent";

    this.drawRoundedRectPath(ctx, shape.x, shape.y, shape.width, shape.height, radius);
    if (hasFill) {
      ctx.fill();
    }
    if (hasStroke) {
      ctx.globalAlpha = 1.0;
      ctx.stroke();
    } else if (showEditorGuides && !hasFill) {
      ctx.globalAlpha = 1.0;
      ctx.strokeStyle = "rgba(100, 116, 139, 0.55)";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 3]);
      ctx.stroke();
    }
    ctx.restore();
  }

  renderMathPlot(ctx, shape) {
    const { x, y, width: w, height: h } = shape;
    const cfg = shape.mathConfig || {};
    const data = shape.mathData || {};
    const showAxes = cfg.showAxes === true;
    const showFrame = cfg.showFrame === true;

    ctx.save();
    ctx.globalAlpha = 1.0;
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();

    // 明示的に塗りつぶしが設定された場合のみ背景を描画
    if (shape.fill && shape.fill !== "none" && shape.fill !== "transparent" && (shape.fillOpacity ?? 0) > 0) {
      ctx.save();
      ctx.globalAlpha = shape.fillOpacity ?? 1;
      ctx.fillStyle = shape.fill;
      ctx.fillRect(x, y, w, h);
      ctx.restore();
    }

    // 枠は有効時のみ描画
    if (shape.strokeWidth > 0 && shape.stroke && shape.stroke !== "none" && shape.stroke !== "transparent") {
      ctx.strokeStyle = shape.stroke;
      ctx.lineWidth = shape.strokeWidth;
      ctx.strokeRect(x, y, w, h);
    } else if (showFrame) {
      ctx.strokeStyle = "rgba(148, 163, 184, 0.45)";
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, w, h);
    }

    // X軸・Y軸(有効時のみ)
    if (showAxes) {
      ctx.strokeStyle = "#94a3b8";
      ctx.lineWidth = 1;
      ctx.setLineDash([]);
      if (typeof data.axisXRatio === "number" && data.axisXRatio >= 0 && data.axisXRatio <= 1) {
        const ax = x + data.axisXRatio * w;
        ctx.beginPath();
        ctx.moveTo(ax, y);
        ctx.lineTo(ax, y + h);
        ctx.stroke();
      }
      if (typeof data.axisYRatio === "number" && data.axisYRatio >= 0 && data.axisYRatio <= 1) {
        const ay = y + data.axisYRatio * h;
        ctx.beginPath();
        ctx.moveTo(x, ay);
        ctx.lineTo(x + w, ay);
        ctx.stroke();
      }
    }

    // 曲線セグメント描画
    if (Array.isArray(data.segments) && data.segments.length > 0) {
      const lineColor = cfg.lineColor || (shape.stroke && shape.stroke !== "none" && shape.stroke !== "transparent" ? shape.stroke : "#2563eb");
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = cfg.lineWidth || 3;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      data.segments.forEach(seg => {
        if (!Array.isArray(seg) || seg.length < 2) return;
        ctx.beginPath();
        seg.forEach((pt, idx) => {
          const px = x + pt.x * w;
          const py = y + pt.y * h;
          if (idx === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        });
        ctx.stroke();
      });
    } else {
      ctx.fillStyle = "#64748b";
      ctx.font = "12px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const errTxt = window.I18N ? window.I18N.t("math.errorLabel") : "数式エラー";
      const outTxt = window.I18N ? window.I18N.t("math.outOfRange") : "表示範囲内に線なし";
      const calcTxt = window.I18N ? window.I18N.t("math.calculating") : "計算中...";
      const statusTxt = data.error ? errTxt : (Array.isArray(data.segments) ? outTxt : calcTxt);
      ctx.fillText(statusTxt, x + w / 2, y + h / 2);
    }

    ctx.restore();
  }

  // 単一図形描画
  renderShape(ctx, shape, options = {}) {
    ctx.save();

    const cx = shape.x + shape.width / 2;
    const cy = shape.y + shape.height / 2;

    // 変換マトリクス（移動・回転・反転・シアー）
    ctx.translate(cx, cy);
    if (shape.rotation) ctx.rotate((shape.rotation * Math.PI) / 180);
    ctx.scale(shape.flipH ? -1 : 1, shape.flipV ? -1 : 1);
    if (shape.shearX || shape.shearY) {
      ctx.transform(1, Math.tan((shape.shearY || 0) * Math.PI / 180), Math.tan((shape.shearX || 0) * Math.PI / 180), 1, 0, 0);
    }
    ctx.translate(-cx, -cy);

    // シャドウ設定
    if (shape.shadow) {
      ctx.shadowColor = shape.shadowColor;
      ctx.shadowBlur = shape.shadowBlur;
      ctx.shadowOffsetX = shape.shadowOffsetX;
      ctx.shadowOffsetY = shape.shadowOffsetY;
    }

    // 塗り・線スタイル設定
    ctx.fillStyle = shape.fill;
    ctx.globalAlpha = shape.fillOpacity ?? 1.0;
    ctx.strokeStyle = shape.stroke;
    ctx.lineWidth = shape.strokeWidth;

    if (shape.strokeDash === "dashed") {
      ctx.setLineDash([8, 5]);
    } else if (shape.strokeDash === "dotted") {
      ctx.setLineDash([3, 3]);
    } else {
      ctx.setLineDash([]);
    }

    // テキストオブジェクト
    if (shape.type === "text") {
      ctx.translate(shape.x, shape.y);
      TextWarpRenderer.renderWarpText(ctx, shape);
      ctx.restore();
      return;
    }

    // 数式グラフ・幾何学模様オブジェクト
    if (shape.type === "math_plot") {
      this.renderMathPlot(ctx, shape);
      ctx.restore();
      return;
    }

    // フレームオブジェクト
    if (shape.type === "frame") {
      this.renderFrameShape(ctx, shape, !!options.showEditorGuides);
      ctx.restore();
      return;
    }

    // パスまたは図形形状
    let path2d;
    if (shape.points && shape.points.length > 0) {
      const d = EditPointsManager.pointsToSvgPath(shape.points, shape.isPathClosed ?? true);
      path2d = new Path2D(d);
    } else {
      const def = ShapeDefinitions.getDefinition(shape.type);
      const d = def.generatePath(shape.width, shape.height, shape.adjustments);
      path2d = new Path2D(d);
    }

    ctx.translate(shape.x, shape.y);

    if (shape.fill && shape.fill !== "none" && shape.fill !== "transparent") {
      ctx.fill(path2d);
    }
    if (shape.strokeWidth > 0 && shape.stroke && shape.stroke !== "none" && shape.stroke !== "transparent") {
      ctx.stroke(path2d);
    }

    ctx.restore();
  }

  // 選択枠 ＆ ハンドル描画
  renderSelectionHandles(ctx, s, options = {}) {
    const locked = options.locked !== undefined ? !!options.locked : this.isEffectivelyLocked(s);
    const showHandles = options.showHandles !== undefined ? !!options.showHandles : (this.selectedShapeIds.size === 1 && !locked);
    ctx.save();
    const cx = s.x + s.width / 2;
    const cy = s.y + s.height / 2;

    ctx.translate(cx, cy);
    if (s.rotation) ctx.rotate((s.rotation * Math.PI) / 180);
    ctx.translate(-cx, -cy);

    const inv = 1 / Math.max(0.2, this.zoom || 1);

    // バウンディングボックス枠線（ロック時はグレー破線、複数または編集可能時は青枠）
    ctx.strokeStyle = locked ? "#94a3b8" : "#2563eb";
    ctx.lineWidth = (locked ? 1.2 : 1.5) * inv;
    ctx.setLineDash(locked ? [3 * inv, 3 * inv] : (showHandles ? [4 * inv, 3 * inv] : []));
    ctx.strokeRect(s.x, s.y, s.width, s.height);
    ctx.setLineDash([]);

    if (!showHandles) {
      ctx.restore();
      return;
    }

    // 8方向サイズ変更ハンドル (白い四角に青い枠)
    const hs = 8 * inv;
    const hh = hs / 2;
    const handles = this.getResizeHandles(s);
    handles.forEach(h => {
      ctx.fillStyle = "#ffffff";
      ctx.strokeStyle = "#2563eb";
      ctx.lineWidth = 1.5 * inv;
      ctx.fillRect(h.x - hh, h.y - hh, hs, hs);
      ctx.strokeRect(h.x - hh, h.y - hh, hs, hs);
    });

    // 上部回転ハンドル (青い線 + 緑の円)
    const rotHandle = this.getRotationHandle(s);
    ctx.beginPath();
    ctx.moveTo(s.x + s.width / 2, s.y);
    ctx.lineTo(rotHandle.x, rotHandle.y);
    ctx.strokeStyle = "#2563eb";
    ctx.lineWidth = 1.5 * inv;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(rotHandle.x, rotHandle.y, 5 * inv, 0, Math.PI * 2);
    ctx.fillStyle = "#10b981";
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.5 * inv;
    ctx.fill();
    ctx.stroke();

    // 黄色い調整ハンドル (PowerPoint固有の形状変形ハンドル)
    ctx.restore();
    const adjHandles = this.getAdjustmentHandles(s);
    adjHandles.forEach(h => {
      const wp = this.shapeLocalToWorld(h.x - s.x, h.y - s.y, s);
      this.drawDiamondHandle(ctx, wp.x, wp.y, "#f59e0b");
    });
  }

  drawDiamondHandle(ctx, x, y, color = "#f59e0b") {
    const inv = 1 / Math.max(0.2, this.zoom || 1);
    const hs = 10 * inv;
    const hh = hs / 2;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = color;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.5 * inv;
    ctx.fillRect(-hh, -hh, hs, hs);
    ctx.strokeRect(-hh, -hh, hs, hs);
    ctx.restore();
  }

  // 背景透過時のチェッカーボード描画
  drawCheckerboard(ctx, w, h, size = 16) {
    ctx.save();
    for (let y = 0; y < h; y += size) {
      for (let x = 0; x < w; x += size) {
        ctx.fillStyle = ((x / size + y / size) % 2 === 0) ? "#f8fafc" : "#e2e8f0";
        ctx.fillRect(x, y, size, size);
      }
    }
    ctx.restore();
  }

  // 「頂点の編集」用ハンドル描画
  renderEditPointsHandles(ctx, s) {
    if (!s.points) return;
    ctx.save();

    const cx = s.x + s.width / 2;
    const cy = s.y + s.height / 2;
    ctx.translate(cx, cy);
    if (s.rotation) ctx.rotate((s.rotation * Math.PI) / 180);
    ctx.scale(s.flipH ? -1 : 1, s.flipV ? -1 : 1);
    if (s.shearX || s.shearY) {
      ctx.transform(1, Math.tan((s.shearY || 0) * Math.PI / 180), Math.tan((s.shearX || 0) * Math.PI / 180), 1, 0, 0);
    }
    ctx.translate(-cx, -cy);
    ctx.translate(s.x, s.y);

    const inv = 1 / Math.max(0.2, this.zoom || 1);
    const hs = 8 * inv;
    const hh = hs / 2;

    // 各頂点（黒い四角）
    s.points.forEach((p, idx) => {
      const isSelected = idx === this.activePointIndex;

      // 選択されている頂点のベジェハンドル線
      if (isSelected) {
        if (p.hIn) {
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.hIn.x, p.hIn.y);
          ctx.strokeStyle = "#3b82f6";
          ctx.lineWidth = 1.2 * inv;
          ctx.stroke();

          // hInコントロールポイント(青い丸)
          ctx.beginPath();
          ctx.arc(p.hIn.x, p.hIn.y, 4 * inv, 0, Math.PI * 2);
          ctx.fillStyle = "#3b82f6";
          ctx.fill();
          ctx.stroke();
        }
        if (p.hOut) {
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.hOut.x, p.hOut.y);
          ctx.strokeStyle = "#3b82f6";
          ctx.lineWidth = 1.2 * inv;
          ctx.stroke();

          // hOutコントロールポイント(青い丸)
          ctx.beginPath();
          ctx.arc(p.hOut.x, p.hOut.y, 4 * inv, 0, Math.PI * 2);
          ctx.fillStyle = "#3b82f6";
          ctx.fill();
          ctx.stroke();
        }
      }

      // アンカーポイント本体(黒い四角形、選択時は白塗り黒枠)
      ctx.fillStyle = isSelected ? "#ffffff" : "#1e293b";
      ctx.strokeStyle = isSelected ? "#ef4444" : "#ffffff";
      ctx.lineWidth = 1.5 * inv;
      ctx.fillRect(p.x - hh, p.y - hh, hs, hs);
      ctx.strokeRect(p.x - hh, p.y - hh, hs, hs);
    });

    ctx.restore();
  }

  // --- ハンドル座標取得ヘルパー ---
  getResizeHandles(s) {
    const x = s.x, y = s.y, w = s.width, h = s.height;
    return [
      { id: "nw", x: x, y: y, cursor: "nwse-resize" },
      { id: "n",  x: x + w / 2, y: y, cursor: "ns-resize" },
      { id: "ne", x: x + w, y: y, cursor: "nesw-resize" },
      { id: "e",  x: x + w, y: y + h / 2, cursor: "ew-resize" },
      { id: "se", x: x + w, y: y + h, cursor: "nwse-resize" },
      { id: "s",  x: x + w / 2, y: y + h, cursor: "ns-resize" },
      { id: "sw", x: x, y: y + h, cursor: "nesw-resize" },
      { id: "w",  x: x, y: y + h / 2, cursor: "ew-resize" }
    ];
  }

  getRotationHandle(s) {
    const inv = 1 / Math.max(0.2, this.zoom || 1);
    return {
      id: "rot",
      x: s.x + s.width / 2,
      y: s.y - 24 * inv,
      cursor: "grab"
    };
  }

  getAdjustmentHandles(s) {
    const def = ShapeDefinitions.getDefinition(s.type);
    if (!def || !def.getAdjustmentHandles) return [];
    const localHandles = def.getAdjustmentHandles(s.width, s.height, s.adjustments);
    return localHandles.map(h => ({
      ...h,
      id: "adj_" + h.id,
      adjId: h.id,
      x: s.x + h.x,
      y: s.y + h.y,
      cursor: "pointer"
    }));
  }

  // --- ヒットテスト ---
  isPointInsideClippedAncestors(worldX, worldY, shape) {
    let cur = shape;
    const seen = new Set();
    while (cur && cur.parentId && !seen.has(cur.parentId)) {
      seen.add(cur.parentId);
      const parent = this.getShapeById(cur.parentId);
      if (!parent) break;
      if (parent.clipContent) {
        const pLocal = this.worldToShapeLocal(worldX, worldY, parent);
        if (pLocal.x < 0 || pLocal.x > parent.width || pLocal.y < 0 || pLocal.y > parent.height) {
          return false;
        }
      }
      cur = parent;
    }
    return true;
  }

  hitTestDirect(worldX, worldY) {
    const ordered = this.getRenderOrderedShapes();
    for (let i = ordered.length - 1; i >= 0; i--) {
      const s = ordered[i];
      if (!this.isEffectivelyVisible(s) || this.isEffectivelyLocked(s)) continue;
      const local = this.worldToShapeLocal(worldX, worldY, s);
      if (local.x >= 0 && local.x <= s.width && local.y >= 0 && local.y <= s.height) {
        if (this.isPointInsideClippedAncestors(worldX, worldY, s)) {
          return s;
        }
      }
    }
    return null;
  }

  hitTest(worldX, worldY, options = {}) {
    return this.resolveFigmaClickTarget(worldX, worldY, options);
  }

  selectAll() {
    this.selectedShapeIds = new Set(
      this.shapes.filter(s => this.isEffectivelyVisible(s) && !this.isEffectivelyLocked(s)).map(s => s.id)
    );
    this.render();
    this.onSelectionChange && this.onSelectionChange();
  }

  rotatePointAroundShapeCenter(wx, wy, s) {
    const rad = ((s.rotation || 0) * Math.PI) / 180;
    if (!rad) return { x: wx, y: wy };
    const cx = s.x + s.width / 2;
    const cy = s.y + s.height / 2;
    const dx = wx - cx;
    const dy = wy - cy;
    return {
      x: cx + dx * Math.cos(rad) - dy * Math.sin(rad),
      y: cy + dx * Math.sin(rad) + dy * Math.cos(rad)
    };
  }

  unrotatePointAroundShapeCenter(wx, wy, s) {
    const rad = (-(s.rotation || 0) * Math.PI) / 180;
    if (!rad) return { x: wx, y: wy };
    const cx = s.x + s.width / 2;
    const cy = s.y + s.height / 2;
    const dx = wx - cx;
    const dy = wy - cy;
    return {
      x: cx + dx * Math.cos(rad) - dy * Math.sin(rad),
      y: cy + dx * Math.sin(rad) + dy * Math.cos(rad)
    };
  }

  worldToShapeLocal(wx, wy, s) {
    const cx = s.x + s.width / 2;
    const cy = s.y + s.height / 2;
    const rad = (-(s.rotation || 0) * Math.PI) / 180;
    const cosR = Math.cos(rad);
    const sinR = Math.sin(rad);
    const dx = wx - cx;
    const dy = wy - cy;
    const rx = (dx * cosR - dy * sinR) * (s.flipH ? -1 : 1);
    const ry = (dx * sinR + dy * cosR) * (s.flipV ? -1 : 1);
    let lx = rx;
    let ly = ry;
    if (s.shearX || s.shearY) {
      const tanX = Math.tan(((s.shearX || 0) * Math.PI) / 180);
      const tanY = Math.tan(((s.shearY || 0) * Math.PI) / 180);
      const det = 1 - tanX * tanY;
      if (Math.abs(det) > 1e-9) {
        lx = (rx - tanX * ry) / det;
        ly = (-tanY * rx + ry) / det;
      }
    }
    return { x: lx + s.width / 2, y: ly + s.height / 2 };
  }

  shapeLocalToWorld(lx, ly, s) {
    const cx = s.x + s.width / 2;
    const cy = s.y + s.height / 2;
    let dx = lx - s.width / 2;
    let dy = ly - s.height / 2;
    if (s.shearX || s.shearY) {
      const tanX = Math.tan(((s.shearX || 0) * Math.PI) / 180);
      const tanY = Math.tan(((s.shearY || 0) * Math.PI) / 180);
      const sx = dx + tanX * dy;
      const sy = tanY * dx + dy;
      dx = sx;
      dy = sy;
    }
    if (s.flipH) dx = -dx;
    if (s.flipV) dy = -dy;
    const rad = ((s.rotation || 0) * Math.PI) / 180;
    const cosR = Math.cos(rad);
    const sinR = Math.sin(rad);
    const rx = dx * cosR - dy * sinR;
    const ry = dx * sinR + dy * cosR;
    return { x: cx + rx, y: cy + ry };
  }
}
