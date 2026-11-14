const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert");

const ROOT = __dirname;

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

// 1. i18nパリティとHTML整合チェック
const i18nSrc = read("public/js/i18n.js");
const m = i18nSrc.match(/ja:\s*\{([\s\S]*?)\},\s*en:\s*\{([\s\S]*?)\}\s*\};/);
assert(m, "Could not parse ja/en dictionaries");
const jaObj = eval("({" + m[1] + "})");
const enObj = eval("({" + m[2] + "})");
const jaKeys = Object.keys(jaObj);
const enKeys = Object.keys(enObj);
const missingEn = jaKeys.filter(k => !(k in enObj));
const missingJa = enKeys.filter(k => !(k in jaObj));
assert.strictEqual(missingEn.length, 0, "Missing EN keys: " + missingEn.join(", "));
assert.strictEqual(missingJa.length, 0, "Missing JA keys: " + missingJa.join(", "));

const html = read("public/index.html");
const domKeys = [...html.matchAll(/data-i18n(?:-title|-placeholder)?="([^"]+)"/g)].map(x => x[1]);
const missingDom = [...new Set(domKeys)].filter(k => !(k in jaObj));
assert.strictEqual(missingDom.length, 0, "Missing HTML i18n keys: " + missingDom.join(", "));

// UIガードとキャッシュバスター一貫性
assert(html.includes('id="layersPanel"') && html.includes('id="layersList"'), "Layers panel present");
assert(html.includes('id="constraintsDiagram"') && html.includes('id="selectConstraintH"'), "Constraints UI present");
assert(html.includes('id="minMaxSection"') && html.includes('id="inputMinW"'), "Min/Max UI present");
assert(html.includes('id="btnAlGapAuto"') && html.includes('id="selectAlStacking"'), "Auto Layout Gap Auto & Stacking present");
assert(html.includes('id="lockedSelectionBanner"') && html.includes('id="btnUnlockSelected"'), "Locked banner UI present");
const assetVersions = [
  ...html.matchAll(/(?:href="css\/[^"?]+\?v=([^"]+)"|src="js\/[^"?]+\?v=([^"]+)")/g)
].map(x => x[1] || x[2]);
assert(assetVersions.length >= 10, "All CSS and JS tags carry cache-buster query");
assert(new Set(assetVersions).size === 1, "All CSS/JS cache-busters share unified version: " + [...new Set(assetVersions)].join(", "));
assert(!html.includes('id="langToggleBtn"'), "EN button must not return");
assert(!html.includes('data-i18n="status.helpHint"'), "Status helpHint must not return");

console.log(`CHECK 1 PASS: i18n ja=${jaKeys.length} en=${enKeys.length} dom=${domKeys.length} version=${assetVersions[0]}`);

// 2. 仮想Canvas + Exporter + RubyCodeGenerator統合テスト
function makeCtxMock() {
  return {
    save() {}, restore() {}, beginPath() {}, closePath() {}, moveTo() {}, lineTo() {},
    bezierCurveTo() {}, quadraticCurveTo() {}, rect() {}, arc() {}, ellipse() {},
    fill() {}, stroke() {}, clip() {}, translate() {}, rotate() {}, scale() {}, transform() {}, setTransform() {},
    setLineDash() {}, fillRect() {}, strokeRect() {}, clearRect() {}, fillText() {}, strokeText() {},
    measureText(t) { return { width: String(t || "").length * 8 }; }
  };
}

function makeElMock() {
  return {
    width: 960, height: 540, style: {},
    getContext() { return makeCtxMock(); },
    getBoundingClientRect() { return { left: 0, top: 0, width: 960, height: 540 }; },
    addEventListener() {}
  };
}

function MockPath2D() {}

let lastRubyFetchPayload = null;
const storageMap = new Map([["ppt_lang", "ja"]]);
const sandbox = {
  console, Math, JSON, Date, Set, Map, Array, Object, Number, String, Boolean, Error,
  setTimeout: () => 0,
  clearTimeout: () => {},
  setInterval: () => 0,
  clearInterval: () => {},
  navigator: { onLine: true },
  location: { origin: "http://localhost:4567" },
  Path2D: MockPath2D,
  fetch: async (url, init) => {
    if (url === "/api/export/ruby" && init && init.body) {
      lastRubyFetchPayload = JSON.parse(init.body).project;
      return { ok: true, status: 200, text: async () => "# ruby code" };
    }
    if (String(url).startsWith("/api/sync")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ projects: [], serverTime: new Date().toISOString() }),
        text: async () => "{}"
      };
    }
    return { ok: true, status: 200, json: async () => ({}), text: async () => "" };
  },
  localStorage: {
    getItem: (k) => (storageMap.has(k) ? storageMap.get(k) : null),
    setItem: (k, v) => storageMap.set(k, String(v)),
    removeItem: (k) => storageMap.delete(k)
  },
  document: {
    documentElement: {},
    querySelectorAll: () => [],
    getElementById: () => makeElMock(),
    createElement: () => makeElMock()
  },
  addEventListener: () => {}
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

[
  "public/js/i18n.js",
  "public/js/shapes.js",
  "public/js/edit_points.js",
  "public/js/text_warp.js",
  "public/js/canvas.js",
  "public/js/exporter.js",
  "public/js/ruby_code_generator.js",
  "public/js/sync_manager.js"
].forEach(file => {
  vm.runInContext(read(file), sandbox, { filename: file });
});

const PPTCanvas = vm.runInContext("PPTCanvas", sandbox);
const canvas = new PPTCanvas(makeElMock());

// 2A. 通常図形・Frame階層のクリック・Enter/Shift+Enter・Ctrl直接選択
const freeRect = canvas.addShape("rectangle", { name: "FreeRect", x: 20, y: 20, width: 80, height: 60 });
const outer = canvas.addFrame({ name: "Outer", x: 150, y: 50, width: 400, height: 300 });
const inner = canvas.addFrame({ name: "Inner", x: 180, y: 80, width: 220, height: 180, parentId: outer.id });
const deepBox = canvas.addShape("rectangle", { name: "DeepBox", x: 200, y: 100, width: 60, height: 40, parentId: inner.id });
const siblingBox = canvas.addShape("rectangle", { name: "SiblingBox", x: 280, y: 100, width: 60, height: 40, parentId: inner.id });

canvas.deselectAll();
assert.strictEqual(canvas.hitTest(40, 40).id, freeRect.id, "Free shape hit directly");
assert.strictEqual(canvas.hitTest(220, 120).id, outer.id, "Figma first click hits outer frame");
canvas.selectShape(outer.id);
assert.strictEqual(canvas.enterContainerSelected({ x: 220, y: 120 }), true, "Enter into inner frame");
assert.strictEqual(canvas.getSelectedShape().id, inner.id, "Selected inner frame after 1st enter");
assert.strictEqual(canvas.enterContainerSelected({ x: 220, y: 120 }), true, "Enter into deepBox");
assert.strictEqual(canvas.getSelectedShape().id, deepBox.id, "Selected deepBox after 2nd enter");
assert.strictEqual(canvas.hitTest(300, 120).id, siblingBox.id, "Same-scope sibling hit directly");
assert.strictEqual(canvas.selectParentFrame(), true);
assert.strictEqual(canvas.getSelectedShape().id, inner.id);
assert.strictEqual(canvas.selectParentFrame(), true);
assert.strictEqual(canvas.getSelectedShape().id, outer.id);
canvas.deselectAll();
assert.strictEqual(canvas.hitTest(220, 120, { direct: true }).id, deepBox.id, "Direct Ctrl+click hits deepBox");

// 2B. Constraints検証
const conFrame = canvas.addFrame({ name: "ConFrame", x: 100, y: 100, width: 200, height: 200 });
const cRight = canvas.addShape("rectangle", { x: 240, y: 120, width: 40, height: 30, parentId: conFrame.id, constraints: { horizontal: "right", vertical: "top" } });
const cLR = canvas.addShape("rectangle", { x: 120, y: 160, width: 160, height: 20, parentId: conFrame.id, constraints: { horizontal: "leftright", vertical: "topbottom" } });
const cCenter = canvas.addShape("rectangle", { x: 180, y: 180, width: 40, height: 40, parentId: conFrame.id, constraints: { horizontal: "center", vertical: "center" } });
const cScale = canvas.addShape("rectangle", { x: 150, y: 150, width: 100, height: 100, parentId: conFrame.id, constraints: { horizontal: "scale", vertical: "scale" } });

const snap1 = canvas.captureFrameResizeState(conFrame);
conFrame.width = 300;
conFrame.height = 300;
canvas.applyConstraintsFromSnapshot(snap1, false);
assert.strictEqual(Math.round(cRight.x), 340, "Right pin preserves right offset");
assert.strictEqual(Math.round(cLR.width), 260, "Left&Right stretches width");
assert.strictEqual(Math.round(cLR.height), 120, "Top&Bottom stretches height");
assert.strictEqual(Math.round(cCenter.x), 230, "Center moves by half delta");
assert.strictEqual(Math.round(cScale.x), 175, "Scale scales x offset");
assert.strictEqual(Math.round(cScale.width), 150, "Scale scales width");

const snapIgnore = canvas.captureFrameResizeState(conFrame);
conFrame.width = 400;
canvas.applyConstraintsFromSnapshot(snapIgnore, true);
assert.strictEqual(Math.round(cRight.x), 340, "Ctrl ignores constraints");

// 2C. Auto Layout検証
const alFrame = canvas.addFrame({
  name: "ALFrame", x: 50, y: 50, width: 300, height: 140,
  autoLayout: { enabled: true, direction: "row", sizingH: "fixed", sizingV: "fixed", gap: 10, gapMode: "auto", paddingLeft: 20, paddingRight: 20, paddingTop: 20, paddingBottom: 20, align: "center-left", canvasStacking: "first-on-top" }
});
const a1 = canvas.addShape("rectangle", { name: "A1", width: 50, height: 40, fill: "#112233", parentId: alFrame.id });
const a2 = canvas.addShape("rectangle", { name: "A2", width: 50, height: 40, fill: "#445566", parentId: alFrame.id });
const aAbs = canvas.addShape("rectangle", { name: "AbsBadge", x: 310, y: 60, width: 20, height: 20, fill: "#abcdef", parentId: alFrame.id, layoutPositioning: "absolute" });
canvas.applyAutoLayout(alFrame.id);
assert.strictEqual(Math.round(a1.x), 70, "Auto gap places first child at left pad");
assert.strictEqual(Math.round(a2.x), 280, "Auto gap places second child at right pad edge");
assert.strictEqual(Math.round(aAbs.x), 310, "Absolute child ignored by flow");

alFrame.autoLayout.gapMode = "fixed";
alFrame.autoLayout.gap = -10;
canvas.applyAutoLayout(alFrame.id);
assert.strictEqual(Math.round(a2.x), 110, "Negative gap overlaps children");
const guides = canvas.getAutoLayoutSpacingGuides(alFrame);
assert(guides.some(g => g.kind === "gap" && g.value === -10), "Spacing guide exposes negative gap");

alFrame.autoLayout.direction = "wrap";
alFrame.autoLayout.gap = 20;
alFrame.autoLayout.crossGap = 35;
alFrame.width = 120;
alFrame.autoLayout.align = "top-left";
canvas.applyAutoLayout(alFrame.id);
assert.strictEqual(Math.round(a2.y), Math.round(alFrame.y + 20 + 40 + 35), "Wrap uses crossGap");

const nestedChild = canvas.addFrame({
  name: "NestedChild", width: 20, height: 20, minWidth: 120, maxWidth: 160,
  parentId: alFrame.id, layoutSizingH: "fixed",
  autoLayout: { enabled: true, direction: "row", sizingH: "hug", sizingV: "hug", paddingLeft: 10, paddingRight: 10, paddingTop: 10, paddingBottom: 10, gap: 8 }
});
canvas.addShape("rectangle", { width: 40, height: 20, fill: "#fedcba", parentId: nestedChild.id });
alFrame.autoLayout.direction = "row";
alFrame.autoLayout.sizingH = "hug";
canvas.applyAutoLayout(alFrame.id);
assert.strictEqual(Math.round(nestedChild.width), 120, "Child frame minWidth clamps hug width to 120");

const renderOrdered = PPTCanvas.getRenderOrderedShapes(canvas.shapes);
assert(renderOrdered.findIndex(s => s.id === a1.id) > renderOrdered.findIndex(s => s.id === a2.id), "first-on-top renders a1 after (above) a2");

const ind = canvas.computeAutoLayoutInsertion(alFrame.id, a1.x + 2, a1.y + 10, new Set());
assert(ind && ind.frameId === alFrame.id && ind.index === 0, "Drop insertion computes index 0");

const extraItem = canvas.addShape("rectangle", { name: "Extra", x: 600, y: 300, width: 30, height: 30 });
canvas.insertShapesIntoFrame([extraItem.id], alFrame.id, 1);
canvas.applyAutoLayout(alFrame.id);
const alFlowIds = canvas.getChildren(alFrame.id).filter(c => c.layoutPositioning !== "absolute").map(c => c.id);
assert.strictEqual(alFlowIds[1], extraItem.id, "insertShapesIntoFrame places item at flow index 1");

// 2D. 可視・ロック・階層移動・出力フィルタ
canvas.setLayerVisible(aAbs.id, false);
const lockParent = canvas.addFrame({ name: "LockParent", x: 680, y: 40, width: 160, height: 120 });
const lockChild = canvas.addShape("rectangle", { name: "LockChild", x: 700, y: 60, width: 60, height: 50, parentId: lockParent.id });
assert.strictEqual(canvas.hitTest(720, 80, { direct: true }).id, lockChild.id, "Unlocked child hits directly");
canvas.setLayerLocked(lockChild.id, true);
assert.strictEqual(canvas.hitTest(720, 80, { direct: true }).id, lockParent.id, "Locked child skipped by hitTestDirect");

canvas.moveLayerInHierarchy([freeRect.id], conFrame.id, "inside");
assert.strictEqual(freeRect.parentId, conFrame.id, "moveLayerInHierarchy places layer inside frame");

const svgStr = sandbox.PPTExporter.buildSvgString(canvas);
assert(!svgStr.includes("#abcdef"), "SVG excludes hidden shape #abcdef");
assert(svgStr.indexOf("#445566") < svgStr.indexOf("#112233"), "SVG honors first-on-top stacking");

(async () => {
  const visCountCanvas = canvas.shapes.filter(s => canvas.isEffectivelyVisible(s)).length;
  await sandbox.RubyCodeGenerator.generateViaServer(canvas);
  assert.strictEqual(lastRubyFetchPayload.shapes.length, visCountCanvas, "Ruby payload excludes hidden layers");
  assert(!lastRubyFetchPayload.shapes.some(s => s.id === aAbs.id), "Hidden shape excluded from Ruby payload");

  canvas.setLayerVisible(nestedChild.id, false);
  const svgStrAfterHide = sandbox.PPTExporter.buildSvgString(canvas);
  assert(!svgStrAfterHide.includes("#fedcba"), "SVG hides descendant when parent frame hidden");
  const visAfterHideParent = canvas.shapes.filter(s => canvas.isEffectivelyVisible(s)).length;
  await sandbox.RubyCodeGenerator.generateViaServer(canvas);
  assert.strictEqual(lastRubyFetchPayload.shapes.length, visAfterHideParent, "Hiding parent frame excludes its children too");

  // 2E. create_frameモード
  canvas.setMode("create_frame");
  assert.strictEqual(canvas.mode, "create_frame");
  const fCreated = canvas.addFrame({ x: 10, y: 10, width: 150, height: 90 });
  assert.strictEqual(fCreated.type, "frame");
  assert.strictEqual(fCreated.width, 150);

  // 2F. 読込時階層正規化・数式ラベル分化
  const SyncManager = vm.runInContext("SyncManager", sandbox);
  const syncMgr = new SyncManager.Manager(canvas);
  canvas.enteredContainerId = "stale-container-id";

  const legacyProject = {
    id: "legacy-proj-1",
    title: "Legacy Test",
    canvas: { width: 300, height: 200, background: "#ffffff" },
    shapes: [
      { id: "child-1", type: "rectangle", name: "ChildRect", x: 20, y: 20, width: 40, height: 30, parentId: "parent-frame-1" },
      { id: "parent-frame-1", type: "frame", name: "ParentFrame", x: 10, y: 10, width: 120, height: 80, autoLayout: { enabled: true, direction: "horizontal" } },
      { id: "math-pending", type: "math_plot", name: "PendingPlot", x: 140, y: 20, width: 100, height: 80, expression: "x^2" }
    ]
  };
  syncMgr.setCurrentProject(legacyProject);

  assert.strictEqual(canvas.enteredContainerId, null, "enteredContainerId must be reset on project load");
  const pIdx = canvas.shapes.findIndex(s => s.id === "parent-frame-1");
  const cIdx = canvas.shapes.findIndex(s => s.id === "child-1");
  assert(pIdx !== -1 && cIdx !== -1 && pIdx < cIdx, "Parent frame must precede child after normalizeHierarchy");
  const loadedParent = canvas.shapes[pIdx];
  const loadedChild = canvas.shapes[cIdx];
  assert.strictEqual(loadedParent.visible, true, "visible normalized to true");
  assert.strictEqual(loadedParent.locked, false, "locked normalized to false");
  assert.strictEqual(loadedParent.autoLayout.gapMode, "fixed", "autoLayout.gapMode normalized to fixed");
  assert.deepStrictEqual(
    { horizontal: loadedChild.constraints.horizontal, vertical: loadedChild.constraints.vertical },
    { horizontal: "left", vertical: "top" },
    "constraints normalized"
  );

  function captureMathPlotTexts(mathData) {
    const texts = [];
    const spyCtx = Object.assign(makeCtxMock(), {
      fillText(t) { texts.push(String(t)); }
    });
    canvas.renderMathPlot(spyCtx, {
      id: "m-test", type: "math_plot", x: 10, y: 10, width: 120, height: 80,
      expression: "x^2", xMin: -5, xMax: 5, yMin: -5, yMax: 5,
      showAxes: true, showGrid: false, strokeColor: "#2563eb", strokeWidth: 2,
      mathData
    });
    return texts;
  }

  assert(captureMathPlotTexts(null).includes("計算中..."), "Pending mathData shows calculating label");
  const outRangeTexts = captureMathPlotTexts({ segments: [], error: null });
  assert(outRangeTexts.includes("表示範囲内に線なし") && !outRangeTexts.includes("計算中..."), "Evaluated empty segments shows outOfRange label");
  assert(captureMathPlotTexts({ segments: [], error: "syntax error" }).includes("数式エラー"), "Error mathData shows error label");

  // 2G. ロック・複数選択の一貫性
  canvas.setMode("select");
  canvas.shapes = [];
  canvas.selectedShapeIds.clear();
  const lockFrame = canvas.addFrame({ name: "LockFrame", x: 10, y: 10, width: 200, height: 150 });
  const lockedChild = canvas.addShape("rectangle", { name: "ChildA", x: 20, y: 20, width: 50, height: 40, parentId: lockFrame.id });
  const unlockedBox = canvas.addShape("rectangle", { name: "BoxB", x: 240, y: 20, width: 60, height: 40 });
  const unlockedBox2 = canvas.addShape("rectangle", { name: "BoxC", x: 320, y: 20, width: 60, height: 40 });

  function captureHandleDraw(shape, opts) {
    let fillRectCount = 0;
    let arcCount = 0;
    const strokeColors = [];
    const spyCtx = Object.assign(makeCtxMock(), {
      fillRect() { fillRectCount++; },
      arc() { arcCount++; }
    });
    Object.defineProperty(spyCtx, "strokeStyle", {
      set(v) { strokeColors.push(v); },
      configurable: true
    });
    canvas.renderSelectionHandles(spyCtx, shape, opts);
    return { fillRectCount, arcCount, strokeColors };
  }

  canvas.selectShape(unlockedBox.id);
  const unlockedDraw = captureHandleDraw(unlockedBox);
  assert(unlockedDraw.fillRectCount >= 8 && unlockedDraw.arcCount === 1, "Single unlocked draws resize + rot handles");

  canvas.selectShape(unlockedBox2.id, true);
  const multiDraw = captureHandleDraw(unlockedBox);
  assert.strictEqual(multiDraw.fillRectCount, 0, "Multi-select hides individual resize handles");
  assert.strictEqual(multiDraw.arcCount, 0, "Multi-select hides individual rotation handle");
  assert(multiDraw.strokeColors.includes("#2563eb"), "Multi-select keeps blue border");

  canvas.toggleFlipH();
  assert(unlockedBox.flipH === true && unlockedBox2.flipH === true, "Multi toggleFlipH flips all selected");
  canvas.setShear(15, -10);
  assert.strictEqual(unlockedBox.shearX, 15);
  assert.strictEqual(unlockedBox2.shearY, -10);

  canvas.setLayerLocked(lockFrame.id, true);
  canvas.selectShape(lockedChild.id);
  const lockedDraw = captureHandleDraw(lockedChild);
  assert.strictEqual(lockedDraw.fillRectCount, 0, "Locked shape hides resize handles");
  assert.strictEqual(lockedDraw.arcCount, 0, "Locked shape hides rotation handle");
  assert(lockedDraw.strokeColors.includes("#94a3b8"), "Locked shape uses muted border color");

  const countBefore = canvas.shapes.length;
  canvas.duplicateSelected();
  assert.strictEqual(canvas.shapes.length, countBefore, "Locked shape cannot be duplicated");
  canvas.toggleFlipH();
  assert.strictEqual(lockedChild.flipH, false, "Locked shape cannot be flipped");
  canvas.setShear(30, 0);
  assert.strictEqual(lockedChild.shearX, 0, "Locked shape cannot be sheared");
  canvas.enterEditPointsMode();
  assert.strictEqual(canvas.mode, "select", "Locked shape cannot enter edit_points mode");
  canvas.frameSelected(false);
  assert.strictEqual(canvas.shapes.length, countBefore, "Locked-only selection must not create empty frame");
  canvas.removeFromParent();
  assert.strictEqual(lockedChild.parentId, lockFrame.id, "Locked child cannot be detached from parent");

  canvas.selectShape(unlockedBox2.id, true);
  canvas.deleteSelected();
  assert(!canvas.getShapeById(unlockedBox2.id), "Unlocked shape deleted in mixed delete");
  assert(canvas.getShapeById(lockedChild.id), "Locked child preserved in mixed delete");
  assert(canvas.selectedShapeIds.has(lockedChild.id) && !canvas.selectedShapeIds.has(unlockedBox2.id), "Only locked id remains selected");

  assert.strictEqual(canvas.unlockSelected(), true, "unlockSelected unlocks ancestor frame");
  assert.strictEqual(canvas.isEffectivelyLocked(lockedChild), false, "Child unlocked after unlockSelected");

  // 2H. 複数選択のZ順変更と兄弟単位移動
  canvas.shapes = [];
  canvas.selectedShapeIds.clear();
  const zFrameA = canvas.addFrame({ name: "zFrameA", x: 10, y: 10, width: 300, height: 100 });
  const a1 = canvas.addShape("rectangle", { name: "a1", x: 20, y: 20, width: 30, height: 30, parentId: zFrameA.id });
  const a2 = canvas.addShape("rectangle", { name: "a2", x: 60, y: 20, width: 30, height: 30, parentId: zFrameA.id });
  const a3 = canvas.addShape("rectangle", { name: "a3", x: 100, y: 20, width: 30, height: 30, parentId: zFrameA.id });
  const a4 = canvas.addShape("rectangle", { name: "a4", x: 140, y: 20, width: 30, height: 30, parentId: zFrameA.id });
  const zFrameB = canvas.addFrame({ name: "zFrameB", x: 10, y: 140, width: 200, height: 80 });
  const b1 = canvas.addShape("rectangle", { name: "b1", x: 20, y: 150, width: 30, height: 30, parentId: zFrameB.id });
  const b2 = canvas.addShape("rectangle", { name: "b2", x: 60, y: 150, width: 30, height: 30, parentId: zFrameB.id });
  const topBox = canvas.addShape("rectangle", { name: "topBox", x: 350, y: 10, width: 40, height: 40 });

  let selChangeCalls = 0;
  const prevOnSel = canvas.onSelectionChange;
  canvas.onSelectionChange = () => { selChangeCalls++; };

  canvas.selectShape(a1.id, false);
  canvas.selectShape(a3.id, true);
  selChangeCalls = 0;
  assert.strictEqual(canvas.bringForward(), true);
  assert.deepStrictEqual([...canvas.getChildren(zFrameA.id).map(s => s.id)], [a2.id, a1.id, a4.id, a3.id], "Multi bringForward preserves sibling scope");
  assert.strictEqual(selChangeCalls, 1, "onSelectionChange fired after z-order change");

  canvas.selectShape(a1.id, false);
  canvas.selectShape(a4.id, true);
  canvas.selectShape(b2.id, true);
  assert.strictEqual(canvas.sendBackward(), true);
  assert.deepStrictEqual([...canvas.getChildren(zFrameA.id).map(s => s.id)], [a1.id, a4.id, a2.id, a3.id], "Contiguous multi sendBackward stays grouped");
  assert.deepStrictEqual([...canvas.getChildren(zFrameB.id).map(s => s.id)], [b2.id, b1.id], "Cross-parent sendBackward updates FrameB siblings too");

  canvas.selectShape(a1.id, false);
  canvas.selectShape(a4.id, true);
  const histLenBeforeNoop = canvas.history.length;
  assert.strictEqual(canvas.sendBackward(), false, "Boundary sendBackward returns false");
  assert.strictEqual(canvas.history.length, histLenBeforeNoop, "No-op sendBackward does not push undo history");

  zFrameA.autoLayout.enabled = true;
  canvas.selectShape(a1.id, false);
  canvas.selectShape(a2.id, true);
  assert.strictEqual(canvas.bringToFront(), true);
  assert.deepStrictEqual([...canvas.getChildren(zFrameA.id).map(s => s.id)], [a4.id, a3.id, a1.id, a2.id], "Multi bringToFront preserves relative order inside FrameA");
  assert(a4.x < a3.x && a3.x < a1.x && a1.x < a2.x, "Auto Layout re-applied to parent frame after z-order");

  canvas.selectShape(zFrameA.id, false);
  canvas.selectShape(a1.id, true);
  assert.strictEqual(canvas.bringToFront(), true);
  assert.deepStrictEqual([...canvas.shapes.filter(s => !s.parentId).map(s => s.id)], [zFrameB.id, topBox.id, zFrameA.id], "Top-level FrameA moves with descendants");
  assert.deepStrictEqual([...canvas.getChildren(zFrameA.id).map(s => s.id)], [a4.id, a3.id, a1.id, a2.id], "FrameA children order intact");

  canvas.setLayerLocked(a4.id, true);
  canvas.selectShape(a4.id, false);
  assert.strictEqual(canvas.bringToFront(), false, "Locked shape cannot change z-order");
  canvas.onSelectionChange = prevOnSel;

  // 2I. 回転付きclipContentフレームのSVG clipPath追従
  canvas.shapes = [];
  const clipFrameRot = canvas.addFrame({
    x: 40, y: 50, width: 120, height: 80,
    cornerRadius: 100, clipContent: true,
    fill: "transparent", stroke: "#000000", strokeWidth: 2
  });
  clipFrameRot.rotation = 30;
  clipFrameRot.flipH = true;
  canvas.addShape("rectangle", {
    x: 20, y: 20, width: 160, height: 120,
    parentId: clipFrameRot.id, fill: "#ef4444"
  });
  const svgClipOut = sandbox.PPTExporter.buildSvgString(canvas);
  assert(svgClipOut.includes(`<clipPath id="clip_${clipFrameRot.id}"><rect`), "SVG contains clipPath for rotated frame");
  assert(svgClipOut.includes(`rx="40" ry="40" transform="translate(`), "clipPath rect clamps rx/ry and includes transform");
  assert(svgClipOut.includes(`rotate(30) scale(-1, 1)`), "clipPath transform preserves rotation and flipH");
  assert(svgClipOut.includes(`clip-path="url(#clip_${clipFrameRot.id})"`), "Child shapes wrapped in clip-path group");

  // 2J. Frame左上ラベル改名とCtrl+C/Ctrl+Vコピペ
  canvas.shapes = [];
  canvas.clipboard = null;
  canvas.enteredContainerId = null;

  const lblFrame = canvas.addFrame({ name: "OriginalFrame", x: 100, y: 80, width: 200, height: 140 });
  const lblChild = canvas.addShape("rectangle", { name: "InnerBox", x: 120, y: 100, width: 50, height: 40, parentId: lblFrame.id });
  const hitLabel = canvas.hitTestFrameLabel(115, 70);
  assert.strictEqual(hitLabel && hitLabel.id, lblFrame.id, "hitTestFrameLabel hits above top-left of frame");
  assert.strictEqual(canvas.renameShape(lblFrame.id, "RenamedFrame"), true, "renameShape succeeds on unlocked frame");
  assert.strictEqual(lblFrame.name, "RenamedFrame", "Frame name updated by renameShape");
  canvas.setLayerLocked(lblFrame.id, true);
  assert.strictEqual(canvas.hitTestFrameLabel(115, 70), null, "Locked frame label ignored by hitTestFrameLabel");
  assert.strictEqual(canvas.renameShape(lblFrame.id, "ShouldFail"), false, "renameShape blocked while locked");
  canvas.setLayerLocked(lblFrame.id, false);

  canvas.selectShape(lblFrame.id, false);
  assert.strictEqual(canvas.copySelected(), true, "copySelected copies frame with descendants");
  assert.strictEqual(canvas.hasClipboard(), true, "hasClipboard true after copySelected");

  assert.strictEqual(canvas.pasteClipboard(), true, "First paste succeeds");
  const firstPasted = canvas.getShapeById([...canvas.selectedShapeIds][0]);
  assert(firstPasted && firstPasted.id !== lblFrame.id && firstPasted.parentId === null, "First pasted frame is sibling at root");
  assert.strictEqual(firstPasted.x, lblFrame.x + 20, "First paste offsets +20px");
  assert.strictEqual(canvas.getChildren(firstPasted.id)[0].x, lblChild.x + 20, "Pasted child follows +20px offset");

  assert.strictEqual(canvas.pasteClipboard(), true, "Second paste succeeds");
  const secondPasted = canvas.getShapeById([...canvas.selectedShapeIds][0]);
  assert(secondPasted && secondPasted.parentId === null, "Second paste does not nest inside first pasted frame");
  assert.strictEqual(secondPasted.x, lblFrame.x + 40, "Second paste offsets +40px");

  const destALFrame = canvas.addFrame({ name: "DestAL", x: 450, y: 80, width: 220, height: 140, autoLayout: { enabled: true, direction: "horizontal", gap: 10, paddingTop: 10, paddingRight: 10, paddingBottom: 10, paddingLeft: 10 } });
  canvas.selectShape(lblChild.id, false);
  assert.strictEqual(canvas.copySelected(), true);
  canvas.selectShape(destALFrame.id, false);
  assert.strictEqual(canvas.pasteClipboard(), true, "Paste while another frame is selected places clone inside that frame");
  assert.strictEqual(canvas.getChildren(destALFrame.id)[0].x, destALFrame.x + 10, "Auto Layout arranges pasted child");

  canvas.deselectAll();
  assert.strictEqual(canvas.pasteClipboard(), true, "Paste with no selection places clone at root");
  assert.strictEqual(canvas.getShapeById([...canvas.selectedShapeIds][0]).parentId, null, "Root paste has null parentId");

  // 2K. 開いた2点パス(fillline逆インポート形式)のSVG出力確認
  canvas.shapes = [];
  canvas.addShape("rectangle", {
    name: "直線",
    x: 10, y: 47, width: 100, height: 6,
    fill: "none", stroke: "#ff0000", strokeWidth: 5,
    isPathClosed: false,
    points: [{ x: 0, y: 3, type: "corner" }, { x: 100, y: 3, type: "corner" }]
  });
  const lineSvg = sandbox.PPTExporter.buildSvgString(canvas);
  assert(lineSvg.includes('M 0.00 3.00 L 100.00 3.00'), "Open line path generates open M..L path");
  assert(lineSvg.includes('fill="none"') && lineSvg.includes('stroke="#ff0000"') && lineSvg.includes('stroke-width="5"'), "Open line path exports to SVG with stroke only");
  assert(!lineSvg.includes('Z"'), "Open line path does not close SVG path");

  // 2L. cutSelected(切り取り)の検証(ロック保護・子孫追従・貼り付け)
  canvas.shapes = [];
  canvas.clipboard = null;
  canvas.enteredContainerId = null;
  const cutFrame = canvas.addFrame({ name: "CutFrame", x: 50, y: 60, width: 140, height: 100 });
  const cutChild = canvas.addShape("rectangle", { name: "CutChild", x: 70, y: 80, width: 40, height: 30, parentId: cutFrame.id });
  const lockedBox = canvas.addShape("rectangle", { name: "LockedBox", x: 250, y: 60, width: 50, height: 50, locked: true });
  canvas.selectShape(lockedBox.id, false);
  assert.strictEqual(canvas.cutSelected(), false, "cutSelected returns false when only locked shape is selected");
  assert(canvas.getShapeById(lockedBox.id), "Locked shape remains after cutSelected");

  canvas.selectShape(cutFrame.id, false);
  canvas.selectShape(lockedBox.id, true);
  assert.strictEqual(canvas.cutSelected(), true, "cutSelected succeeds when editable shape is included");
  assert.strictEqual(canvas.getShapeById(cutFrame.id), null, "Cut frame is removed");
  assert.strictEqual(canvas.getShapeById(cutChild.id), null, "Cut frame child is removed");
  assert(canvas.getShapeById(lockedBox.id), "Locked shape is preserved during mixed cut");
  assert.strictEqual(canvas.hasClipboard(), true, "hasClipboard true after cutSelected");
  assert.strictEqual(canvas.pasteClipboard(), true, "pasteClipboard restores cut frame");
  const pastedCutFrame = canvas.getShapeById([...canvas.selectedShapeIds][0]);
  assert(pastedCutFrame && pastedCutFrame.name === "CutFrame", "Pasted frame matches cut frame");
  assert.strictEqual(canvas.getChildren(pastedCutFrame.id).length, 1, "Pasted frame keeps its child");

  // 2M. スマートガイド(赤い配置・スナップ補助線)の計算検証
  canvas.shapes = [];
  const refBox = canvas.addShape("rect", { x: 100, y: 100, width: 100, height: 80 });
  const moveBox = canvas.addShape("rect", { x: 250, y: 200, width: 80, height: 60 });
  const g1 = canvas.computeSmartGuides({ x: 103, y: 225, width: 80, height: 60 }, new Set([moveBox.id]));
  assert.strictEqual(g1.snapDx, -3, "Smart guide snaps left edge to refBox left edge");
  assert.strictEqual(g1.snapDy, 0, "Smart guide does not snap Y when outside threshold");
  const g2 = canvas.computeSmartGuides({ x: 443, y: 137, width: 80, height: 60 }, new Set([moveBox.id]));
  assert.strictEqual(g2.snapDx, -3, "Smart guide snaps center X to canvas center (480)");
  assert.strictEqual(g2.snapDy, 3, "Smart guide snaps top Y (140) to refBox center Y (140)");
  assert.strictEqual(g2.guides.length, 2, "Smart guide emits vertical and horizontal guide lines");

  // 2N. H-1: id無し図形の重複排除
  const noIdOrdered = canvas.constructor.getRenderOrderedShapes([
    { type: "rect", x: 10, y: 10, width: 40, height: 40 },
    { type: "ellipse", x: 60, y: 10, width: 40, height: 40 }
  ]);
  assert.strictEqual(noIdOrdered.length, 2, "H-1: getRenderOrderedShapes must not duplicate id-less shapes");

  // 2O. H-2: Web版Rubyコード生成でpolygonPointsを付与しない
  canvas.shapes = [];
  canvas.addShape("star5", { x: 10, y: 10, width: 80, height: 80 });
  await sandbox.RubyCodeGenerator.generateViaServer(canvas);
  assert(lastRubyFetchPayload && lastRubyFetchPayload.shapes.length === 1, "H-2: payload contains star5");
  assert(!("polygonPoints" in lastRubyFetchPayload.shapes[0]), "H-2: Web RubyCodeGenerator delegates geometry to server without polygonPoints");

  // 2P. H-3 & L-1 & L-2: 回転・反転・シアー往復、Frameラベル追従、selectAllロック除外
  const xfShape = canvas.addShape("rect", { x: 100, y: 100, width: 80, height: 60, rotation: 35, flipH: true, shearX: 20 });
  const worldPt = canvas.shapeLocalToWorld(15, 25, xfShape);
  const backLocal = canvas.worldToShapeLocal(worldPt.x, worldPt.y, xfShape);
  assert(Math.abs(backLocal.x - 15) < 1e-6 && Math.abs(backLocal.y - 25) < 1e-6, "H-3: worldToShapeLocal/shapeLocalToWorld roundtrip matches");
  const rotPt = canvas.rotatePointAroundShapeCenter(100, 100, xfShape);
  const backRot = canvas.unrotatePointAroundShapeCenter(rotPt.x, rotPt.y, xfShape);
  assert(Math.abs(backRot.x - 100) < 1e-6 && Math.abs(backRot.y - 100) < 1e-6, "H-3: rotate/unrotate roundtrip matches");

  const rotFrame = canvas.addFrame({ name: "RotFrame", x: 200, y: 100, width: 100, height: 60 });
  rotFrame.rotation = 90;
  const lblRect = canvas.getFrameLabelRect(rotFrame);
  assert(Math.abs(lblRect.x - 280) < 1e-6, "L-1: rotated frame label x follows rotated top-left corner");

  const lockedItem = canvas.addShape("rect", { x: 10, y: 10, width: 30, height: 30, locked: true });
  canvas.selectAll();
  assert(!canvas.selectedShapeIds.has(lockedItem.id), "L-2: selectAll excludes locked shapes");
  assert(canvas.selectedShapeIds.has(xfShape.id), "L-2: selectAll includes unlocked visible shapes");

  // 2Q. H-4 & M-2: SVGエスケープと複数行テキストtspan
  canvas.shapes = [];
  canvas.addShape("text", {
    x: 10, y: 10, width: 120, height: 80,
    text: "Hello\nWorld",
    fontFamily: '"Segoe UI", sans-serif',
    fill: '#000" data-evil="1'
  });
  const multiSvg = sandbox.PPTExporter.buildSvgString(canvas);
  assert(multiSvg.includes("&quot;Segoe UI&quot;"), "H-4: JS SVG export escapes fontFamily quotes");
  assert(!multiSvg.includes('data-evil="1"'), "H-4: JS SVG export escapes fill attribute");
  assert(multiSvg.includes("<tspan "), "M-2: JS SVG export splits multiline text into <tspan>");

  // 2R. ズーム時のスマートガイド閾値と回転ハンドルオフセットのスケーリング
  canvas.shapes = [];
  const zRef = canvas.addShape("rect", { x: 100, y: 100, width: 100, height: 80 });
  const zMove = canvas.addShape("rect", { x: 250, y: 200, width: 80, height: 60 });
  canvas.zoom = 2.0;
  const gZoom2 = canvas.computeSmartGuides({ x: 105, y: 225, width: 80, height: 60 }, new Set([zMove.id]));
  assert.strictEqual(gZoom2.snapDx, 0, "Zoom 2.0 scales smart guide threshold down to 3px (5px does not snap)");
  assert.strictEqual(canvas.getRotationHandle(zRef).y, zRef.y - 12, "Zoom 2.0 scales rotation handle offset to 12px");
  canvas.zoom = 0.5;
  const gZoom05 = canvas.computeSmartGuides({ x: 209, y: 225, width: 80, height: 60 }, new Set([zMove.id]));
  assert.strictEqual(gZoom05.snapDx, -9, "Zoom 0.5 scales smart guide threshold up to 12px (9px snaps to right edge)");
  assert.strictEqual(canvas.getRotationHandle(zRef).y, zRef.y - 48, "Zoom 0.5 scales rotation handle offset to 48px");
  canvas.zoom = 1.0;

  console.log("CHECK 2 PASS: All frontend modules verified!");
  process.exit(0);
})().catch(err => {
  console.error(err);
  process.exit(1);
});
