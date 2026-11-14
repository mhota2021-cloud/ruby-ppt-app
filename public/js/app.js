// public/js/app.js
// アプリ初期化、イベントリスナー、PowerPoint風UIとCanvas・同期エンジンの連動

document.addEventListener("DOMContentLoaded", () => {
  if (window.I18N) {
    I18N.applyDomTranslations(document);
  }

  const canvasElement = document.getElementById("slideCanvas");
  const canvas = new PPTCanvas(canvasElement);

  // 同期マネージャー初期化
  const syncManager = new SyncManager.Manager(canvas);

  // --- UI要素の参照 ---
  const brandMenuBtn = document.getElementById("brandMenuBtn");
  const brandMenuPopover = document.getElementById("brandMenuPopover");
  const menuNewSlide = document.getElementById("menuNewSlide");
  const menuNewAsset = document.getElementById("menuNewAsset");
  const menuOpenProjects = document.getElementById("menuOpenProjects");
  const menuImport = document.getElementById("menuImport");
  const menuExport = document.getElementById("menuExport");
  const menuViewRuby = document.getElementById("menuViewRuby");
  const menuToggleGrid = document.getElementById("menuToggleGrid");
  const menuGridState = document.getElementById("menuGridState");
  const menuAddFrame = document.getElementById("menuAddFrame");
  const menuFrameSelected = document.getElementById("menuFrameSelected");
  const menuAutoLayoutSelected = document.getElementById("menuAutoLayoutSelected");
  const menuToggleLang = document.getElementById("menuToggleLang");
  const menuClearCanvas = document.getElementById("menuClearCanvas");

  const projectTitleInput = document.getElementById("projectTitleInput");
  const syncBadge = document.getElementById("syncBadge");
  const syncText = document.getElementById("syncText");
  const projectManagerBtn = document.getElementById("projectManagerBtn");

  // 出力モーダル関連
  const exportModalBtn = document.getElementById("exportModalBtn");
  const exportModal = document.getElementById("exportModal");
  const closeExportModalBtn = document.getElementById("closeExportModalBtn");
  const cancelExportBtn = document.getElementById("cancelExportBtn");
  const executeExportBtn = document.getElementById("executeExportBtn");
  const checkExportSvg = document.getElementById("checkExportSvg");
  const checkExportPpmP6 = document.getElementById("checkExportPpmP6");
  const checkExportPpmP3 = document.getElementById("checkExportPpmP3");
  const checkExportRuby = document.getElementById("checkExportRuby");
  const checkExportJson = document.getElementById("checkExportJson");

  // インポートモーダル関連
  const importModalBtn = document.getElementById("importModalBtn");
  const importModal = document.getElementById("importModal");
  const closeImportModalBtn = document.getElementById("closeImportModalBtn");
  const cancelImportBtn = document.getElementById("cancelImportBtn");
  const executeImportBtn = document.getElementById("executeImportBtn");
  const tabImportRubyBtn = document.getElementById("tabImportRubyBtn");
  const tabImportJsonBtn = document.getElementById("tabImportJsonBtn");
  const importRubyTabContent = document.getElementById("importRubyTabContent");
  const importJsonTabContent = document.getElementById("importJsonTabContent");
  const rubyFileInput = document.getElementById("rubyFileInput");
  const importRubyCodeInput = document.getElementById("importRubyCodeInput");
  const jsonFileInput2 = document.getElementById("jsonFileInput2");

  const projectModal = document.getElementById("projectModal");
  const closeModalBtn = document.getElementById("closeModalBtn");
  const createNewSlideBtn = document.getElementById("createNewSlideBtn");
  const createNewAssetBtn = document.getElementById("createNewAssetBtn");
  const projectListContainer = document.getElementById("projectListContainer");

  // 出力範囲オプション
  const scopeSlide = document.getElementById("scopeSlide");
  const scopeShapes = document.getElementById("scopeShapes");

  const viewRubyCodeBtn = document.getElementById("viewRubyCodeBtn");
  const rubyCodeModal = document.getElementById("rubyCodeModal");
  const closeRubyCodeModalBtn = document.getElementById("closeRubyCodeModalBtn");
  const rubyCodePre = document.getElementById("rubyCodePre");
  const copyRubyCodeBtn = document.getElementById("copyRubyCodeBtn");
  const downloadRubyCodeBtn = document.getElementById("downloadRubyCodeBtn");

  const shapePickerBtn = document.getElementById("shapePickerBtn");
  const shapePalettePopover = document.getElementById("shapePalettePopover");
  const currentShapeIcon = document.getElementById("currentShapeIcon");
  const addTextBtn = document.getElementById("addTextBtn");
  const undoBtn = document.getElementById("undoBtn");
  const redoBtn = document.getElementById("redoBtn");
  const zoomInBtn = document.getElementById("zoomInBtn");
  const zoomOutBtn = document.getElementById("zoomOutBtn");
  const zoomLabel = document.getElementById("zoomLabel");
  const toggleGridBtn = document.getElementById("toggleGridBtn");

  // プロパティパネル内ボタン (最上部: 図形の操作)
  const propEditPointsBtn = document.getElementById("propEditPointsBtn");
  const propEditPointsLabel = document.getElementById("propEditPointsLabel");
  const propDuplicateBtn = document.getElementById("propDuplicateBtn");
  const propDeleteBtn = document.getElementById("propDeleteBtn");
  const propBringForwardBtn = document.getElementById("propBringForwardBtn");
  const propSendBackwardBtn = document.getElementById("propSendBackwardBtn");
  const propBringFrontBtn = document.getElementById("propBringFrontBtn");
  const propSendBackBtn = document.getElementById("propSendBackBtn");
  const propFlipHBtn = document.getElementById("propFlipHBtn");
  const propFlipVBtn = document.getElementById("propFlipVBtn");

  // プロパティパネル要素
  const propPanelEmpty = document.getElementById("propertyPanelEmpty");
  const propPanelContent = document.getElementById("propertyPanelContent");
  const shapeNameLabel = document.getElementById("shapeNameLabel");
  const canvasDocTypeBadge = document.getElementById("canvasDocTypeBadge");
  const inputCanvasW = document.getElementById("inputCanvasW");
  const inputCanvasH = document.getElementById("inputCanvasH");
  const applyCanvasSizeBtn = document.getElementById("applyCanvasSizeBtn");
  const swapCanvasSizeBtn = document.getElementById("swapCanvasSizeBtn");
  const canvasPresetGrid = document.getElementById("canvasPresetGrid");
  const checkCanvasTransparent = document.getElementById("checkCanvasTransparent");
  const canvasBgColorRow = document.getElementById("canvasBgColorRow");
  const inputCanvasBg = document.getElementById("inputCanvasBg");
  const inputX = document.getElementById("inputX");
  const inputY = document.getElementById("inputY");
  const inputW = document.getElementById("inputW");
  const inputH = document.getElementById("inputH");
  const inputRot = document.getElementById("inputRot");
  const inputFill = document.getElementById("inputFill");
  const inputFillHex = document.getElementById("inputFillHex");
  const fillSwatchRow = document.getElementById("fillSwatchRow");
  const inputFillOpacity = document.getElementById("inputFillOpacity");
  const checkEnableStroke = document.getElementById("checkEnableStroke");
  const strokeControlsContainer = document.getElementById("strokeControlsContainer");
  const inputStroke = document.getElementById("inputStroke");
  const inputStrokeHex = document.getElementById("inputStrokeHex");
  const strokeSwatchRow = document.getElementById("strokeSwatchRow");
  const inputStrokeWidth = document.getElementById("inputStrokeWidth");
  const selectStrokeDash = document.getElementById("selectStrokeDash");
  const checkShadow = document.getElementById("checkShadow");

  // 右クリックメニュー要素
  const contextMenu = document.getElementById("contextMenu");

  // 変形・シアー要素
  const inputShearX = document.getElementById("inputShearX");
  const inputShearY = document.getElementById("inputShearY");

  // テキスト専用プロパティ
  const textPropsSection = document.getElementById("textPropsSection");
  const inputText = document.getElementById("inputText");
  const inputFontSize = document.getElementById("inputFontSize");
  const selectFontFamily = document.getElementById("selectFontFamily");
  const selectTextAlign = document.getElementById("selectTextAlign");
  const selectTextWarp = document.getElementById("selectTextWarp");

  // 数式グラフ専用プロパティ
  const addMathBtn = document.getElementById("addMathBtn");
  const mathPropsSection = document.getElementById("mathPropsSection");
  const mathPresetButtons = document.getElementById("mathPresetButtons");
  const inputMathExpr = document.getElementById("inputMathExpr");
  const applyMathBtn = document.getElementById("applyMathBtn");
  const inputMathXMin = document.getElementById("inputMathXMin");
  const inputMathXMax = document.getElementById("inputMathXMax");
  const inputMathYMin = document.getElementById("inputMathYMin");
  const inputMathYMax = document.getElementById("inputMathYMax");
  const inputMathSteps = document.getElementById("inputMathSteps");
  const inputMathLineWidth = document.getElementById("inputMathLineWidth");
  const inputMathLineColor = document.getElementById("inputMathLineColor");
  const checkMathShowAxes = document.getElementById("checkMathShowAxes");
  const checkMathShowFrame = document.getElementById("checkMathShowFrame");
  const checkMathEqualAspect = document.getElementById("checkMathEqualAspect");
  const mathErrorBox = document.getElementById("mathErrorBox");
  const mathRubyExprPreview = document.getElementById("mathRubyExprPreview");

  // 頂点編集専用コントロール
  const pointEditSection = document.getElementById("pointEditSection");
  const pointTypeSelect = document.getElementById("pointTypeSelect");
  const deletePointBtn = document.getElementById("deletePointBtn");

  // 複数選択・フレーム・オートレイアウト用コントロール
  const layersPanel = document.getElementById("layersPanel");
  const layersList = document.getElementById("layersList");

  const lockedSelectionBanner = document.getElementById("lockedSelectionBanner");
  const btnUnlockSelected = document.getElementById("btnUnlockSelected");
  const multiSelectSection = document.getElementById("multiSelectSection");
  const multiSelectTitle = document.getElementById("multiSelectTitle");
  const propFrameMultiBtn = document.getElementById("propFrameMultiBtn");
  const propAutoLayoutMultiBtn = document.getElementById("propAutoLayoutMultiBtn");

  const childLayoutSection = document.getElementById("childLayoutSection");
  const childParentNameLabel = document.getElementById("childParentNameLabel");
  const btnRemoveFromFrame = document.getElementById("btnRemoveFromFrame");
  const btnChildMovePrev = document.getElementById("btnChildMovePrev");
  const btnChildMoveNext = document.getElementById("btnChildMoveNext");
  const childAbsolutePosRow = document.getElementById("childAbsolutePosRow");
  const checkChildAbsolutePos = document.getElementById("checkChildAbsolutePos");
  const childAutoLayoutSizingRow = document.getElementById("childAutoLayoutSizingRow");
  const selectChildSizingH = document.getElementById("selectChildSizingH");
  const selectChildSizingV = document.getElementById("selectChildSizingV");
  const constraintsSection = document.getElementById("constraintsSection");
  const constraintsDiagram = document.getElementById("constraintsDiagram");
  const selectConstraintH = document.getElementById("selectConstraintH");
  const selectConstraintV = document.getElementById("selectConstraintV");

  const minMaxSection = document.getElementById("minMaxSection");
  const inputMinW = document.getElementById("inputMinW");
  const inputMaxW = document.getElementById("inputMaxW");
  const inputMinH = document.getElementById("inputMinH");
  const inputMaxH = document.getElementById("inputMaxH");

  const framePropsSection = document.getElementById("framePropsSection");
  const btnUnframe = document.getElementById("btnUnframe");
  const inputFrameName = document.getElementById("inputFrameName");
  const inputFrameRadius = document.getElementById("inputFrameRadius");
  const checkFrameClip = document.getElementById("checkFrameClip");
  const checkAutoLayoutEnabled = document.getElementById("checkAutoLayoutEnabled");
  const autoLayoutControls = document.getElementById("autoLayoutControls");
  const alDirectionGroup = document.getElementById("alDirectionGroup");
  const selectAlSizingH = document.getElementById("selectAlSizingH");
  const selectAlSizingV = document.getElementById("selectAlSizingV");
  const inputAlGap = document.getElementById("inputAlGap");
  const btnAlGapAuto = document.getElementById("btnAlGapAuto");
  const alCrossGapRow = document.getElementById("alCrossGapRow");
  const inputAlCrossGap = document.getElementById("inputAlCrossGap");
  const checkAlPadIndividual = document.getElementById("checkAlPadIndividual");
  const alPadPairInputs = document.getElementById("alPadPairInputs");
  const alPadIndividualInputs = document.getElementById("alPadIndividualInputs");
  const inputAlPadH = document.getElementById("inputAlPadH");
  const inputAlPadV = document.getElementById("inputAlPadV");
  const inputAlPadT = document.getElementById("inputAlPadT");
  const inputAlPadR = document.getElementById("inputAlPadR");
  const inputAlPadB = document.getElementById("inputAlPadB");
  const inputAlPadL = document.getElementById("inputAlPadL");
  const alAlignGrid = document.getElementById("alAlignGrid");
  const selectAlStacking = document.getElementById("selectAlStacking");

  const collapsedLayerIds = new Set();
  let draggingLayerIds = [];

  let shapePickerEventsBound = false;

  // --- 初期図形パレット生成 ---
  populateShapePalette();
  populateTextWarpDropdown();

  const statusDocInfo = document.getElementById("statusDocInfo");

  // --- 同期マネージャーイベント配線 ---
  let currentSyncStatus = "offline";
  function renderSyncBadge(status) {
    syncBadge.className = `sync-badge ${status}`;
    const keyMap = {
      synced: "sync.synced",
      modified: "sync.modified",
      syncing: "sync.syncing",
      offline: "sync.offline",
      conflict: "sync.conflict"
    };
    const key = keyMap[status];
    syncText.textContent = (window.I18N && key) ? I18N.t(key) : status;
  }

  syncManager.onStatusChange = (status) => {
    currentSyncStatus = status;
    renderSyncBadge(status);
  };

  function updateStatusDocInfo() {
    if (!statusDocInfo) return;
    const isAsset = (canvas.docType === "asset");
    const prefix = window.I18N
      ? I18N.t(isAsset ? "status.assetDim" : "status.slideDim")
      : (isAsset ? "図形素材寸法" : "スライド寸法");
    const bgLabel = canvas.backgroundColor === "transparent"
      ? (window.I18N ? I18N.t("status.transparentSuffix") : " (背景透過)")
      : "";
    statusDocInfo.textContent = `${prefix}: ${canvas.width} × ${canvas.height} px${bgLabel}`;
  }

  if (statusDocInfo) {
    statusDocInfo.addEventListener("click", () => {
      canvas.deselectAll();
      if (inputCanvasW) inputCanvasW.focus();
    });
  }

  syncManager.onProjectLoaded = (project) => {
    projectTitleInput.value = project.title || (window.I18N ? I18N.t("doc.untitled") : "無題のドキュメント");
    updateStatusDocInfo();
    syncPropertyPanel();
    renderLayersPanel();
    reevaluatePendingMathShapes();
  };

  // タイトル編集
  projectTitleInput.addEventListener("input", (e) => {
    syncManager.setTitle(e.target.value);
  });

  // 手動同期トリガー
  syncBadge.addEventListener("click", () => {
    syncManager.syncCurrentProject();
  });

  // 言語切り替え配線
  if (menuToggleLang && window.I18N) {
    menuToggleLang.addEventListener("click", () => {
      closeBrandMenu();
      I18N.toggleLang();
    });
  }

  // --- キャンバス変更通知の配線 ---
  const originalSaveState = canvas.saveState.bind(canvas);
  canvas.saveState = function() {
    originalSaveState();
    syncManager.notifyCanvasChanged();
  };

  canvas.onSelectionChange = () => {
    syncPropertyPanel();
    renderLayersPanel();
  };
  canvas.onModeChange = syncModeUI;
  canvas.onStateChange = () => {
    updateUndoRedoButtons();
    renderLayersPanel();
  };
  canvas.onDimensionChange = () => {
    updateStatusDocInfo();
    syncPropertyPanel();
    renderLayersPanel();
  };
  updateStatusDocInfo();
  syncPropertyPanel();
  renderLayersPanel();

  function createNewDocument(docType) {
    const count = syncManager.getLocalIndex().length + 1;
    const prefix = window.I18N
      ? I18N.t(docType === "asset" ? "doc.newAssetPrefix" : "doc.newSlidePrefix")
      : (docType === "asset" ? "新規図形素材 " : "新規スライド ");
    const newProj = syncManager.createProjectData(prefix + count, null, docType);
    syncManager.saveLocalProject(newProj);
    syncManager.setCurrentProject(newProj);
    syncManager.syncCurrentProject();
    projectModal.style.display = "none";
  }

  function syncGridMenuState() {
    if (!menuGridState) return;
    menuGridState.textContent = canvas.showGrid ? "ON" : "OFF";
    menuGridState.classList.toggle("on", canvas.showGrid);
  }

  function closeBrandMenu() {
    if (brandMenuPopover) brandMenuPopover.style.display = "none";
  }

  // 左アイコン ファイルメニュー配線
  if (brandMenuBtn && brandMenuPopover) {
    syncGridMenuState();
    brandMenuBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const isVisible = brandMenuPopover.style.display === "block";
      shapePalettePopover.style.display = "none";
      brandMenuPopover.style.display = isVisible ? "none" : "block";
    });
    document.addEventListener("click", (e) => {
      if (!brandMenuPopover.contains(e.target) && !brandMenuBtn.contains(e.target)) {
        closeBrandMenu();
      }
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeBrandMenu();
    });
    menuNewSlide.addEventListener("click", () => {
      closeBrandMenu();
      createNewDocument("slide");
    });
    menuNewAsset.addEventListener("click", () => {
      closeBrandMenu();
      createNewDocument("asset");
    });
    menuOpenProjects.addEventListener("click", () => {
      closeBrandMenu();
      openProjectModal();
    });
    menuImport.addEventListener("click", () => {
      closeBrandMenu();
      importModal.style.display = "flex";
    });
    menuExport.addEventListener("click", () => {
      closeBrandMenu();
      exportModalBtn.click();
    });
    menuViewRuby.addEventListener("click", () => {
      closeBrandMenu();
      viewRubyCodeBtn.click();
    });
    if (menuAddFrame) {
      menuAddFrame.addEventListener("click", () => {
        closeBrandMenu();
        canvas.addFrame();
      });
    }
    if (menuFrameSelected) {
      menuFrameSelected.addEventListener("click", () => {
        closeBrandMenu();
        canvas.frameSelected(false);
      });
    }
    if (menuAutoLayoutSelected) {
      menuAutoLayoutSelected.addEventListener("click", () => {
        closeBrandMenu();
        canvas.toggleAutoLayoutSelected();
      });
    }
    menuToggleGrid.addEventListener("click", () => {
      toggleGridBtn.click();
      closeBrandMenu();
    });
    menuClearCanvas.addEventListener("click", () => {
      closeBrandMenu();
      if (canvas.shapes.length === 0) return;
      const msg = window.I18N ? I18N.t("msg.confirmClear") : "キャンバスの図形をすべて削除しますか？";
      if (confirm(msg)) {
        canvas.deselectAll();
        canvas.shapes = [];
        canvas.saveState();
        canvas.render();
        syncManager.notifyCanvasChanged();
      }
    });
  }

  // --- プロジェクト一覧モーダル配線 ---
  projectManagerBtn.addEventListener("click", () => {
    openProjectModal();
  });
  closeModalBtn.addEventListener("click", () => {
    projectModal.style.display = "none";
  });
  projectModal.addEventListener("click", (e) => {
    if (e.target === projectModal) projectModal.style.display = "none";
  });

  createNewSlideBtn.addEventListener("click", () => createNewDocument("slide"));
  createNewAssetBtn.addEventListener("click", () => createNewDocument("asset"));

  // --- ズーム ---
  zoomInBtn.addEventListener("click", () => {
    canvas.setZoom(canvas.zoom + 0.1);
    zoomLabel.textContent = `${Math.round(canvas.zoom * 100)}%`;
  });
  zoomOutBtn.addEventListener("click", () => {
    canvas.setZoom(canvas.zoom - 0.1);
    zoomLabel.textContent = `${Math.round(canvas.zoom * 100)}%`;
  });

  // グリッド
  toggleGridBtn.addEventListener("click", () => {
    canvas.showGrid = !canvas.showGrid;
    toggleGridBtn.classList.toggle("active", canvas.showGrid);
    syncGridMenuState();
    canvas.render();
  });

  // アンドゥ / リドゥ
  undoBtn.addEventListener("click", () => canvas.undo());
  redoBtn.addEventListener("click", () => canvas.redo());

  // プロパティパネル内ボタン (最上部: 図形の操作)
  propEditPointsBtn.addEventListener("click", () => {
    if (canvas.mode === "select") {
      canvas.enterEditPointsMode();
    } else {
      canvas.exitEditPointsMode();
    }
  });
  propDuplicateBtn.addEventListener("click", () => canvas.duplicateSelected());
  propDeleteBtn.addEventListener("click", () => canvas.deleteSelected());

  propBringForwardBtn.addEventListener("click", () => canvas.bringForward());
  propSendBackwardBtn.addEventListener("click", () => canvas.sendBackward());
  propBringFrontBtn.addEventListener("click", () => canvas.bringToFront());
  propSendBackBtn.addEventListener("click", () => canvas.sendToBack());

  propFlipHBtn.addEventListener("click", () => canvas.toggleFlipH());
  propFlipVBtn.addEventListener("click", () => canvas.toggleFlipV());
  if (btnUnlockSelected) {
    btnUnlockSelected.addEventListener("click", () => {
      canvas.unlockSelected();
      syncPropertyPanel();
      renderLayersPanel();
    });
  }

  // --- 出力モーダル配線 ---
  exportModalBtn.addEventListener("click", () => {
    if (canvas.docType === "asset") {
      scopeShapes.checked = true;
    } else {
      scopeSlide.checked = true;
    }
    exportModal.style.display = "flex";
  });
  closeExportModalBtn.addEventListener("click", () => {
    exportModal.style.display = "none";
  });
  cancelExportBtn.addEventListener("click", () => {
    exportModal.style.display = "none";
  });
  exportModal.addEventListener("click", (e) => {
    if (e.target === exportModal) exportModal.style.display = "none";
  });

  executeExportBtn.addEventListener("click", async () => {
    const title = syncManager.currentProject ? syncManager.currentProject.title : "slide";
    const ts = getTimestamp();
    const cropToShapes = scopeShapes.checked;

    if (checkExportSvg.checked) {
      const filename = `${title}_${ts}.svg`;
      PPTExporter.exportSvg(canvas, filename, { cropToShapes });
    }
    if (checkExportPpmP6.checked) {
      const filename = `${title}_${ts}_binary.ppm`;
      PPTExporter.exportPpm(canvas, filename, "p6", { cropToShapes });
    }
    if (checkExportPpmP3.checked) {
      const filename = `${title}_${ts}_ascii.ppm`;
      PPTExporter.exportPpm(canvas, filename, "p3", { cropToShapes });
    }
    if (checkExportRuby.checked) {
      const filename = `${title.replace(/[/\\?%*:|"<>]/g, "_")}.rb`;
      try {
        const code = await RubyCodeGenerator.generateViaServer(canvas, {
          cropToShapes,
          filename,
          save: true
        });
        const blob = new Blob([code], { type: "text/plain;charset=utf-8" });
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
      } catch (err) {
        alert((window.I18N ? I18N.t("msg.exportRubyFail") : "Rubyコードのエクスポートに失敗しました: ") + err.message);
      }
    }
    if (checkExportJson.checked) {
      syncManager.exportCurrentProjectAsJson();
    }

    exportModal.style.display = "none";
  });

  // --- インポートモーダル配線 ---
  let currentImportTab = "ruby"; // "ruby" | "json"

  importModalBtn.addEventListener("click", () => {
    importModal.style.display = "flex";
  });
  closeImportModalBtn.addEventListener("click", () => {
    importModal.style.display = "none";
  });
  cancelImportBtn.addEventListener("click", () => {
    importModal.style.display = "none";
  });
  importModal.addEventListener("click", (e) => {
    if (e.target === importModal) importModal.style.display = "none";
  });

  tabImportRubyBtn.addEventListener("click", () => {
    currentImportTab = "ruby";
    tabImportRubyBtn.style.fontWeight = "bold";
    tabImportRubyBtn.style.color = "var(--text-main)";
    tabImportRubyBtn.style.background = "var(--panel-bg)";
    tabImportJsonBtn.style.fontWeight = "normal";
    tabImportJsonBtn.style.color = "var(--text-muted)";
    tabImportJsonBtn.style.background = "transparent";
    importRubyTabContent.style.display = "block";
    importJsonTabContent.style.display = "none";
  });

  tabImportJsonBtn.addEventListener("click", () => {
    currentImportTab = "json";
    tabImportJsonBtn.style.fontWeight = "bold";
    tabImportJsonBtn.style.color = "var(--text-main)";
    tabImportJsonBtn.style.background = "var(--panel-bg)";
    tabImportRubyBtn.style.fontWeight = "normal";
    tabImportRubyBtn.style.color = "var(--text-muted)";
    tabImportRubyBtn.style.background = "transparent";
    importRubyTabContent.style.display = "none";
    importJsonTabContent.style.display = "block";
  });

  rubyFileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      importRubyCodeInput.value = evt.target.result;
    };
    reader.readAsText(file, "utf-8");
  });

  executeImportBtn.addEventListener("click", async () => {
    if (currentImportTab === "ruby") {
      const codeText = importRubyCodeInput.value.trim();
      if (!codeText) {
        alert(window.I18N ? I18N.t("msg.enterRubyCode") : "インポートするRubyコードを入力してください");
        return;
      }
      try {
        const importedShapes = await RubyCodeGenerator.parseViaServer(codeText);
        if (importedShapes.length === 0) {
          alert(window.I18N ? I18N.t("msg.noValidShapes") : "有効な図形描画コード(fillrect, fillcircle, fillrotellipse, filltriangle等)が見つかりませんでした");
          return;
        }
        importedShapes.forEach(s => {
          canvas.shapes.push(s);
        });
        canvas.normalizeHierarchy();
        canvas.saveState();
        canvas.render();
        syncPropertyPanel();
        syncManager.notifyCanvasChanged();
        importModal.style.display = "none";
        alert(window.I18N ? I18N.t("msg.importedCount", { n: importedShapes.length }) : `${importedShapes.length}個の図形をインポートしました`);
      } catch (err) {
        alert((window.I18N ? I18N.t("msg.importRubyFail") : "Rubyコードの解析に失敗しました: ") + err.message);
      }
    } else {
      const file = jsonFileInput2.files[0];
      if (!file) {
        alert(window.I18N ? I18N.t("msg.selectJson") : "JSONファイルを選択してください");
        return;
      }
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const data = JSON.parse(evt.target.result);
          if (!data || !Array.isArray(data.shapes)) {
            alert(window.I18N ? I18N.t("msg.invalidJson") : "有効なスライドJSONデータではありません");
            return;
          }
          syncManager.saveLocalProject(data);
          syncManager.setCurrentProject(data);
          syncManager.syncCurrentProject();
          importModal.style.display = "none";
        } catch (err) {
          alert((window.I18N ? I18N.t("msg.loadJsonFail") : "JSONの読み込みに失敗しました: ") + err.message);
        }
      };
      reader.readAsText(file, "utf-8");
    }
  });

  // Rubyコード表示モーダル配線
  let currentGeneratedRubyCode = "";
  viewRubyCodeBtn.addEventListener("click", async () => {
    const cropToShapes = (canvas.docType === "asset");
    try {
      currentGeneratedRubyCode = await RubyCodeGenerator.generateViaServer(canvas, {
        cropToShapes,
        save: false
      });
      rubyCodePre.textContent = currentGeneratedRubyCode;
      rubyCodeModal.style.display = "flex";
    } catch (err) {
      alert((window.I18N ? I18N.t("msg.genRubyFail") : "Rubyコードの生成に失敗しました: ") + err.message);
    }
  });

  closeRubyCodeModalBtn.addEventListener("click", () => {
    rubyCodeModal.style.display = "none";
  });

  rubyCodeModal.addEventListener("click", (e) => {
    if (e.target === rubyCodeModal) rubyCodeModal.style.display = "none";
  });

  copyRubyCodeBtn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(currentGeneratedRubyCode);
      copyRubyCodeBtn.textContent = window.I18N ? I18N.t("modal.copied") : "コピー完了!";
      setTimeout(() => {
        copyRubyCodeBtn.textContent = window.I18N ? I18N.t("modal.copyCode") : "コードをコピー";
      }, 2000);
    } catch (e) {
      alert(window.I18N ? I18N.t("msg.copyFail") : "クリップボードへのコピーに失敗しました");
    }
  });

  downloadRubyCodeBtn.addEventListener("click", async () => {
    const title = syncManager.currentProject ? syncManager.currentProject.title : "slide";
    const filename = `${title.replace(/[/\\?%*:|"<>]/g, "_")}.rb`;
    const blob = new Blob([currentGeneratedRubyCode], { type: "text/plain;charset=utf-8" });

    // ブラウザダウンロード
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

    // サーバーへ保存
    try {
      if (window.RubyBackend && !(await RubyBackend.hasServer())) throw new Error("offline");
      await fetch("/api/export/ruby", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: currentGeneratedRubyCode, filename })
      });
    } catch (e) {
      // オフライン時は無視
    }
  });

  // テキスト追加
  addTextBtn.addEventListener("click", () => {
    canvas.addShape("text", {
      text: "PowerPoint Text",
      fontSize: 32,
      fill: "#1e293b",
      strokeWidth: 0
    });
  });

  // 数式グラフ評価・見本読み込み
  let mathPresets = [
    { id: "sine", name: "正弦波", expr: "sin(x)", xMin: -4, xMax: 4, yMin: -3, yMax: 3, steps: 120, color: "#2563eb" }
  ];

  function roundMathBound(val) {
    return Math.round(val * 10000) / 10000;
  }

  // 図形の幅・高さに合わせて1単位の長さが縦横1:1になるよう範囲を整える
  function syncEqualAspectBounds(shape, anchorAxis = "x") {
    if (!shape || shape.type !== "math_plot" || !shape.mathConfig) return;
    const cfg = shape.mathConfig;
    if (cfg.equalAspect === false) return;
    const w = Math.max(10, Number(shape.width) || 320);
    const h = Math.max(10, Number(shape.height) || 240);
    const xMin = Number(cfg.xMin);
    const xMax = Number(cfg.xMax);
    const yMin = Number(cfg.yMin);
    const yMax = Number(cfg.yMax);
    if (!Number.isFinite(xMin) || !Number.isFinite(xMax) || !Number.isFinite(yMin) || !Number.isFinite(yMax)) return;
    if (xMax <= xMin || yMax <= yMin) return;

    if (anchorAxis === "y") {
      const ySpan = yMax - yMin;
      const xSpan = ySpan * (w / h);
      const xMid = (xMin + xMax) / 2;
      cfg.xMin = roundMathBound(xMid - xSpan / 2);
      cfg.xMax = roundMathBound(xMid + xSpan / 2);
    } else {
      const xSpan = xMax - xMin;
      const ySpan = xSpan * (h / w);
      const yMid = (yMin + yMax) / 2;
      cfg.yMin = roundMathBound(yMid - ySpan / 2);
      cfg.yMax = roundMathBound(yMid + ySpan / 2);
    }
  }

  async function evaluateMathShape(shape, options = {}) {
    if (!shape || shape.type !== "math_plot") return;
    const cfg = shape.mathConfig || {};
    try {
      const res = await RubyBackend.request("POST", "/api/math/evaluate", JSON.stringify({
        mode: cfg.mode || "function",
        expr: cfg.expr || "sin(x)",
        xMin: cfg.xMin ?? -4,
        xMax: cfg.xMax ?? 4,
        yMin: cfg.yMin ?? -3,
        yMax: cfg.yMax ?? 3,
        steps: cfg.steps ?? 120,
        lang: window.I18N ? I18N.getLang() : "ja"
      }));
      const result = await res.json();
      if (result && result.success) {
        shape.mathData = result;
        if (!options.skipSave) canvas.saveState();
      } else {
        const failMsg = window.I18N ? I18N.t("math.evalFailed") : "数式の計算に失敗";
        shape.mathData = Object.assign({}, shape.mathData || {}, {
          error: (result && result.error) || failMsg
        });
      }
    } catch (err) {
      shape.mathData = Object.assign({}, shape.mathData || {}, {
        error: window.I18N ? I18N.t("math.serverError") : "サーバー接続エラー"
      });
    }
    canvas.render();
    syncPropertyPanel();
  }

  async function reevaluatePendingMathShapes() {
    const pending = (canvas.shapes || []).filter(s => (
      s && s.type === "math_plot" &&
      (!s.mathData || !Array.isArray(s.mathData.segments)) &&
      !(s.mathData && s.mathData.error)
    ));
    for (const s of pending) {
      await evaluateMathShape(s, { skipSave: true });
    }
  }

  function applyMathPresetToShape(shape, preset) {
    if (!shape || shape.type !== "math_plot" || !preset) return;
    shape.mathConfig = shape.mathConfig || {};
    shape.name = (window.I18N ? I18N.presetName(preset.id, preset.name) : preset.name) || (window.I18N ? I18N.t("shape.math_plot") : "関数グラフ");
    const lineColor = preset.color || shape.mathConfig.lineColor || "#2563eb";
    shape.mathConfig = {
      mode: "function",
      expr: preset.expr,
      xMin: preset.xMin,
      xMax: preset.xMax,
      yMin: preset.yMin,
      yMax: preset.yMax,
      steps: preset.steps || 120,
      lineWidth: shape.mathConfig.lineWidth || 3,
      lineColor,
      showAxes: shape.mathConfig.showAxes === true,
      showFrame: shape.mathConfig.showFrame === true,
      equalAspect: shape.mathConfig.equalAspect !== false,
      presetId: preset.id
    };
    syncEqualAspectBounds(shape, "x");
    evaluateMathShape(shape);
  }

  function createMathShapeFromPreset(preset) {
    const lineColor = (preset && preset.color) || "#2563eb";
    const defaultName = preset
      ? (window.I18N ? I18N.presetName(preset.id, preset.name) : preset.name)
      : (window.I18N ? I18N.t("shape.math_plot") : "関数グラフ");
    const created = canvas.addShape("math_plot", {
      name: defaultName,
      fill: "transparent",
      fillOpacity: 1.0,
      stroke: "none",
      strokeWidth: 0,
      mathConfig: {
        mode: "function",
        expr: (preset && preset.expr) || "sin(x)",
        xMin: preset ? preset.xMin : -4,
        xMax: preset ? preset.xMax : 4,
        yMin: preset ? preset.yMin : -3,
        yMax: preset ? preset.yMax : 3,
        steps: (preset && preset.steps) || 120,
        lineWidth: 3,
        lineColor,
        showAxes: false,
        showFrame: false,
        equalAspect: true,
        presetId: preset ? preset.id : undefined
      }
    }) || canvas.getSelectedShape();
    syncEqualAspectBounds(created, "x");
    evaluateMathShape(created, { skipSave: true });
  }

  function renderMathPresetButtons() {
    if (!mathPresetButtons) return;
    mathPresetButtons.innerHTML = "";
    mathPresets.forEach(preset => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "preset-btn";
      btn.textContent = window.I18N ? I18N.presetName(preset.id, preset.name) : preset.name;
      btn.title = `y = ${preset.expr}`;
      btn.addEventListener("click", () => {
        const selected = canvas.getSelectedShape();
        if (selected && selected.type === "math_plot") {
          applyMathPresetToShape(selected, preset);
        } else {
          createMathShapeFromPreset(preset);
        }
      });
      mathPresetButtons.appendChild(btn);
    });
  }

  async function loadMathPresets() {
    try {
      // サーバーが無いときは、起動時に30MBのruby.wasmを読まないようJS側の既定プリセットを使う
      if (!(await RubyBackend.hasServer())) throw new Error("offline");
      const res = await fetch("/api/math/presets");
      const data = await res.json();
      if (data && data.success && Array.isArray(data.presets) && data.presets.length > 0) {
        mathPresets = data.presets;
      }
    } catch (e) {
      // 既定プリセットを使用
    }
    renderMathPresetButtons();
  }

  if (addMathBtn) {
    addMathBtn.addEventListener("click", () => {
      const p = mathPresets[0] || {
        id: "sine",
        name: "正弦波",
        expr: "sin(x)",
        xMin: -4,
        xMax: 4,
        yMin: -3,
        yMax: 3,
        steps: 120,
        color: "#2563eb"
      };
      createMathShapeFromPreset(p);
    });
  }

  loadMathPresets();

  if (window.I18N) {
    I18N.onChange(() => {
      const defaultTitles = ["無題のドキュメント", "Untitled Document", "新規ドキュメント", "New Document", "無題のプレゼンテーション", "Untitled Presentation"];
      if (defaultTitles.includes(projectTitleInput.value)) {
        const nextTitle = I18N.t("doc.untitled");
        projectTitleInput.value = nextTitle;
        if (syncManager.currentProject) syncManager.currentProject.title = nextTitle;
      }
      populateShapePalette();
      const prevWarp = selectTextWarp ? selectTextWarp.value : "none";
      populateTextWarpDropdown();
      if (selectTextWarp) selectTextWarp.value = prevWarp;
      renderMathPresetButtons();
      renderSyncBadge(currentSyncStatus);
      updateStatusDocInfo();
      syncModeUI(canvas.mode);
      syncPropertyPanel();
      renderLayersPanel();
      if (projectModal.style.display === "flex") openProjectModal();
      canvas.render();
    });
  }

  // プロパティパネル変更イベント
  bindPropertyInputs();

  // マウスイベント
  setupCanvasMouseEvents(canvas, canvasElement);

  // 右クリックコンテキストメニュー
  setupContextMenu(canvas, canvasElement);

  // キーボードショートカット
  setupKeyboardShortcuts(canvas);

  // 初回プロジェクトのレイヤー反映と未計算数式グラフの再評価
  renderLayersPanel();
  reevaluatePendingMathShapes();

  // --- ヘルパー関数群 ---

  async function openProjectModal() {
    projectModal.style.display = "flex";
    const loadingTxt = window.I18N ? I18N.t("modal.loading") : "読み込み中...";
    projectListContainer.innerHTML = `<div style='color:#64748b; font-size:13px;'>${loadingTxt}</div>`;

    const localList = syncManager.getLocalIndex();
    const remoteList = await syncManager.fetchRemoteProjectList();

    // IDをキーに統合
    const map = new Map();
    localList.forEach(item => map.set(item.id, { ...item, source: "local" }));
    remoteList.forEach(item => {
      if (map.has(item.id)) {
        map.get(item.id).source = "synced";
      } else {
        map.set(item.id, { ...item, source: "remote" });
      }
    });

    const merged = Array.from(map.values()).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

    projectListContainer.innerHTML = "";
    if (merged.length === 0) {
      const emptyTxt = window.I18N ? I18N.t("modal.emptyProjects") : "保存されたプレゼンテーションはありません";
      projectListContainer.innerHTML = `<div style='color:#64748b; font-size:13px;'>${emptyTxt}</div>`;
      return;
    }

    const locale = (window.I18N && I18N.getLang() === "en") ? "en-US" : "ja-JP";
    merged.forEach(item => {
      const el = document.createElement("div");
      const isCurrent = syncManager.currentProject && syncManager.currentProject.id === item.id;
      el.className = `project-item ${isCurrent ? 'active' : ''}`;

      const dateStr = item.updatedAt ? new Date(item.updatedAt).toLocaleString(locale) : "-";
      const sourceKey = item.source === "synced" ? "modal.sourceSynced" : (item.source === "remote" ? "modal.sourceRemote" : "modal.sourceLocal");
      const sourceBadge = window.I18N ? I18N.t(sourceKey) : item.source;
      const isAsset = (item.docType === "asset" || (item.width === 400 && item.height === 400));
      const typeBadge = window.I18N ? I18N.t(isAsset ? "panel.docTypeAsset" : "panel.docTypeSlide") : (isAsset ? "図形素材" : "スライド");
      const updatedPrefix = window.I18N ? I18N.t("modal.updatedPrefix") : "更新";
      const openTxt = window.I18N ? I18N.t("modal.openBtn") : "開く";
      const delTxt = window.I18N ? I18N.t("modal.deleteBtn") : "削除";
      const untitledTxt = window.I18N ? I18N.t("doc.untitled") : "無題";

      el.innerHTML = `
        <div>
          <div class="project-info-title">${escapeHtml(item.title || untitledTxt)}</div>
          <div class="project-info-meta">${updatedPrefix}: ${dateStr} / Rev: ${item.revision || 1} / [${typeBadge}] [${sourceBadge}]</div>
        </div>
        <div class="project-item-actions">
          <button class="btn btn-primary open-proj-btn" style="padding:4px 8px; font-size:12px;">${openTxt}</button>
          <button class="btn del-proj-btn" style="padding:4px 8px; font-size:12px; color:#ef4444;">${delTxt}</button>
        </div>
      `;

      el.querySelector(".open-proj-btn").addEventListener("click", async () => {
        let proj = syncManager.loadLocalProject(item.id);
        if (!proj && item.source === "remote") {
          proj = await syncManager.fetchRemoteProject(item.id);
          if (proj) syncManager.saveLocalProject(proj);
        }
        if (proj) {
          syncManager.setCurrentProject(proj);
          projectModal.style.display = "none";
        }
      });

      el.querySelector(".del-proj-btn").addEventListener("click", () => {
        const confirmMsg = window.I18N ? I18N.t("modal.confirmDelete", { title: item.title }) : `「${item.title}」を削除しますか？`;
        if (confirm(confirmMsg)) {
          syncManager.deleteLocalProject(item.id);
          openProjectModal();
        }
      });

      projectListContainer.appendChild(el);
    });
  }

  function escapeHtml(str) {
    return str.replace(/[<>&'"]/g, c => {
      switch (c) {
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '&': return '&amp;';
        case '\'': return '&apos;';
        case '"': return '&quot;';
      }
    });
  }

  function getTimestamp() {
    const now = new Date();
    return now.getFullYear() +
      String(now.getMonth() + 1).padStart(2, "0") +
      String(now.getDate()).padStart(2, "0") + "_" +
      String(now.getHours()).padStart(2, "0") +
      String(now.getMinutes()).padStart(2, "0") +
      String(now.getSeconds()).padStart(2, "0");
  }

  function populateShapePalette() {
    const list = ShapeDefinitions.getAllDefinitions();
    shapePalettePopover.innerHTML = "";

    const categories = {
      rectangles: window.I18N ? I18N.t("cat.rectangles") : "四角形",
      basic: window.I18N ? I18N.t("cat.basic") : "基本図形",
      arrows: window.I18N ? I18N.t("cat.arrows") : "矢印",
      stars: window.I18N ? I18N.t("cat.stars") : "星・リボン・バッジ",
      callouts: window.I18N ? I18N.t("cat.callouts") : "吹き出し",
      flowchart: window.I18N ? I18N.t("cat.flowchart") : "フローチャート"
    };

    Object.entries(categories).forEach(([catKey, catName]) => {
      const items = list.filter(item => item.category === catKey);
      if (items.length === 0) return;

      const catDiv = document.createElement("div");
      catDiv.className = "palette-category";

      const titleDiv = document.createElement("div");
      titleDiv.className = "palette-category-title";
      titleDiv.textContent = catName;
      catDiv.appendChild(titleDiv);

      const gridDiv = document.createElement("div");
      gridDiv.className = "palette-grid";

      items.forEach(item => {
        const itemBtn = document.createElement("div");
        itemBtn.className = "palette-item";
        itemBtn.title = window.I18N ? I18N.shapeName(item.id, item.name) : item.name;

        // 24x24のプレビューSVGパス
        const def = ShapeDefinitions.getDefinition(item.id);
        const pathD = def ? def.generatePath(24, 24, def.defaultAdjustments) : "M 2 2 L 22 2 L 22 22 L 2 22 Z";

        itemBtn.innerHTML = `
          <svg viewBox="0 0 24 24">
            <path d="${pathD}" fill="#475569" fill-rule="evenodd"/>
          </svg>
        `;

        itemBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          canvas.addShape(item.id);
          currentShapeIcon.innerHTML = `<path d="${pathD}" fill="currentColor" fill-rule="evenodd"/>`;
          shapePalettePopover.style.display = "none";
        });

        gridDiv.appendChild(itemBtn);
      });

      catDiv.appendChild(gridDiv);
      shapePalettePopover.appendChild(catDiv);
    });

    if (!shapePickerEventsBound) {
      shapePickerEventsBound = true;
      shapePickerBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        closeBrandMenu();
        const isVisible = shapePalettePopover.style.display === "block";
        shapePalettePopover.style.display = isVisible ? "none" : "block";
      });

      document.addEventListener("click", (e) => {
        if (!shapePalettePopover.contains(e.target) && e.target !== shapePickerBtn) {
          shapePalettePopover.style.display = "none";
        }
      });
    }
  }

  function populateTextWarpDropdown() {
    selectTextWarp.innerHTML = "";
    TextWarpRenderer.WARP_PRESETS.forEach(p => {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = window.I18N ? I18N.warpName(p.id, p.name) : p.name;
      selectTextWarp.appendChild(opt);
    });
  }

  function syncModeUI(mode) {
    if (mode === "edit_points") {
      propEditPointsBtn.classList.add("active");
      propEditPointsBtn.style.background = "#fee2e2";
      propEditPointsBtn.style.color = "#b91c1c";
      propEditPointsLabel.textContent = window.I18N ? I18N.t("panel.endEditPoints") : "頂点編集を終了";
      pointEditSection.style.display = "block";
    } else {
      propEditPointsBtn.classList.remove("active");
      propEditPointsBtn.style.background = "";
      propEditPointsBtn.style.color = "";
      propEditPointsLabel.textContent = window.I18N ? I18N.t("panel.editPoints") : "頂点の編集";
      pointEditSection.style.display = "none";
    }
    if (canvasElement) {
      canvasElement.style.cursor = (mode === "create_frame" || mode === "edit_points") ? "crosshair" : "default";
    }
  }

  function getLayerTypeIconSvg(s) {
    if (s.type === "frame") {
      return '<svg viewBox="0 0 16 16"><path d="M4 1h2v14H4V1zm6 0h2v14h-2V1zM1 4h14v2H1V4zm0 6h14v2H1v-2z"/></svg>';
    }
    if (s.type === "text") {
      return '<svg viewBox="0 0 16 16"><path d="M2 2h12v2.5H9.2V14H6.8V4.5H2V2z"/></svg>';
    }
    if (s.type === "math_plot") {
      return '<svg viewBox="0 0 16 16"><path d="M1 13h14v1.5H1V13zm1.3-2.5l3.2-5 3.1 3.3 3.7-6.3 1.4.8-4.7 8-3.2-3.4-2.2 3.4-1.3-.8z"/></svg>';
    }
    if (s.type === "ellipse") {
      return '<svg viewBox="0 0 16 16"><path d="M8 2a6 6 0 100 12A6 6 0 008 2zm0 2a4 4 0 110 8 4 4 0 010-8z"/></svg>';
    }
    return '<svg viewBox="0 0 16 16"><path d="M2 2h12v12H2V2zm2 2v8h8V4H4z"/></svg>';
  }

  function renderLayersPanel() {
    if (!layersList) return;
    layersList.innerHTML = "";
    const shapes = canvas.shapes || [];
    if (shapes.length === 0) {
      const emptyEl = document.createElement("div");
      emptyEl.className = "layers-empty";
      emptyEl.textContent = window.I18N ? I18N.t("layers.empty") : "レイヤーがありません";
      layersList.appendChild(emptyEl);
      return;
    }

    const tr = (k, fb) => (window.I18N ? I18N.t(k) : fb);
    const flatNodes = [];
    const buildTree = (parentId, depth, visited) => {
      const directChildren = shapes.filter(s => (s.parentId || null) === parentId);
      // 最前面(配列末尾)を一覧の上側に表示する
      for (let i = directChildren.length - 1; i >= 0; i--) {
        const s = directChildren[i];
        if (visited.has(s.id)) continue;
        visited.add(s.id);
        const kids = shapes.filter(ch => ch.parentId === s.id);
        const hasKids = kids.length > 0;
        const isCollapsed = collapsedLayerIds.has(s.id);
        flatNodes.push({ shape: s, depth, hasKids, isCollapsed });
        if (hasKids && !isCollapsed) {
          buildTree(s.id, depth + 1, visited);
        }
      }
    };
    buildTree(null, 0, new Set());
    // 親ID不整合などで取り残された要素があれば末尾に追加
    shapes.forEach(s => {
      if (!flatNodes.some(n => n.shape.id === s.id)) {
        flatNodes.push({ shape: s, depth: 0, hasKids: false, isCollapsed: false });
      }
    });

    const clearDropIndicators = () => {
      layersList.querySelectorAll(".layer-row").forEach(r => {
        r.classList.remove("drop-before", "drop-inside", "drop-after");
      });
    };

    flatNodes.forEach(({ shape: s, depth, hasKids, isCollapsed }) => {
      const effLocked = canvas.isEffectivelyLocked(s);
      const row = document.createElement("div");
      row.className = "layer-row";
      row.dataset.id = s.id;
      row.draggable = !effLocked;
      row.style.paddingLeft = `${depth * 14 + 6}px`;

      if (canvas.selectedShapeIds.has(s.id)) row.classList.add("selected");
      if (s.type === "frame") row.classList.add("is-frame");
      if (s.visible === false || !canvas.isEffectivelyVisible(s)) row.classList.add("is-hidden");
      if (effLocked) row.classList.add("is-locked");

      if (hasKids) {
        const toggleBtn = document.createElement("button");
        toggleBtn.type = "button";
        toggleBtn.className = "layer-toggle-btn";
        toggleBtn.innerHTML = isCollapsed
          ? '<svg viewBox="0 0 12 12" style="width:10px;height:10px;fill:currentColor;"><path d="M4 2l5 4-5 4V2z"/></svg>'
          : '<svg viewBox="0 0 12 12" style="width:10px;height:10px;fill:currentColor;"><path d="M2 4l4 5 4-5H2z"/></svg>';
        toggleBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          if (collapsedLayerIds.has(s.id)) collapsedLayerIds.delete(s.id);
          else collapsedLayerIds.add(s.id);
          renderLayersPanel();
        });
        row.appendChild(toggleBtn);
      } else {
        const spacer = document.createElement("span");
        spacer.className = "layer-toggle-spacer";
        row.appendChild(spacer);
      }

      const iconEl = document.createElement("span");
      iconEl.className = "layer-type-icon";
      iconEl.innerHTML = getLayerTypeIconSvg(s);
      row.appendChild(iconEl);

      const displayName = s.name || (window.I18N ? I18N.shapeName(s.type, s.type) : s.type);
      const nameEl = document.createElement("span");
      nameEl.className = "layer-name";
      nameEl.textContent = displayName;
      nameEl.title = tr("layers.renameHint", "ダブルクリックで名前変更");
      row.appendChild(nameEl);

      nameEl.addEventListener("dblclick", (e) => {
        e.stopPropagation();
        row.draggable = false;
        const input = document.createElement("input");
        input.type = "text";
        input.className = "layer-rename-input";
        input.value = displayName;
        row.replaceChild(input, nameEl);
        input.focus();
        input.select();

        let finished = false;
        const finishRename = (commit) => {
          if (finished) return;
          finished = true;
          row.draggable = true;
          if (!commit || !canvas.renameShape(s.id, input.value)) {
            renderLayersPanel();
          }
        };

        input.addEventListener("keydown", (ev) => {
          if (ev.key === "Enter") {
            ev.preventDefault();
            finishRename(true);
          } else if (ev.key === "Escape") {
            ev.preventDefault();
            finishRename(false);
          }
        });
        input.addEventListener("blur", () => finishRename(true));
      });

      const actionsEl = document.createElement("div");
      const showAlways = (s.visible === false || !!s.locked);
      actionsEl.className = `layer-actions${showAlways ? " always-show" : ""}`;

      const lockBtn = document.createElement("button");
      lockBtn.type = "button";
      lockBtn.className = `layer-action-btn${s.locked ? " active" : ""}`;
      lockBtn.title = tr("layers.toggleLock", "ロック切替");
      lockBtn.innerHTML = s.locked
        ? '<svg viewBox="0 0 16 16"><path d="M5 7V5a3 3 0 016 0v2h1a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1V8a1 1 0 011-1h1zm2 0h2V5a1 1 0 00-2 0v2z"/></svg>'
        : '<svg viewBox="0 0 16 16"><path d="M11 5a3 3 0 00-5.83-1H3.5A4.5 4.5 0 0112.5 5v2H13a1 1 0 011 1v6a1 1 0 01-1 1H3a1 1 0 01-1-1V8a1 1 0 011-1h8V5z"/></svg>';
      lockBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        canvas.setLayerLocked(s.id, !s.locked);
      });
      actionsEl.appendChild(lockBtn);

      const visBtn = document.createElement("button");
      visBtn.type = "button";
      visBtn.className = `layer-action-btn${s.visible === false ? " active" : ""}`;
      visBtn.title = tr("layers.toggleVisible", "表示/非表示切替");
      visBtn.innerHTML = (s.visible === false)
        ? '<svg viewBox="0 0 16 16"><path d="M2.3 1.2L1.2 2.3l2.1 2.1C2 5.4 1.1 6.7.7 8c1 3 4 5 7.3 5 1.4 0 2.7-.4 3.8-1l2 2 1.1-1.1L2.3 1.2zM8 11c-1.7 0-3-1.3-3-3 0-.5.1-.9.3-1.3l1.2 1.2c0 .7.6 1.3 1.3 1.3l1.2 1.2c-.3.4-.6.6-1 .6zM8 3c3.3 0 6.3 2 7.3 5-.4 1-.9 1.9-1.7 2.7l-1.1-1.1c.5-.5.9-1 .1-1.6-.8-1.9-2.5-3.2-4.6-3.2-.5 0-1 .1-1.5.2L5.3 3.8C6.2 3.3 7.1 3 8 3z"/></svg>'
        : '<svg viewBox="0 0 16 16"><path d="M8 3C4.7 3 1.7 5 .7 8c1 3 4 5 7.3 5s6.3-2 7.3-5c-1-3-4-5-7.3-5zm0 8a3 3 0 110-6 3 3 0 010 6zm0-4.8A1.8 1.8 0 108 9.8a1.8 1.8 0 000-3.6z"/></svg>';
      visBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        canvas.setLayerVisible(s.id, s.visible === false);
      });
      actionsEl.appendChild(visBtn);

      row.appendChild(actionsEl);

      row.addEventListener("click", (e) => {
        canvas.selectShape(s.id, e.shiftKey);
      });

      row.addEventListener("dragstart", (e) => {
        if (effLocked) {
          e.preventDefault();
          return;
        }
        const candidateIds = canvas.selectedShapeIds.has(s.id)
          ? Array.from(canvas.selectedShapeIds)
          : [s.id];
        draggingLayerIds = candidateIds.filter(id => {
          const item = canvas.getShapeById(id);
          return item && !canvas.isEffectivelyLocked(item);
        });
        if (draggingLayerIds.length === 0) {
          e.preventDefault();
          return;
        }
        if (e.dataTransfer) {
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/plain", s.id);
        }
      });

      row.addEventListener("dragover", (e) => {
        if (!draggingLayerIds || draggingLayerIds.length === 0) return;
        if (draggingLayerIds.includes(s.id)) return;
        const rect = row.getBoundingClientRect();
        const rel = rect.height > 0 ? (e.clientY - rect.top) / rect.height : 0.5;
        let pos = "after";
        if (s.type === "frame" && !effLocked && rel >= 0.28 && rel <= 0.72) {
          pos = "inside";
        } else if (rel < 0.5) {
          pos = "before";
        }
        if (pos !== "inside" && s.parentId) {
          const parentObj = canvas.getShapeById(s.parentId);
          if (parentObj && canvas.isEffectivelyLocked(parentObj)) return;
        }
        e.preventDefault();
        clearDropIndicators();
        row.classList.add(`drop-${pos}`);
        row.dataset.dropPos = pos;
      });

      row.addEventListener("dragleave", () => {
        row.classList.remove("drop-before", "drop-inside", "drop-after");
      });

      row.addEventListener("drop", (e) => {
        e.preventDefault();
        const dropPos = row.dataset.dropPos || "before";
        clearDropIndicators();
        if (draggingLayerIds && draggingLayerIds.length > 0 && !draggingLayerIds.includes(s.id)) {
          canvas.moveLayerInHierarchy(draggingLayerIds, s.id, dropPos);
        }
        draggingLayerIds = [];
      });

      row.addEventListener("dragend", () => {
        clearDropIndicators();
        draggingLayerIds = [];
      });

      layersList.appendChild(row);
    });
  }

  function syncCanvasPropertyPanel() {
    if (!inputCanvasW || !inputCanvasH) return;
    shapeNameLabel.textContent = window.I18N ? I18N.t("panel.canvasTarget") : "キャンバス";
    inputCanvasW.value = Math.round(canvas.width);
    inputCanvasH.value = Math.round(canvas.height);

    const isAsset = (canvas.docType === "asset");
    if (canvasDocTypeBadge) {
      canvasDocTypeBadge.textContent = window.I18N
        ? I18N.t(isAsset ? "panel.docTypeAsset" : "panel.docTypeSlide")
        : (isAsset ? "図形素材" : "スライド");
    }

    const isTransparent = (canvas.backgroundColor === "transparent");
    if (checkCanvasTransparent) {
      checkCanvasTransparent.checked = isTransparent;
    }
    if (canvasBgColorRow) {
      canvasBgColorRow.style.opacity = isTransparent ? "0.4" : "1";
      canvasBgColorRow.style.pointerEvents = isTransparent ? "none" : "auto";
    }
    if (inputCanvasBg && !isTransparent && canvas.backgroundColor && canvas.backgroundColor.startsWith("#")) {
      inputCanvasBg.value = canvas.backgroundColor.substring(0, 7);
    }
  }

  function syncPropertyPanel() {
    const selectedList = canvas.getSelectedShapes();
    const s = canvas.getSelectedShape();
    if (!s) {
      propPanelEmpty.style.display = "block";
      propPanelContent.style.display = "none";
      propPanelContent.classList.remove("is-locked-panel");
      if (lockedSelectionBanner) lockedSelectionBanner.style.display = "none";
      propEditPointsBtn.disabled = true;
      if (multiSelectSection) multiSelectSection.style.display = "none";
      if (childLayoutSection) childLayoutSection.style.display = "none";
      if (framePropsSection) framePropsSection.style.display = "none";
      syncCanvasPropertyPanel();
      return;
    }

    propPanelEmpty.style.display = "none";
    propPanelContent.style.display = "block";
    propPanelContent.querySelectorAll("input, select, textarea, button").forEach(ctrl => {
      ctrl.disabled = false;
    });

    const isSingle = (selectedList.length === 1);
    const isFirstLocked = canvas.isEffectivelyLocked(s);
    const allLocked = selectedList.every(item => canvas.isEffectivelyLocked(item));
    const anyEditable = selectedList.some(item => !canvas.isEffectivelyLocked(item));

    propEditPointsBtn.disabled = (!isSingle || isFirstLocked || s.type === "text" || s.type === "math_plot" || s.type === "frame");
    propDuplicateBtn.disabled = !anyEditable;
    propDeleteBtn.disabled = !anyEditable;
    propBringForwardBtn.disabled = !anyEditable;
    propSendBackwardBtn.disabled = !anyEditable;
    propBringFrontBtn.disabled = !anyEditable;
    propSendBackBtn.disabled = !anyEditable;
    propFlipHBtn.disabled = !anyEditable;
    propFlipVBtn.disabled = !anyEditable;

    if (multiSelectSection) {
      if (selectedList.length >= 2) {
        multiSelectSection.style.display = "block";
        if (multiSelectTitle) {
          multiSelectTitle.textContent = window.I18N
            ? I18N.t("panel.multiSelectCount", { count: selectedList.length })
            : `複数選択中 (${selectedList.length}個)`;
        }
        if (propFrameMultiBtn) propFrameMultiBtn.disabled = !anyEditable;
        if (propAutoLayoutMultiBtn) propAutoLayoutMultiBtn.disabled = !anyEditable;
      } else {
        multiSelectSection.style.display = "none";
      }
    }

    if (childLayoutSection) {
      const parentFrame = (isSingle && s.parentId) ? canvas.getShapeById(s.parentId) : null;
      if (parentFrame) {
        childLayoutSection.style.display = "block";
        if (childParentNameLabel) {
          childParentNameLabel.textContent = parentFrame.name || (window.I18N ? I18N.t("shape.frame") : "フレーム");
        }
        const siblings = canvas.getChildren(parentFrame.id);
        const idx = siblings.indexOf(s);
        if (btnRemoveFromFrame) btnRemoveFromFrame.disabled = isFirstLocked;
        if (btnChildMovePrev) btnChildMovePrev.disabled = (isFirstLocked || idx <= 0);
        if (btnChildMoveNext) btnChildMoveNext.disabled = (isFirstLocked || idx < 0 || idx >= siblings.length - 1);
        const isParentAL = !!(parentFrame.autoLayout && parentFrame.autoLayout.enabled);
        const isAbs = (s.layoutPositioning === "absolute");
        if (childAbsolutePosRow) {
          childAbsolutePosRow.style.display = isParentAL ? "flex" : "none";
        }
        if (checkChildAbsolutePos) {
          checkChildAbsolutePos.checked = isAbs;
        }
        if (childAutoLayoutSizingRow) {
          childAutoLayoutSizingRow.style.display = (isParentAL && !isAbs) ? "grid" : "none";
        }
        if (isParentAL && !isAbs) {
          const isChildFrame = (s.type === "frame");
          [selectChildSizingH, selectChildSizingV].forEach((sel, i) => {
            if (!sel) return;
            const hugOpt = sel.querySelector('option[value="hug"]');
            if (hugOpt) {
              hugOpt.disabled = !isChildFrame;
              hugOpt.hidden = !isChildFrame;
            }
            const curVal = i === 0 ? (s.layoutSizingH || "fixed") : (s.layoutSizingV || "fixed");
            sel.value = (!isChildFrame && curVal === "hug") ? "fixed" : curVal;
          });
        }
        if (constraintsSection) {
          const showCon = (!isParentAL || isAbs);
          constraintsSection.style.display = showCon ? "block" : "none";
          if (showCon) {
            const con = s.constraints || { horizontal: "left", vertical: "top" };
            const conH = con.horizontal || "left";
            const conV = con.vertical || "top";
            if (selectConstraintH) selectConstraintH.value = conH;
            if (selectConstraintV) selectConstraintV.value = conV;
            if (constraintsDiagram) {
              const setEdge = (edge, active) => {
                const btn = constraintsDiagram.querySelector(`.constraint-tick[data-edge="${edge}"]`);
                if (btn) btn.classList.toggle("active", !!active);
              };
              setEdge("left", conH === "left" || conH === "leftright");
              setEdge("right", conH === "right" || conH === "leftright");
              setEdge("centerH", conH === "center");
              setEdge("top", conV === "top" || conV === "topbottom");
              setEdge("bottom", conV === "bottom" || conV === "topbottom");
              setEdge("centerV", conV === "center");
            }
          }
        }
      } else {
        childLayoutSection.style.display = "none";
      }
    }

    if (minMaxSection) {
      const parentFrame = (isSingle && s.parentId) ? canvas.getShapeById(s.parentId) : null;
      const isParentAL = !!(parentFrame && parentFrame.autoLayout && parentFrame.autoLayout.enabled);
      const showMinMax = (isSingle && (s.type === "frame" || isParentAL));
      minMaxSection.style.display = showMinMax ? "block" : "none";
      if (showMinMax) {
        if (inputMinW) inputMinW.value = (s.minWidth !== null && s.minWidth !== undefined) ? s.minWidth : "";
        if (inputMaxW) inputMaxW.value = (s.maxWidth !== null && s.maxWidth !== undefined) ? s.maxWidth : "";
        if (inputMinH) inputMinH.value = (s.minHeight !== null && s.minHeight !== undefined) ? s.minHeight : "";
        if (inputMaxH) inputMaxH.value = (s.maxHeight !== null && s.maxHeight !== undefined) ? s.maxHeight : "";
      }
    }

    if (window.I18N) {
      if (s.type === "math_plot" && s.mathConfig && s.mathConfig.presetId) {
        shapeNameLabel.textContent = I18N.presetName(s.mathConfig.presetId, s.name);
      } else {
        shapeNameLabel.textContent = I18N.shapeName(s.type, s.name || s.type);
      }
    } else {
      shapeNameLabel.textContent = s.name || s.type;
    }
    inputX.value = Math.round(s.x);
    inputY.value = Math.round(s.y);
    inputW.value = Math.round(s.width);
    inputH.value = Math.round(s.height);
    inputRot.value = Math.round(s.rotation || 0);

    const hasHexFill = !!(s.fill && s.fill.startsWith("#"));
    const fillHex = hasHexFill ? s.fill.substring(0, 7) : "#3b82f6";
    inputFill.value = fillHex;
    if (inputFillHex) inputFillHex.value = hasHexFill ? fillHex : "";
    inputFillOpacity.value = Math.round((s.fillOpacity ?? 1.0) * 100);

    // 枠線の有無判定(strokeWidth>0かつstrokeがnone/transparent以外)
    const hasStroke = !!(s.strokeWidth > 0 && s.stroke && s.stroke !== "none" && s.stroke !== "transparent");
    checkEnableStroke.checked = hasStroke;
    strokeControlsContainer.style.opacity = hasStroke ? "1" : "0.35";
    strokeControlsContainer.style.pointerEvents = hasStroke ? "auto" : "none";

    const strokeHex = s.stroke && s.stroke.startsWith("#") ? s.stroke.substring(0, 7) : "#1d4ed8";
    inputStroke.value = strokeHex;
    if (inputStrokeHex) inputStrokeHex.value = strokeHex;
    inputStrokeWidth.value = hasStroke ? s.strokeWidth : 0;
    selectStrokeDash.value = s.strokeDash || "solid";
    checkShadow.checked = !!s.shadow;

    inputShearX.value = s.shearX || 0;
    inputShearY.value = s.shearY || 0;

    const textTarget = selectedList.find(item => item.type === "text");
    if (textTarget) {
      textPropsSection.style.display = "block";
      inputText.disabled = !isSingle;
      inputText.value = isSingle ? (textTarget.text || "") : "";
      inputFontSize.value = textTarget.fontSize || 28;
      selectFontFamily.value = textTarget.fontFamily || "sans-serif";
      selectTextAlign.value = textTarget.textAlign || "center";
      selectTextWarp.value = textTarget.textWarp || "none";
    } else {
      textPropsSection.style.display = "none";
    }

    if (framePropsSection) {
      if (isSingle && s.type === "frame") {
        framePropsSection.style.display = "block";
        if (inputFrameName) inputFrameName.value = s.name || "";
        if (inputFrameRadius) inputFrameRadius.value = s.cornerRadius || 0;
        if (checkFrameClip) checkFrameClip.checked = !!s.clipContent;

        const al = s.autoLayout || canvas.createDefaultAutoLayoutConfig();
        if (checkAutoLayoutEnabled) checkAutoLayoutEnabled.checked = !!al.enabled;
        if (autoLayoutControls) autoLayoutControls.style.display = al.enabled ? "block" : "none";

        if (alDirectionGroup) {
          const curDir = al.direction || "row";
          alDirectionGroup.querySelectorAll(".al-dir-btn").forEach(btn => {
            btn.classList.toggle("active", btn.getAttribute("data-dir") === curDir);
          });
        }
        if (selectAlSizingH) selectAlSizingH.value = al.sizingH || "hug";
        if (selectAlSizingV) selectAlSizingV.value = al.sizingV || "hug";
        const isAutoGap = (al.gapMode === "auto");
        if (btnAlGapAuto) btnAlGapAuto.classList.toggle("active", isAutoGap);
        if (inputAlGap) {
          inputAlGap.disabled = isAutoGap;
          inputAlGap.value = isAutoGap ? "" : (al.gap ?? 12);
        }
        if (alCrossGapRow) {
          alCrossGapRow.style.display = (al.direction === "wrap") ? "flex" : "none";
        }
        if (inputAlCrossGap) {
          inputAlCrossGap.value = (al.crossGap !== null && al.crossGap !== undefined) ? al.crossGap : "";
        }
        if (selectAlStacking) {
          selectAlStacking.value = al.canvasStacking || "last-on-top";
        }

        const pT = al.paddingTop ?? 16;
        const pR = al.paddingRight ?? 16;
        const pB = al.paddingBottom ?? 16;
        const pL = al.paddingLeft ?? 16;
        const isUniformPair = (pT === pB && pL === pR);
        if (checkAlPadIndividual) {
          if (!isUniformPair) checkAlPadIndividual.checked = true;
          const ind = checkAlPadIndividual.checked;
          if (alPadPairInputs) alPadPairInputs.style.display = ind ? "none" : "grid";
          if (alPadIndividualInputs) alPadIndividualInputs.style.display = ind ? "grid" : "none";
        }
        if (inputAlPadH) inputAlPadH.value = pL;
        if (inputAlPadV) inputAlPadV.value = pT;
        if (inputAlPadT) inputAlPadT.value = pT;
        if (inputAlPadR) inputAlPadR.value = pR;
        if (inputAlPadB) inputAlPadB.value = pB;
        if (inputAlPadL) inputAlPadL.value = pL;

        if (alAlignGrid) {
          const curAlign = al.align || "top-left";
          alAlignGrid.querySelectorAll(".al-align-cell").forEach(cell => {
            cell.classList.toggle("active", cell.getAttribute("data-align") === curAlign);
          });
        }
      } else {
        framePropsSection.style.display = "none";
      }
    }

    if (mathPropsSection) {
      if (isSingle && s.type === "math_plot") {
        mathPropsSection.style.display = "block";
        const cfg = s.mathConfig || {};
        const data = s.mathData || {};
        inputMathExpr.value = cfg.expr || "sin(x)";
        inputMathXMin.value = cfg.xMin ?? -4;
        inputMathXMax.value = cfg.xMax ?? 4;
        inputMathYMin.value = cfg.yMin ?? -3;
        inputMathYMax.value = cfg.yMax ?? 3;
        inputMathSteps.value = cfg.steps ?? 120;
        inputMathLineWidth.value = cfg.lineWidth ?? 3;
        if (inputMathLineColor) {
          const lc = cfg.lineColor || (s.stroke && s.stroke.startsWith("#") ? s.stroke : "#2563eb");
          inputMathLineColor.value = lc.substring(0, 7);
        }
        checkMathShowAxes.checked = cfg.showAxes === true;
        if (checkMathShowFrame) checkMathShowFrame.checked = cfg.showFrame === true;
        if (checkMathEqualAspect) checkMathEqualAspect.checked = cfg.equalAspect !== false;
        if (data.error) {
          mathErrorBox.textContent = data.error;
          mathErrorBox.style.display = "block";
        } else {
          mathErrorBox.style.display = "none";
        }
        mathRubyExprPreview.textContent = data.rubyExpr || "";
      } else {
        mathPropsSection.style.display = "none";
      }
    }

    if (canvas.mode === "edit_points" && isSingle && s.points && canvas.activePointIndex !== null) {
      const pt = s.points[canvas.activePointIndex];
      if (pt) {
        pointTypeSelect.value = pt.type || "corner";
      }
    }

    if (lockedSelectionBanner) {
      lockedSelectionBanner.style.display = allLocked ? "flex" : "none";
    }
    propPanelContent.classList.toggle("is-locked-panel", allLocked);
    if (allLocked) {
      propPanelContent.querySelectorAll("input, select, textarea, button").forEach(ctrl => {
        if (ctrl.id !== "btnUnlockSelected") ctrl.disabled = true;
      });
    }
  }

  function bindPropertyInputs() {
    // キャンバスサイズと背景の編集
    const applyCanvasSize = () => {
      if (!inputCanvasW || !inputCanvasH) return;
      const w = parseInt(inputCanvasW.value, 10);
      const h = parseInt(inputCanvasH.value, 10);
      canvas.setCanvasSize(w, h);
      syncCanvasPropertyPanel();
      updateStatusDocInfo();
    };

    if (applyCanvasSizeBtn) {
      applyCanvasSizeBtn.addEventListener("click", applyCanvasSize);
    }
    if (swapCanvasSizeBtn) {
      swapCanvasSizeBtn.addEventListener("click", () => {
        canvas.setCanvasSize(canvas.height, canvas.width);
        syncCanvasPropertyPanel();
        updateStatusDocInfo();
      });
    }
    [inputCanvasW, inputCanvasH].forEach(el => {
      if (!el) return;
      el.addEventListener("keydown", (e) => {
        if (e.key === "Enter") applyCanvasSize();
      });
      el.addEventListener("change", applyCanvasSize);
    });
    if (canvasPresetGrid) {
      canvasPresetGrid.querySelectorAll(".canvas-preset-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          const w = parseInt(btn.getAttribute("data-w"), 10);
          const h = parseInt(btn.getAttribute("data-h"), 10);
          canvas.setCanvasSize(w, h);
          syncCanvasPropertyPanel();
          updateStatusDocInfo();
        });
      });
    }
    if (checkCanvasTransparent) {
      checkCanvasTransparent.addEventListener("change", (e) => {
        if (e.target.checked) {
          canvas.backgroundColor = "transparent";
        } else {
          canvas.backgroundColor = (inputCanvasBg && inputCanvasBg.value) ? inputCanvasBg.value : "#ffffff";
        }
        canvas.saveState();
        canvas.render();
        syncCanvasPropertyPanel();
        updateStatusDocInfo();
      });
    }
    if (inputCanvasBg) {
      const onBgColorChange = (e) => {
        if (checkCanvasTransparent) checkCanvasTransparent.checked = false;
        canvas.backgroundColor = e.target.value;
        canvas.saveState();
        canvas.render();
        syncCanvasPropertyPanel();
        updateStatusDocInfo();
      };
      inputCanvasBg.addEventListener("input", onBgColorChange);
      inputCanvasBg.addEventListener("change", onBgColorChange);
    }

    const update = (fn, options = {}) => {
      const multi = options.multi === true;
      const raw = multi ? canvas.getSelectedShapes() : (canvas.selectedShapeIds.size === 1 ? canvas.getSelectedShapes() : []);
      const targets = raw.filter(item => !canvas.isEffectivelyLocked(item));
      if (targets.length === 0) return;
      targets.forEach((item, idx) => fn(item, idx, targets));
      if (options.debounce) {
        canvas.saveStateDebounced();
      } else {
        canvas.saveState();
      }
      canvas.render();
    };

    const moveEditableRootsByAxis = (axis, nextVal, options = {}) => {
      const base = canvas.getSelectedShape();
      const rootIds = canvas.getEditableRootIds();
      if (!base || rootIds.length === 0) return;
      if (canvas.selectedShapeIds.size === 1 && canvas.isEffectivelyLocked(base)) return;
      const delta = (parseFloat(nextVal) || 0) - base[axis];
      const visited = new Set();
      rootIds.forEach(rid => {
        const rs = canvas.getShapeById(rid);
        if (rs) canvas.moveShapeWithDescendants(rs, axis === "x" ? delta : 0, axis === "y" ? delta : 0, visited);
      });
      if (options.debounce) {
        canvas.saveStateDebounced();
      } else {
        canvas.saveState();
      }
      canvas.render();
    };

    let mathResizeTimer = null;
    const scheduleMathResizeEval = (s) => {
      if (!s || s.type !== "math_plot" || !s.mathConfig || s.mathConfig.equalAspect === false) return;
      syncEqualAspectBounds(s, "x");
      clearTimeout(mathResizeTimer);
      mathResizeTimer = setTimeout(() => evaluateMathShape(s), 120);
    };

    inputX.addEventListener("input", e => moveEditableRootsByAxis("x", e.target.value));
    inputY.addEventListener("input", e => moveEditableRootsByAxis("y", e.target.value));
    inputW.addEventListener("input", e => update(s => {
      const snap = s.type === "frame" ? canvas.captureFrameResizeState(s) : null;
      s.width = Math.max(5, parseFloat(e.target.value) || 5);
      if (snap) canvas.applyConstraintsFromSnapshot(snap, false);
      if (s.type === "frame" && s.autoLayout && s.autoLayout.enabled) {
        s.autoLayout.sizingH = "fixed";
        if (selectAlSizingH) selectAlSizingH.value = "fixed";
        canvas.applyAutoLayout(s.id);
      } else {
        canvas.propagateAutoLayoutFrom(s);
      }
      scheduleMathResizeEval(s);
    }, { multi: true }));
    inputH.addEventListener("input", e => update(s => {
      const snap = s.type === "frame" ? canvas.captureFrameResizeState(s) : null;
      s.height = Math.max(5, parseFloat(e.target.value) || 5);
      if (snap) canvas.applyConstraintsFromSnapshot(snap, false);
      if (s.type === "frame" && s.autoLayout && s.autoLayout.enabled) {
        s.autoLayout.sizingV = "fixed";
        if (selectAlSizingV) selectAlSizingV.value = "fixed";
        canvas.applyAutoLayout(s.id);
      } else {
        canvas.propagateAutoLayoutFrom(s);
      }
      scheduleMathResizeEval(s);
    }, { multi: true }));

    [
      [inputMinW, "minWidth"],
      [inputMaxW, "maxWidth"],
      [inputMinH, "minHeight"],
      [inputMaxH, "maxHeight"]
    ].forEach(([elInput, propKey]) => {
      if (!elInput) return;
      elInput.addEventListener("input", e => update(s => {
        const raw = e.target.value.trim();
        if (raw === "") {
          s[propKey] = null;
        } else {
          const num = parseFloat(raw);
          s[propKey] = Number.isFinite(num) ? Math.max(0, Math.round(num)) : null;
        }
        if (s.type === "frame" && s.autoLayout && s.autoLayout.enabled) {
          canvas.applyAutoLayout(s.id);
        } else {
          canvas.propagateAutoLayoutFrom(s);
        }
        syncPropertyPanel();
      }));
    });
    inputRot.addEventListener("input", e => update(s => s.rotation = parseFloat(e.target.value) || 0, { multi: true, debounce: true }));
    inputRot.addEventListener("change", () => canvas.flushDebouncedSaveState());

    const normalizeHexColor = (raw) => {
      const s = String(raw || "").trim();
      const withHash = s.startsWith("#") ? s : `#${s}`;
      if (/^#[0-9a-fA-F]{6}$/.test(withHash)) return withHash.toLowerCase();
      if (/^#[0-9a-fA-F]{3}$/.test(withHash)) {
        return `#${withHash[1]}${withHash[1]}${withHash[2]}${withHash[2]}${withHash[3]}${withHash[3]}`.toLowerCase();
      }
      return null;
    };

    const applyFillColor = (hex, debounce = false) => {
      inputFill.value = hex;
      if (inputFillHex) inputFillHex.value = hex;
      update(s => {
        s.fill = hex;
        if ((s.fillOpacity ?? 1) <= 0) {
          s.fillOpacity = 1.0;
          inputFillOpacity.value = 100;
        }
      }, { multi: true, debounce });
    };

    const applyStrokeColor = (hex, debounce = false) => {
      inputStroke.value = hex;
      if (inputStrokeHex) inputStrokeHex.value = hex;
      update(s => {
        s.stroke = hex;
        if (!s.strokeWidth || s.strokeWidth === 0) {
          s.strokeWidth = 2;
          inputStrokeWidth.value = 2;
          checkEnableStroke.checked = true;
          strokeControlsContainer.style.opacity = "1";
          strokeControlsContainer.style.pointerEvents = "auto";
        }
      }, { multi: true, debounce });
    };

    inputFill.addEventListener("input", e => applyFillColor(e.target.value, true));
    inputFill.addEventListener("change", e => applyFillColor(e.target.value, false));
    if (inputFillHex) {
      inputFillHex.addEventListener("input", e => {
        const hex = normalizeHexColor(e.target.value);
        if (hex && String(e.target.value).trim().replace(/^#/, "").length === 6) applyFillColor(hex, true);
      });
      inputFillHex.addEventListener("change", e => {
        const hex = normalizeHexColor(e.target.value);
        if (hex) applyFillColor(hex, false);
        else inputFillHex.value = inputFill.value;
      });
    }
    if (fillSwatchRow) {
      fillSwatchRow.querySelectorAll(".color-swatch-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          const hex = btn.getAttribute("data-color");
          if (hex) applyFillColor(hex, false);
        });
      });
    }
    inputFillOpacity.addEventListener("input", e => update(s => {
      const v = parseFloat(e.target.value);
      s.fillOpacity = Number.isFinite(v) ? v / 100 : 1.0;
    }, { multi: true, debounce: true }));
    inputFillOpacity.addEventListener("change", () => canvas.flushDebouncedSaveState());

    // 枠線トグル
    checkEnableStroke.addEventListener("change", (e) => {
      const targets = canvas.getEditableSelectedShapes();
      if (targets.length === 0) return;
      targets.forEach(s => {
        if (e.target.checked) {
          s.strokeWidth = s.strokeWidth > 0 ? s.strokeWidth : 2;
          s.stroke = (s.stroke && s.stroke !== "none" && s.stroke !== "transparent") ? s.stroke : (inputStroke.value || "#1d4ed8");
        } else {
          s.strokeWidth = 0;
          s.stroke = "none";
        }
      });
      canvas.saveState();
      canvas.render();
      syncPropertyPanel();
    });

    inputStroke.addEventListener("input", e => applyStrokeColor(e.target.value));
    inputStroke.addEventListener("change", e => applyStrokeColor(e.target.value));
    if (inputStrokeHex) {
      inputStrokeHex.addEventListener("input", e => {
        const hex = normalizeHexColor(e.target.value);
        if (hex && String(e.target.value).trim().replace(/^#/, "").length === 6) applyStrokeColor(hex);
      });
      inputStrokeHex.addEventListener("change", e => {
        const hex = normalizeHexColor(e.target.value);
        if (hex) applyStrokeColor(hex);
        else inputStrokeHex.value = inputStroke.value;
      });
    }
    if (strokeSwatchRow) {
      strokeSwatchRow.querySelectorAll(".color-swatch-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          const hex = btn.getAttribute("data-color");
          if (hex) applyStrokeColor(hex);
        });
      });
    }

    inputStrokeWidth.addEventListener("input", e => update(s => {
      const w = parseFloat(e.target.value) || 0;
      s.strokeWidth = Math.max(0, w);
      if (s.strokeWidth === 0) {
        s.stroke = "none";
        checkEnableStroke.checked = false;
        strokeControlsContainer.style.opacity = "0.35";
        strokeControlsContainer.style.pointerEvents = "none";
      } else {
        if (!s.stroke || s.stroke === "none") s.stroke = inputStroke.value || "#1d4ed8";
        checkEnableStroke.checked = true;
        strokeControlsContainer.style.opacity = "1";
        strokeControlsContainer.style.pointerEvents = "auto";
      }
    }, { multi: true, debounce: true }));
    inputStrokeWidth.addEventListener("change", () => canvas.flushDebouncedSaveState());

    selectStrokeDash.addEventListener("change", e => update(s => s.strokeDash = e.target.value, { multi: true }));
    checkShadow.addEventListener("change", e => update(s => s.shadow = e.target.checked, { multi: true }));

    inputShearX.addEventListener("input", e => update(s => s.shearX = parseFloat(e.target.value) || 0, { multi: true, debounce: true }));
    inputShearX.addEventListener("change", () => canvas.flushDebouncedSaveState());
    inputShearY.addEventListener("input", e => update(s => s.shearY = parseFloat(e.target.value) || 0, { multi: true, debounce: true }));
    inputShearY.addEventListener("change", () => canvas.flushDebouncedSaveState());

    inputText.addEventListener("input", e => update(s => {
      if (s.type === "text") s.text = e.target.value;
    }, { debounce: true }));
    inputText.addEventListener("change", () => canvas.flushDebouncedSaveState());
    inputFontSize.addEventListener("input", e => update(s => {
      if (s.type === "text") s.fontSize = parseFloat(e.target.value) || 12;
    }, { multi: true, debounce: true }));
    inputFontSize.addEventListener("change", () => canvas.flushDebouncedSaveState());
    selectFontFamily.addEventListener("change", e => update(s => {
      if (s.type === "text") s.fontFamily = e.target.value;
    }, { multi: true }));
    selectTextAlign.addEventListener("change", e => update(s => {
      if (s.type === "text") s.textAlign = e.target.value;
    }, { multi: true }));
    selectTextWarp.addEventListener("change", e => update(s => {
      if (s.type === "text") s.textWarp = e.target.value;
    }, { multi: true }));

    pointTypeSelect.addEventListener("change", e => {
      if (canvas.selectedShapeIds.size !== 1) return;
      const s = canvas.getSelectedShape();
      if (!s || canvas.isEffectivelyLocked(s) || !s.points || canvas.activePointIndex === null) return;
      const pt = s.points[canvas.activePointIndex];
      if (pt) {
        pt.type = e.target.value;
        canvas.saveState();
        canvas.render();
      }
    });

    deletePointBtn.addEventListener("click", () => {
      if (canvas.selectedShapeIds.size !== 1) return;
      const s = canvas.getSelectedShape();
      if (!s || canvas.isEffectivelyLocked(s) || !s.points || canvas.activePointIndex === null) return;
      if (EditPointsManager.deletePoint(s.points, canvas.activePointIndex)) {
        canvas.activePointIndex = Math.min(canvas.activePointIndex, s.points.length - 1);
        canvas.saveState();
        canvas.render();
      }
    });

    const applyMathInputs = (anchorAxis = "x") => {
      if (canvas.selectedShapeIds.size !== 1) return;
      const s = canvas.getSelectedShape();
      if (!s || s.type !== "math_plot" || canvas.isEffectivelyLocked(s)) return;
      const expr = (inputMathExpr.value || "").trim() || "sin(x)";
      const xMin = parseFloat(inputMathXMin.value);
      const xMax = parseFloat(inputMathXMax.value);
      const yMin = parseFloat(inputMathYMin.value);
      const yMax = parseFloat(inputMathYMax.value);
      const steps = parseInt(inputMathSteps.value, 10);
      const lineWidth = parseFloat(inputMathLineWidth.value);
      const prevCfg = s.mathConfig || {};
      const lineColor = (inputMathLineColor && inputMathLineColor.value) || prevCfg.lineColor || "#2563eb";
      const equalAspect = checkMathEqualAspect ? checkMathEqualAspect.checked : (prevCfg.equalAspect !== false);
      s.mathConfig = {
        mode: "function",
        expr,
        xMin: Number.isFinite(xMin) ? xMin : -4,
        xMax: Number.isFinite(xMax) ? xMax : 4,
        yMin: Number.isFinite(yMin) ? yMin : -3,
        yMax: Number.isFinite(yMax) ? yMax : 3,
        steps: Number.isFinite(steps) ? Math.max(10, Math.min(600, steps)) : 120,
        lineWidth: Number.isFinite(lineWidth) ? Math.max(1, Math.min(20, lineWidth)) : 3,
        lineColor,
        showAxes: checkMathShowAxes ? checkMathShowAxes.checked : false,
        showFrame: checkMathShowFrame ? checkMathShowFrame.checked : false,
        equalAspect
      };
      if (equalAspect) {
        syncEqualAspectBounds(s, anchorAxis);
      }
      evaluateMathShape(s);
    };

    if (applyMathBtn) {
      applyMathBtn.addEventListener("click", () => applyMathInputs("x"));
    }
    if (inputMathExpr) {
      inputMathExpr.addEventListener("keydown", e => {
        if (e.key === "Enter") {
          e.preventDefault();
          applyMathInputs("x");
        }
      });
    }
    [inputMathXMin, inputMathXMax, inputMathSteps].forEach(el => {
      if (el) el.addEventListener("change", () => applyMathInputs("x"));
    });
    [inputMathYMin, inputMathYMax].forEach(el => {
      if (el) el.addEventListener("change", () => applyMathInputs("y"));
    });
    if (inputMathLineWidth) {
      inputMathLineWidth.addEventListener("input", e => update(s => {
        if (s.type !== "math_plot") return;
        const lw = Math.max(1, Math.min(20, parseFloat(e.target.value) || 3));
        s.mathConfig = Object.assign({}, s.mathConfig || {}, { lineWidth: lw });
      }));
    }
    if (inputMathLineColor) {
      const onMathColor = (e) => update(s => {
        if (s.type !== "math_plot") return;
        s.mathConfig = Object.assign({}, s.mathConfig || {}, { lineColor: e.target.value });
      });
      inputMathLineColor.addEventListener("input", onMathColor);
      inputMathLineColor.addEventListener("change", onMathColor);
    }
    if (checkMathShowAxes) {
      checkMathShowAxes.addEventListener("change", e => update(s => {
        if (s.type !== "math_plot") return;
        s.mathConfig = Object.assign({}, s.mathConfig || {}, { showAxes: e.target.checked });
      }));
    }
    if (checkMathShowFrame) {
      checkMathShowFrame.addEventListener("change", e => update(s => {
        if (s.type !== "math_plot") return;
        s.mathConfig = Object.assign({}, s.mathConfig || {}, { showFrame: e.target.checked });
      }));
    }
    if (checkMathEqualAspect) {
      checkMathEqualAspect.addEventListener("change", e => {
        if (canvas.selectedShapeIds.size !== 1) return;
        const s = canvas.getSelectedShape();
        if (!s || s.type !== "math_plot" || canvas.isEffectivelyLocked(s)) return;
        s.mathConfig = Object.assign({}, s.mathConfig || {}, { equalAspect: e.target.checked });
        if (e.target.checked) {
          syncEqualAspectBounds(s, "x");
          evaluateMathShape(s);
        } else {
          canvas.saveState();
          canvas.render();
        }
      });
    }

    // 複数選択・子レイアウト・フレーム＆オートレイアウト配線
    if (propFrameMultiBtn) {
      propFrameMultiBtn.addEventListener("click", () => canvas.frameSelected(false));
    }
    if (propAutoLayoutMultiBtn) {
      propAutoLayoutMultiBtn.addEventListener("click", () => canvas.toggleAutoLayoutSelected());
    }
    if (btnRemoveFromFrame) {
      btnRemoveFromFrame.addEventListener("click", () => canvas.removeFromParent());
    }
    if (btnChildMovePrev) {
      btnChildMovePrev.addEventListener("click", () => {
        if (canvas.selectedShapeIds.size !== 1) return;
        const s = canvas.getSelectedShape();
        if (s && !canvas.isEffectivelyLocked(s)) canvas.reorderInParent(s.id, -1);
      });
    }
    if (btnChildMoveNext) {
      btnChildMoveNext.addEventListener("click", () => {
        if (canvas.selectedShapeIds.size !== 1) return;
        const s = canvas.getSelectedShape();
        if (s && !canvas.isEffectivelyLocked(s)) canvas.reorderInParent(s.id, 1);
      });
    }
    if (checkChildAbsolutePos) {
      checkChildAbsolutePos.addEventListener("change", e => update(s => {
        s.layoutPositioning = e.target.checked ? "absolute" : "auto";
        if (s.parentId) {
          canvas.applyAutoLayout(s.parentId);
        }
        syncPropertyPanel();
      }));
    }
    if (selectChildSizingH) {
      selectChildSizingH.addEventListener("change", e => update(s => {
        s.layoutSizingH = e.target.value;
        canvas.propagateAutoLayoutFrom(s);
        syncPropertyPanel();
      }));
    }
    if (selectChildSizingV) {
      selectChildSizingV.addEventListener("change", e => update(s => {
        s.layoutSizingV = e.target.value;
        canvas.propagateAutoLayoutFrom(s);
        syncPropertyPanel();
      }));
    }
    if (selectConstraintH) {
      selectConstraintH.addEventListener("change", e => update(s => {
        s.constraints = Object.assign({ horizontal: "left", vertical: "top" }, s.constraints || {}, { horizontal: e.target.value });
        syncPropertyPanel();
      }));
    }
    if (selectConstraintV) {
      selectConstraintV.addEventListener("change", e => update(s => {
        s.constraints = Object.assign({ horizontal: "left", vertical: "top" }, s.constraints || {}, { vertical: e.target.value });
        syncPropertyPanel();
      }));
    }
    if (constraintsDiagram) {
      constraintsDiagram.querySelectorAll(".constraint-tick").forEach(btn => {
        btn.addEventListener("click", () => update(s => {
          const con = Object.assign({ horizontal: "left", vertical: "top" }, s.constraints || {});
          const edge = btn.getAttribute("data-edge");
          if (edge === "left") {
            if (con.horizontal === "leftright") con.horizontal = "right";
            else if (con.horizontal === "right") con.horizontal = "leftright";
            else con.horizontal = "left";
          } else if (edge === "right") {
            if (con.horizontal === "leftright") con.horizontal = "left";
            else if (con.horizontal === "left") con.horizontal = "leftright";
            else con.horizontal = "right";
          } else if (edge === "centerH") {
            con.horizontal = (con.horizontal === "center") ? "scale" : "center";
          } else if (edge === "top") {
            if (con.vertical === "topbottom") con.vertical = "bottom";
            else if (con.vertical === "bottom") con.vertical = "topbottom";
            else con.vertical = "top";
          } else if (edge === "bottom") {
            if (con.vertical === "topbottom") con.vertical = "top";
            else if (con.vertical === "top") con.vertical = "topbottom";
            else con.vertical = "bottom";
          } else if (edge === "centerV") {
            con.vertical = (con.vertical === "center") ? "scale" : "center";
          }
          s.constraints = con;
          syncPropertyPanel();
        }));
      });
    }

    if (btnUnframe) {
      btnUnframe.addEventListener("click", () => canvas.unframeSelected());
    }
    if (inputFrameName) {
      inputFrameName.addEventListener("input", e => update(s => {
        if (s.type === "frame") {
          s.name = e.target.value;
          renderLayersPanel();
        }
      }));
    }
    if (inputFrameRadius) {
      inputFrameRadius.addEventListener("input", e => update(s => {
        if (s.type === "frame") s.cornerRadius = Math.max(0, parseFloat(e.target.value) || 0);
      }));
    }
    if (checkFrameClip) {
      checkFrameClip.addEventListener("change", e => update(s => {
        if (s.type === "frame") s.clipContent = e.target.checked;
      }));
    }

    const updateFrameAutoLayout = (mutator) => {
      if (canvas.selectedShapeIds.size !== 1) return;
      const s = canvas.getSelectedShape();
      if (!s || s.type !== "frame" || canvas.isEffectivelyLocked(s)) return;
      if (!s.autoLayout) s.autoLayout = canvas.createDefaultAutoLayoutConfig();
      mutator(s.autoLayout, s);
      if (s.autoLayout.enabled) {
        canvas.applyAutoLayout(s.id);
      }
      canvas.saveState();
      canvas.render();
      syncPropertyPanel();
    };

    if (checkAutoLayoutEnabled) {
      checkAutoLayoutEnabled.addEventListener("change", e => updateFrameAutoLayout((al, s) => {
        al.enabled = e.target.checked;
        if (al.enabled) {
          const children = canvas.getChildren(s.id);
          if (children.length >= 2) {
            const xs = children.map(c => c.x);
            const ys = children.map(c => c.y);
            al.direction = (Math.max(...ys) - Math.min(...ys)) > (Math.max(...xs) - Math.min(...xs)) ? "column" : "row";
          }
        }
      }));
    }
    if (alDirectionGroup) {
      alDirectionGroup.querySelectorAll(".al-dir-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          const dir = btn.getAttribute("data-dir");
          updateFrameAutoLayout(al => { al.direction = dir; });
        });
      });
    }
    if (selectAlSizingH) {
      selectAlSizingH.addEventListener("change", e => updateFrameAutoLayout(al => { al.sizingH = e.target.value; }));
    }
    if (selectAlSizingV) {
      selectAlSizingV.addEventListener("change", e => updateFrameAutoLayout(al => { al.sizingV = e.target.value; }));
    }
    if (inputAlGap) {
      inputAlGap.addEventListener("input", e => updateFrameAutoLayout(al => {
        const val = parseFloat(e.target.value);
        al.gap = Number.isFinite(val) ? val : 0;
        al.gapMode = "fixed";
      }));
    }
    if (btnAlGapAuto) {
      btnAlGapAuto.addEventListener("click", () => updateFrameAutoLayout(al => {
        al.gapMode = (al.gapMode === "auto") ? "fixed" : "auto";
      }));
    }
    if (inputAlCrossGap) {
      inputAlCrossGap.addEventListener("input", e => updateFrameAutoLayout(al => {
        const raw = e.target.value.trim();
        if (raw === "") {
          al.crossGap = null;
        } else {
          const val = parseFloat(raw);
          al.crossGap = Number.isFinite(val) ? Math.max(0, val) : null;
        }
      }));
    }
    if (selectAlStacking) {
      selectAlStacking.addEventListener("change", e => updateFrameAutoLayout(al => {
        al.canvasStacking = e.target.value;
      }));
    }
    if (checkAlPadIndividual) {
      checkAlPadIndividual.addEventListener("change", () => {
        const ind = checkAlPadIndividual.checked;
        if (alPadPairInputs) alPadPairInputs.style.display = ind ? "none" : "grid";
        if (alPadIndividualInputs) alPadIndividualInputs.style.display = ind ? "grid" : "none";
      });
    }
    if (inputAlPadH) {
      inputAlPadH.addEventListener("input", e => updateFrameAutoLayout(al => {
        const v = Math.max(0, parseFloat(e.target.value) || 0);
        al.paddingLeft = v;
        al.paddingRight = v;
      }));
    }
    if (inputAlPadV) {
      inputAlPadV.addEventListener("input", e => updateFrameAutoLayout(al => {
        const v = Math.max(0, parseFloat(e.target.value) || 0);
        al.paddingTop = v;
        al.paddingBottom = v;
      }));
    }
    [
      [inputAlPadT, "paddingTop"],
      [inputAlPadR, "paddingRight"],
      [inputAlPadB, "paddingBottom"],
      [inputAlPadL, "paddingLeft"]
    ].forEach(([elInput, key]) => {
      if (!elInput) return;
      elInput.addEventListener("input", e => updateFrameAutoLayout(al => {
        al[key] = Math.max(0, parseFloat(e.target.value) || 0);
      }));
    });
    if (alAlignGrid) {
      alAlignGrid.querySelectorAll(".al-align-cell").forEach(cell => {
        cell.addEventListener("click", () => {
          const alignVal = cell.getAttribute("data-align");
          updateFrameAutoLayout(al => { al.align = alignVal; });
        });
      });
    }
  }

  function updateUndoRedoButtons() {
    undoBtn.disabled = (canvas.historyIndex <= 0);
    redoBtn.disabled = (canvas.historyIndex >= canvas.history.length - 1);
  }

  // --- マウス操作 ---
  function setupCanvasMouseEvents(canvas, el) {
    let isDragging = false;
    let dragType = null;
    let dragTarget = null;
    let startMouse = { x: 0, y: 0 };
    let startShapeState = null;
    let activeHandleId = null;
    let startMoveItems = null; // 複数＆親子移動の初期位置マップ
    let startResizeSnapshot = null;
    let altDuplicated = false;

    function getCanvasCoords(evt) {
      const rect = el.getBoundingClientRect();
      const clientX = evt.clientX;
      const clientY = evt.clientY;
      return {
        x: (clientX - rect.left) / canvas.zoom,
        y: (clientY - rect.top) / canvas.zoom
      };
    }

    function findSpacingGuideAt(pos) {
      const s = canvas.getSelectedShape();
      if (!s || s.type !== "frame" || !s.autoLayout || !s.autoLayout.enabled) return null;
      if (canvas.isEffectivelyLocked(s)) return null;
      const guides = canvas.getAutoLayoutSpacingGuides(s);
      const tol = Math.max(10, 10 / canvas.zoom);
      let best = null;
      let bestDist = Infinity;
      guides.forEach(g => {
        const d = Math.hypot(pos.x - g.hx, pos.y - g.hy);
        if (d <= tol && d < bestDist) {
          best = g;
          bestDist = d;
        }
      });
      return best;
    }

    function cloneRootsForAltDrag() {
      if (!startMoveItems || startMoveItems.length === 0) return;
      const rootIds = canvas.getEffectiveRootIds(canvas.selectedShapeIds);
      if (rootIds.length === 0) return;

      const idMap = new Map();
      const newIds = new Set();
      const makeId = () => {
        let nid;
        do {
          nid = "shape_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7);
        } while (canvas.shapes.some(x => x.id === nid) || newIds.has(nid));
        newIds.add(nid);
        return nid;
      };

      const itemById = new Map();
      startMoveItems.forEach(it => itemById.set(it.shape.id, it));

      const clonedItems = [];
      const rootSet = new Set(rootIds);
      const sourceInOrder = canvas.shapes.filter(s => itemById.has(s.id));
      sourceInOrder.forEach(orig => {
        idMap.set(orig.id, makeId());
      });

      const nextSelectedRoots = [];
      sourceInOrder.forEach(orig => {
        const cloned = JSON.parse(JSON.stringify(orig));
        const origPos = itemById.get(orig.id);
        cloned.id = idMap.get(orig.id);
        if (rootSet.has(orig.id)) {
          cloned.parentId = orig.parentId || null;
          nextSelectedRoots.push(cloned.id);
        } else {
          cloned.parentId = idMap.get(orig.parentId) || orig.parentId || null;
        }
        if (origPos) {
          cloned.x = origPos.x;
          cloned.y = origPos.y;
          // 元アイテムをドラッグ前の初期位置に戻す
          orig.x = origPos.x;
          orig.y = origPos.y;
        }
        canvas.shapes.push(cloned);
        clonedItems.push({ shape: cloned, x: cloned.x, y: cloned.y });
      });

      if (dragTarget && idMap.has(dragTarget.id)) {
        dragTarget = canvas.getShapeById(idMap.get(dragTarget.id)) || dragTarget;
      }
      startMoveItems = clonedItems;
      canvas.selectedShapeIds = new Set(nextSelectedRoots);
      canvas.normalizeHierarchy();
      canvas.onSelectionChange && canvas.onSelectionChange();
    }

    el.addEventListener("mousedown", (e) => {
      if (e.button !== 0) return;
      const pos = getCanvasCoords(e);
      startMouse = { ...pos };
      canvas.dropTargetFrameId = null;
      canvas.dropInsertionIndicator = null;
      canvas.marqueeRect = null;
      startResizeSnapshot = null;
      altDuplicated = false;

      if (canvas.mode === "create_frame") {
        isDragging = true;
        dragType = "create_frame";
        dragTarget = null;
        canvas.frameDraftRect = { x: pos.x, y: pos.y, width: 0, height: 0 };
        canvas.render();
        return;
      }

      if (canvas.mode === "edit_points") {
        const s = canvas.selectedShapeIds.size === 1 ? canvas.getSelectedShape() : null;
        if (s && s.points && !canvas.isEffectivelyLocked(s)) {
          const hit = hitTestEditPoints(pos, s);
          if (hit) {
            isDragging = true;
            dragType = hit.type;
            dragTarget = s;
            canvas.activePointIndex = hit.pointIndex;
            canvas.activeHandleType = hit.handleType;
            activeHandleId = hit.handleName;
            canvas.render();
            syncPropertyPanel();
            return;
          }
        }
      }

      const selected = (canvas.selectedShapeIds.size === 1) ? canvas.getSelectedShape() : null;
      if (selected && canvas.mode === "select" && !canvas.isEffectivelyLocked(selected)) {
        const spacingGuide = findSpacingGuideAt(pos);
        if (spacingGuide) {
          isDragging = true;
          dragType = "spacing";
          dragTarget = selected;
          canvas.activeSpacingDrag = { ...spacingGuide, startValue: spacingGuide.value };
          canvas.render();
          return;
        }

        const inv = 1 / Math.max(0.2, canvas.zoom || 1);
        const rotPos = canvas.unrotatePointAroundShapeCenter(pos.x, pos.y, selected);
        const rotH = canvas.getRotationHandle(selected);
        if (Math.hypot(rotPos.x - rotH.x, rotPos.y - rotH.y) <= 10 * inv) {
          isDragging = true;
          dragType = "rotate";
          dragTarget = selected;
          startShapeState = { rotation: selected.rotation || 0 };
          return;
        }

        const adjHandles = canvas.getAdjustmentHandles(selected);
        for (const h of adjHandles) {
          const wp = canvas.shapeLocalToWorld(h.x - selected.x, h.y - selected.y, selected);
          if (Math.hypot(pos.x - wp.x, pos.y - wp.y) <= 10 * inv) {
            isDragging = true;
            dragType = "adj";
            dragTarget = selected;
            activeHandleId = h.adjId;
            return;
          }
        }

        const resizeHandles = canvas.getResizeHandles(selected);
        for (const h of resizeHandles) {
          if (Math.hypot(rotPos.x - h.x, rotPos.y - h.y) <= 8 * inv) {
            isDragging = true;
            dragType = "resize";
            dragTarget = selected;
            activeHandleId = h.id;
            startShapeState = {
              x: selected.x, y: selected.y,
              width: selected.width, height: selected.height
            };
            startResizeSnapshot = (selected.type === "frame") ? canvas.captureFrameResizeState(selected) : null;
            return;
          }
        }
      }

      const hitShape = canvas.hitTest(pos.x, pos.y, { direct: e.ctrlKey || e.metaKey });
      if (hitShape) {
        if (e.shiftKey) {
          canvas.selectShape(hitShape.id, true);
        } else if (!canvas.selectedShapeIds.has(hitShape.id)) {
          canvas.selectShape(hitShape.id, false);
        }
        if (!canvas.selectedShapeIds.has(hitShape.id)) return;
        if (canvas.isEffectivelyLocked(hitShape)) return;

        isDragging = true;
        dragType = "move";
        dragTarget = hitShape;
        startShapeState = { x: hitShape.x, y: hitShape.y };

        const rootIds = canvas.getEffectiveRootIds(canvas.selectedShapeIds);
        const moveSet = new Set();
        rootIds.forEach(rid => {
          const r = canvas.getShapeById(rid);
          if (!r || canvas.isEffectivelyLocked(r)) return;
          moveSet.add(r.id);
          canvas.getDescendants(r.id).forEach(d => moveSet.add(d.id));
        });
        startMoveItems = Array.from(moveSet).map(id => {
          const obj = canvas.getShapeById(id);
          return { shape: obj, x: obj.x, y: obj.y };
        });
      } else {
        if (!e.shiftKey) canvas.deselectAll();
        isDragging = true;
        dragType = "marquee";
        dragTarget = null;
        canvas.marqueeRect = { x: pos.x, y: pos.y, width: 0, height: 0 };
      }
    });

    window.addEventListener("mousemove", (e) => {
      const pos = getCanvasCoords(e);

      if (!isDragging) {
        const hoverGuide = (canvas.mode === "select") ? findSpacingGuideAt(pos) : null;
        const prev = canvas.activeSpacingHover;
        const changed = (!!prev !== !!hoverGuide) || (prev && hoverGuide && (prev.frameId !== hoverGuide.frameId || prev.kind !== hoverGuide.kind || prev.index !== hoverGuide.index));
        canvas.activeSpacingHover = hoverGuide;
        if (changed) canvas.render();
        updateCursor(pos, hoverGuide);
        return;
      }

      const dx = pos.x - startMouse.x;
      const dy = pos.y - startMouse.y;

      if (dragType === "create_frame") {
        canvas.frameDraftRect = {
          x: Math.min(startMouse.x, pos.x),
          y: Math.min(startMouse.y, pos.y),
          width: Math.abs(pos.x - startMouse.x),
          height: Math.abs(pos.y - startMouse.y)
        };
        canvas.render();
        return;
      }

      if (dragType === "spacing" && dragTarget && canvas.activeSpacingDrag) {
        const d = canvas.activeSpacingDrag;
        const delta = (d.axis === "x" ? dx : dy) * d.dirSign;
        const rawVal = Math.round(d.startValue + delta);
        const al = dragTarget.autoLayout || canvas.createDefaultAutoLayoutConfig();
        dragTarget.autoLayout = al;
        if (d.kind === "gap") {
          al.gap = rawVal;
          al.gapMode = "fixed";
          d.value = rawVal;
        } else {
          const clamped = Math.max(0, rawVal);
          if (d.kind === "padT") al.paddingTop = clamped;
          else if (d.kind === "padB") al.paddingBottom = clamped;
          else if (d.kind === "padL") al.paddingLeft = clamped;
          else if (d.kind === "padR") al.paddingRight = clamped;
          d.value = clamped;
        }
        canvas.applyAutoLayout(dragTarget.id);
        canvas.render();
        syncPropertyPanel();
        return;
      }

      if (dragType === "move" && dragTarget) {
        if (e.altKey && !altDuplicated && Math.hypot(dx, dy) > 2) {
          cloneRootsForAltDrag();
          altDuplicated = true;
        }

        let appliedDx = dx;
        let appliedDy = dy;
        const excludeIds = new Set(startMoveItems ? startMoveItems.map(it => it.shape.id) : [dragTarget.id]);
        if (canvas.snapToGrid) {
          const snappedX = Math.round((startShapeState.x + dx) / canvas.gridSize) * canvas.gridSize;
          const snappedY = Math.round((startShapeState.y + dy) / canvas.gridSize) * canvas.gridSize;
          appliedDx = snappedX - startShapeState.x;
          appliedDy = snappedY - startShapeState.y;
          canvas.smartGuides = [];
        } else if (!e.ctrlKey && !e.metaKey) {
          const guideRes = canvas.computeSmartGuides({
            x: startShapeState.x + appliedDx,
            y: startShapeState.y + appliedDy,
            width: dragTarget.width,
            height: dragTarget.height
          }, excludeIds);
          appliedDx += guideRes.snapDx;
          appliedDy += guideRes.snapDy;
          canvas.smartGuides = guideRes.guides;
        } else {
          canvas.smartGuides = [];
        }
        if (startMoveItems) {
          startMoveItems.forEach(item => {
            item.shape.x = Math.round(item.x + appliedDx);
            item.shape.y = Math.round(item.y + appliedDy);
          });
        }

        if (Math.hypot(dx, dy) > 3) {
          const cx = dragTarget.x + dragTarget.width / 2;
          const cy = dragTarget.y + dragTarget.height / 2;
          let targetFrame = canvas.findDropTargetFrame(cx, cy, excludeIds);
          const rootIds = canvas.getEffectiveRootIds(canvas.selectedShapeIds);
          const hasFlowItem = rootIds.some(rid => {
            const rs = canvas.getShapeById(rid);
            return rs && rs.layoutPositioning !== "absolute";
          });

          if (!targetFrame && hasFlowItem && dragTarget.parentId) {
            const p = canvas.getShapeById(dragTarget.parentId);
            if (p && p.type === "frame" && p.autoLayout && p.autoLayout.enabled) {
              const margin = 16;
              if (pos.x >= p.x - margin && pos.x <= p.x + p.width + margin && pos.y >= p.y - margin && pos.y <= p.y + p.height + margin) {
                targetFrame = p;
              }
            }
          }

          const allSameParent = targetFrame && rootIds.every(rid => {
            const rs = canvas.getShapeById(rid);
            return rs && rs.parentId === targetFrame.id;
          });
          canvas.dropTargetFrameId = (targetFrame && !allSameParent) ? targetFrame.id : null;

          if (targetFrame && targetFrame.autoLayout && targetFrame.autoLayout.enabled && hasFlowItem) {
            canvas.dropInsertionIndicator = canvas.computeAutoLayoutInsertion(targetFrame.id, pos.x, pos.y, excludeIds);
          } else {
            canvas.dropInsertionIndicator = null;
          }
        }

        canvas.render();
        syncPropertyPanel();
      } else if (dragType === "marquee") {
        const mx = Math.min(startMouse.x, pos.x);
        const my = Math.min(startMouse.y, pos.y);
        const mw = Math.abs(pos.x - startMouse.x);
        const mh = Math.abs(pos.y - startMouse.y);
        canvas.marqueeRect = { x: mx, y: my, width: mw, height: mh };
        canvas.render();
      } else if (dragType === "resize" && dragTarget) {
        handleResize(dragTarget, activeHandleId, dx, dy, startShapeState, e.shiftKey);
        if (startResizeSnapshot) {
          canvas.applyConstraintsFromSnapshot(startResizeSnapshot, e.ctrlKey || e.metaKey);
        }
        if (dragTarget.type === "frame" && dragTarget.autoLayout && dragTarget.autoLayout.enabled) {
          if (activeHandleId.includes("e") || activeHandleId.includes("w")) {
            dragTarget.autoLayout.sizingH = "fixed";
          }
          if (activeHandleId.includes("n") || activeHandleId.includes("s")) {
            dragTarget.autoLayout.sizingV = "fixed";
          }
          canvas.applyAutoLayout(dragTarget.id);
        } else {
          canvas.propagateAutoLayoutFrom(dragTarget);
        }
        canvas.render();
        syncPropertyPanel();
      } else if (dragType === "rotate" && dragTarget) {
        const cx = dragTarget.x + dragTarget.width / 2;
        const cy = dragTarget.y + dragTarget.height / 2;
        let angle = Math.atan2(pos.y - cy, pos.x - cx) * 180 / Math.PI + 90;
        if (angle < 0) angle += 360;
        if (e.shiftKey) {
          angle = Math.round(angle / 15) * 15;
        }
        dragTarget.rotation = Math.round(angle);
        canvas.render();
        syncPropertyPanel();
      } else if (dragType === "adj" && dragTarget) {
        const local = canvas.worldToShapeLocal(pos.x, pos.y, dragTarget);
        const def = ShapeDefinitions.getDefinition(dragTarget.type);
        if (def && def.setAdjustmentFromPoint) {
          def.setAdjustmentFromPoint(dragTarget.width, dragTarget.height, dragTarget.adjustments, activeHandleId, local.x, local.y);
          canvas.render();
        }
      } else if (dragType === "point_anchor" && dragTarget) {
        const local = canvas.worldToShapeLocal(pos.x, pos.y, dragTarget);
        const pt = dragTarget.points[canvas.activePointIndex];
        if (pt) {
          EditPointsManager.moveAnchorPoint(pt, local.x, local.y);
          canvas.render();
        }
      } else if (dragType === "point_handle" && dragTarget) {
        const local = canvas.worldToShapeLocal(pos.x, pos.y, dragTarget);
        const pt = dragTarget.points[canvas.activePointIndex];
        if (pt) {
          EditPointsManager.updateHandle(pt, activeHandleId, local.x, local.y);
          canvas.render();
        }
      }
    });

    window.addEventListener("mouseup", (e) => {
      if (!isDragging) return;
      isDragging = false;
      const curType = dragType;
      const curTarget = dragTarget;
      const didAltDup = altDuplicated;
      const pos = getCanvasCoords(e);
      const movedDist = Math.hypot(pos.x - startMouse.x, pos.y - startMouse.y);

      dragType = null;
      dragTarget = null;
      startMoveItems = null;
      startResizeSnapshot = null;
      altDuplicated = false;
      canvas.smartGuides = [];

      if (curType === "create_frame") {
        const r = canvas.frameDraftRect;
        canvas.frameDraftRect = null;
        if (!r || (r.width < 8 && r.height < 8)) {
          canvas.addFrame({ x: Math.round(pos.x), y: Math.round(pos.y), width: 320, height: 220 });
        } else {
          canvas.addFrame({
            x: Math.round(r.x),
            y: Math.round(r.y),
            width: Math.max(20, Math.round(r.width)),
            height: Math.max(20, Math.round(r.height))
          });
        }
        canvas.setMode("select");
        renderLayersPanel();
        return;
      }

      if (curType === "spacing") {
        canvas.activeSpacingDrag = null;
        canvas.saveState();
        canvas.render();
        syncPropertyPanel();
        renderLayersPanel();
        return;
      }

      if (curType === "marquee") {
        const m = canvas.marqueeRect;
        canvas.marqueeRect = null;
        if (m && (m.width > 4 || m.height > 4)) {
          const hits = [];
          canvas.shapes.forEach(s => {
            if (!canvas.isEffectivelyVisible(s) || canvas.isEffectivelyLocked(s)) return;
            const intersects = (s.x < m.x + m.width && s.x + s.width > m.x && s.y < m.y + m.height && s.y + s.height > m.y);
            if (!intersects) return;
            if (s.type === "frame") {
              const contains = (s.x >= m.x && s.y >= m.y && s.x + s.width <= m.x + m.width && s.y + s.height <= m.y + m.height);
              const hasKids = canvas.getChildren(s.id).length > 0;
              if (contains || !hasKids) hits.push(s.id);
            } else {
              hits.push(s.id);
            }
          });
          const hitSet = new Set(hits);
          const cleanRoots = canvas.getEffectiveRootIds(hitSet);
          if (!e.shiftKey) canvas.selectedShapeIds.clear();
          cleanRoots.forEach(id => canvas.selectedShapeIds.add(id));
          canvas.onSelectionChange && canvas.onSelectionChange();
        }
        canvas.render();
        syncPropertyPanel();
        renderLayersPanel();
        return;
      }

      if (curType === "move" && curTarget) {
        const dropTargetId = canvas.dropTargetFrameId;
        const dropInd = canvas.dropInsertionIndicator;
        canvas.dropTargetFrameId = null;
        canvas.dropInsertionIndicator = null;

        if (movedDist > 3 || didAltDup) {
          const rootIds = canvas.getEffectiveRootIds(canvas.selectedShapeIds);
          const affectedParents = new Set();
          rootIds.forEach(rid => {
            const rs = canvas.getShapeById(rid);
            if (rs && rs.parentId) affectedParents.add(rs.parentId);
          });

          const hasFlowItem = rootIds.some(rid => {
            const rs = canvas.getShapeById(rid);
            return rs && rs.layoutPositioning !== "absolute";
          });
          const sameDropParent = dropInd && rootIds.every(rid => {
            const rs = canvas.getShapeById(rid);
            return rs && rs.parentId === dropInd.frameId;
          });

          if (dropInd && (!sameDropParent || hasFlowItem)) {
            canvas.insertShapesIntoFrame(rootIds, dropInd.frameId, dropInd.index);
            affectedParents.add(dropInd.frameId);
          } else if (dropTargetId) {
            rootIds.forEach(rid => {
              const rs = canvas.getShapeById(rid);
              if (!rs || rs.id === dropTargetId || canvas.isDescendant(dropTargetId, rs.id)) return;
              rs.parentId = dropTargetId;
            });
            affectedParents.add(dropTargetId);
          } else {
            rootIds.forEach(rid => {
              const rs = canvas.getShapeById(rid);
              if (!rs || !rs.parentId) return;
              const p = canvas.getShapeById(rs.parentId);
              if (!p) return;
              const cx = rs.x + rs.width / 2;
              const cy = rs.y + rs.height / 2;
              const margin = 12;
              const outside = (cx < p.x - margin || cx > p.x + p.width + margin || cy < p.y - margin || cy > p.y + p.height + margin);
              if (outside) {
                affectedParents.add(rs.parentId);
                rs.parentId = p.parentId || null;
              }
            });
          }

          canvas.normalizeHierarchy();
          affectedParents.forEach(pid => canvas.applyAutoLayout(pid));
          canvas.saveState();
        }
        canvas.render();
        syncPropertyPanel();
        renderLayersPanel();
        return;
      }

      const resizedMath = (curType === "resize" && curTarget && curTarget.type === "math_plot" && (!curTarget.mathConfig || curTarget.mathConfig.equalAspect !== false)) ? curTarget : null;
      if (resizedMath) {
        syncEqualAspectBounds(resizedMath, "x");
        evaluateMathShape(resizedMath);
      } else {
        canvas.saveState();
        canvas.render();
      }
      renderLayersPanel();
    });

    let activeCanvasRenameCleanup = null;
    function startCanvasFrameRename(frame) {
      if (activeCanvasRenameCleanup) {
        activeCanvasRenameCleanup(true);
      }
      const wrapper = el.parentElement;
      const rect = canvas.getFrameLabelRect(frame);
      if (!wrapper || !rect) return;

      const input = document.createElement("input");
      input.type = "text";
      input.className = "canvas-frame-rename-input";
      input.value = frame.name || rect.label;
      input.style.left = `${Math.max(0, Math.round(rect.x * canvas.zoom))}px`;
      input.style.top = `${Math.max(0, Math.round(rect.y * canvas.zoom))}px`;
      input.style.width = `${Math.max(100, Math.round(rect.width * canvas.zoom))}px`;
      wrapper.appendChild(input);
      input.focus();
      input.select();

      let finished = false;
      const finish = (commit) => {
        if (finished) return;
        finished = true;
        if (activeCanvasRenameCleanup === finish) activeCanvasRenameCleanup = null;
        if (input.parentElement) input.parentElement.removeChild(input);
        if (commit) {
          canvas.renameShape(frame.id, input.value);
        }
      };
      activeCanvasRenameCleanup = finish;

      input.addEventListener("mousedown", (ev) => ev.stopPropagation());
      input.addEventListener("dblclick", (ev) => ev.stopPropagation());
      input.addEventListener("keydown", (ev) => {
        ev.stopPropagation();
        if (ev.key === "Enter") {
          ev.preventDefault();
          finish(true);
        } else if (ev.key === "Escape") {
          ev.preventDefault();
          finish(false);
        }
      });
      input.addEventListener("blur", () => finish(true));
    }

    function startCanvasTextEdit(shape) {
      if (activeCanvasRenameCleanup) {
        activeCanvasRenameCleanup(true);
      }
      const wrapper = el.parentElement;
      if (!wrapper || !shape || shape.type !== "text") return;

      const ta = document.createElement("textarea");
      ta.className = "canvas-text-inline-editor";
      ta.value = shape.text || "";
      ta.style.position = "absolute";
      ta.style.left = `${Math.max(0, Math.round(shape.x * canvas.zoom))}px`;
      ta.style.top = `${Math.max(0, Math.round(shape.y * canvas.zoom))}px`;
      ta.style.width = `${Math.max(60, Math.round(shape.width * canvas.zoom))}px`;
      ta.style.height = `${Math.max(28, Math.round(shape.height * canvas.zoom))}px`;
      ta.style.fontSize = `${Math.max(11, Math.round((shape.fontSize || 28) * canvas.zoom))}px`;
      ta.style.fontFamily = shape.fontFamily || "sans-serif";
      ta.style.fontWeight = shape.fontWeight || "normal";
      ta.style.fontStyle = shape.fontStyle || "normal";
      ta.style.textAlign = shape.textAlign || "center";
      ta.style.color = shape.fill || "#1e293b";
      ta.style.background = "rgba(255, 255, 255, 0.96)";
      ta.style.border = "1.5px solid #2563eb";
      ta.style.borderRadius = "4px";
      ta.style.padding = "4px";
      ta.style.boxSizing = "border-box";
      ta.style.resize = "none";
      ta.style.zIndex = "30";
      ta.style.outline = "none";
      wrapper.appendChild(ta);
      ta.focus();
      ta.select();

      let finished = false;
      const finish = (commit) => {
        if (finished) return;
        finished = true;
        if (activeCanvasRenameCleanup === finish) activeCanvasRenameCleanup = null;
        if (ta.parentElement) ta.parentElement.removeChild(ta);
        if (commit && shape.text !== ta.value) {
          shape.text = ta.value;
          canvas.saveState();
          canvas.render();
          syncPropertyPanel();
        }
      };
      activeCanvasRenameCleanup = finish;

      ta.addEventListener("mousedown", (ev) => ev.stopPropagation());
      ta.addEventListener("dblclick", (ev) => ev.stopPropagation());
      ta.addEventListener("keydown", (ev) => {
        ev.stopPropagation();
        if ((ev.ctrlKey || ev.metaKey) && ev.key === "Enter") {
          ev.preventDefault();
          finish(true);
        } else if (ev.key === "Escape") {
          ev.preventDefault();
          finish(false);
        }
      });
      ta.addEventListener("blur", () => finish(true));
    }

    el.addEventListener("dblclick", (e) => {
      const pos = getCanvasCoords(e);
      const labelFrame = canvas.hitTestFrameLabel(pos.x, pos.y);
      if (labelFrame) {
        canvas.selectShape(labelFrame.id);
        startCanvasFrameRename(labelFrame);
        return;
      }
      if (canvas.enterContainerSelected(pos)) {
        return;
      }
      const hitShape = canvas.hitTestDirect(pos.x, pos.y);
      if (hitShape && !canvas.isEffectivelyLocked(hitShape)) {
        if (hitShape.type === "text") {
          canvas.selectShape(hitShape.id);
          startCanvasTextEdit(hitShape);
        } else if (hitShape.type !== "math_plot" && hitShape.type !== "frame") {
          canvas.selectShape(hitShape.id);
          canvas.enterEditPointsMode();
        }
      }
    });

    function hitTestEditPoints(pos, s) {
      const inv = 1 / Math.max(0.2, canvas.zoom || 1);
      const local = canvas.worldToShapeLocal(pos.x, pos.y, s);

      if (canvas.activePointIndex !== null && s.points[canvas.activePointIndex]) {
        const p = s.points[canvas.activePointIndex];
        if (p.hIn && Math.hypot(local.x - p.hIn.x, local.y - p.hIn.y) <= 8 * inv) {
          return { type: "point_handle", pointIndex: canvas.activePointIndex, handleType: "hIn", handleName: "hIn" };
        }
        if (p.hOut && Math.hypot(local.x - p.hOut.x, local.y - p.hOut.y) <= 8 * inv) {
          return { type: "point_handle", pointIndex: canvas.activePointIndex, handleType: "hOut", handleName: "hOut" };
        }
      }

      for (let i = 0; i < s.points.length; i++) {
        const p = s.points[i];
        if (Math.hypot(local.x - p.x, local.y - p.y) <= 8 * inv) {
          return { type: "point_anchor", pointIndex: i, handleType: "anchor" };
        }
      }

      return null;
    }

    function handleResize(s, handleId, dx, dy, st, shiftPreserveAspect) {
      let x = st.x, y = st.y, w = st.width, h = st.height;
      const initialAspect = st.width / st.height;

      if (handleId.includes("e")) w = Math.max(10, st.width + dx);
      if (handleId.includes("s")) h = Math.max(10, st.height + dy);
      if (handleId.includes("w")) {
        const nw = Math.max(10, st.width - dx);
        x = st.x + (st.width - nw);
        w = nw;
      }
      if (handleId.includes("n")) {
        const nh = Math.max(10, st.height - dy);
        y = st.y + (st.height - nh);
        h = nh;
      }

      if (shiftPreserveAspect && (handleId.length === 2)) {
        if (w / initialAspect > h) {
          h = w / initialAspect;
        } else {
          w = h * initialAspect;
        }
      }

      s.x = Math.round(x);
      s.y = Math.round(y);
      s.width = Math.round(w);
      s.height = Math.round(h);
    }

    function updateCursor(pos, hoverGuide) {
      if (canvas.mode === "edit_points" || canvas.mode === "create_frame") {
        el.style.cursor = "crosshair";
        return;
      }
      if (hoverGuide) {
        el.style.cursor = hoverGuide.axis === "x" ? "ew-resize" : "ns-resize";
        return;
      }
      const s = (canvas.selectedShapeIds.size === 1) ? canvas.getSelectedShape() : null;
      if (!s || canvas.isEffectivelyLocked(s)) {
        const hit = canvas.hitTest(pos.x, pos.y);
        el.style.cursor = hit ? "move" : "default";
        return;
      }

      const inv = 1 / Math.max(0.2, canvas.zoom || 1);
      const rotPos = canvas.unrotatePointAroundShapeCenter(pos.x, pos.y, s);
      const rotH = canvas.getRotationHandle(s);
      if (Math.hypot(rotPos.x - rotH.x, rotPos.y - rotH.y) <= 10 * inv) {
        el.style.cursor = "grab";
        return;
      }

      const adjHandles = canvas.getAdjustmentHandles(s);
      for (const h of adjHandles) {
        const wp = canvas.shapeLocalToWorld(h.x - s.x, h.y - s.y, s);
        if (Math.hypot(pos.x - wp.x, pos.y - wp.y) <= 10 * inv) {
          el.style.cursor = "pointer";
          return;
        }
      }

      const resizeHandles = canvas.getResizeHandles(s);
      for (const h of resizeHandles) {
        if (Math.hypot(rotPos.x - h.x, rotPos.y - h.y) <= 8 * inv) {
          el.style.cursor = h.cursor;
          return;
        }
      }

      const hit = canvas.hitTest(pos.x, pos.y);
      el.style.cursor = hit ? "move" : "default";
    }
  }

  function setupKeyboardShortcuts(canvas) {
    window.addEventListener("keydown", (e) => {
      if (["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName) || document.activeElement.isContentEditable) {
        return;
      }

      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        canvas.deleteSelected();
      } else if (e.ctrlKey && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) canvas.redo();
        else canvas.undo();
      } else if (e.ctrlKey && e.key.toLowerCase() === "y") {
        e.preventDefault();
        canvas.redo();
      } else if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === "c") {
        const selText = window.getSelection ? String(window.getSelection()) : "";
        if (!selText && canvas.selectedShapeIds.size > 0) {
          e.preventDefault();
          canvas.copySelected();
        }
      } else if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === "x") {
        const selText = window.getSelection ? String(window.getSelection()) : "";
        if (!selText && canvas.selectedShapeIds.size > 0) {
          e.preventDefault();
          if (canvas.cutSelected()) {
            syncPropertyPanel();
          }
        }
      } else if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === "v") {
        if (canvas.hasClipboard()) {
          e.preventDefault();
          canvas.pasteClipboard();
          syncPropertyPanel();
        }
      } else if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === "a") {
        e.preventDefault();
        canvas.selectAll();
      } else if (e.ctrlKey && e.key.toLowerCase() === "d") {
        e.preventDefault();
        canvas.duplicateSelected();
      } else if (e.shiftKey && !e.ctrlKey && !e.altKey && e.key.toLowerCase() === "a") {
        e.preventDefault();
        canvas.toggleAutoLayoutSelected();
      } else if (e.ctrlKey && e.altKey && e.key.toLowerCase() === "g") {
        e.preventDefault();
        canvas.frameSelected(false);
      } else if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "g") {
        e.preventDefault();
        canvas.unframeSelected();
      } else if (!e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey && e.key.toLowerCase() === "f") {
        e.preventDefault();
        canvas.setMode(canvas.mode === "create_frame" ? "select" : "create_frame");
      } else if (e.key === "Enter" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (canvas.selectedShapeIds.size > 0) {
          e.preventDefault();
          if (e.shiftKey) canvas.selectParentFrame();
          else canvas.enterContainerSelected();
        }
      } else if (e.key === "Escape") {
        if (canvas.mode === "create_frame") {
          canvas.setMode("select");
        } else if (canvas.mode === "edit_points") {
          canvas.exitEditPointsMode();
        } else {
          canvas.deselectAll();
        }
      } else if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        const rootIds = canvas.getEffectiveRootIds(canvas.selectedShapeIds);
        if (rootIds.length === 0) return;
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        let dx = 0, dy = 0;
        if (e.key === "ArrowUp") dy = -step;
        if (e.key === "ArrowDown") dy = step;
        if (e.key === "ArrowLeft") dx = -step;
        if (e.key === "ArrowRight") dx = step;
        const visited = new Set();
        let moved = false;
        rootIds.forEach(rid => {
          const rs = canvas.getShapeById(rid);
          if (rs && !canvas.isEffectivelyLocked(rs)) {
            canvas.moveShapeWithDescendants(rs, dx, dy, visited);
            moved = true;
          }
        });
        if (moved) {
          canvas.saveState();
          canvas.render();
          syncPropertyPanel();
        }
      }
    });
  }

  // --- コンテキストメニュー (PowerPoint互換) ---
  function setupContextMenu(canvas, el) {
    el.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const pos = {
        x: (e.clientX - rect.left) / canvas.zoom,
        y: (e.clientY - rect.top) / canvas.zoom
      };

      const hitShape = canvas.hitTest(pos.x, pos.y, { direct: e.ctrlKey || e.metaKey });
      if (hitShape) {
        if (!canvas.selectedShapeIds.has(hitShape.id)) {
          canvas.selectShape(hitShape.id);
        }
        showShapeContextMenu(e.clientX, e.clientY, hitShape);
      } else {
        showCanvasContextMenu(e.clientX, e.clientY, pos);
      }
    });

    document.addEventListener("click", (e) => {
      if (!contextMenu.contains(e.target)) {
        hideContextMenu();
      }
    });

    window.addEventListener("scroll", hideContextMenu, true);
  }

  function hideContextMenu() {
    contextMenu.style.display = "none";
  }

  function renderContextMenuItems(clientX, clientY, items) {
    contextMenu.innerHTML = "";
    items.forEach(item => {
      if (item.divider) {
        const div = document.createElement("div");
        div.className = "context-menu-divider";
        contextMenu.appendChild(div);
      } else {
        const row = document.createElement("div");
        row.className = `context-menu-item${item.danger ? " danger" : ""}${item.disabled ? " disabled" : ""}`;
        row.innerHTML = `
          <span>${item.label}</span>
          ${item.shortcut ? `<span class="context-menu-shortcut">${item.shortcut}</span>` : ""}
        `;
        row.addEventListener("click", (e) => {
          e.stopPropagation();
          if (item.disabled) return;
          hideContextMenu();
          item.action();
        });
        contextMenu.appendChild(row);
      }
    });

    contextMenu.style.display = "block";
    const menuWidth = contextMenu.offsetWidth || 180;
    const menuHeight = contextMenu.offsetHeight || 220;
    let posX = clientX;
    let posY = clientY;
    if (posX + menuWidth > window.innerWidth) posX = window.innerWidth - menuWidth - 8;
    if (posY + menuHeight > window.innerHeight) posY = window.innerHeight - menuHeight - 8;
    contextMenu.style.left = `${posX}px`;
    contextMenu.style.top = `${posY}px`;
  }

  function showCanvasContextMenu(clientX, clientY, pos = { x: 100, y: 100 }) {
    const tr = (k, fb) => (window.I18N ? I18N.t(k) : fb);
    const hasVisible = canvas.shapes.some(s => canvas.isEffectivelyVisible(s));
    const px = Math.max(0, Math.round(pos.x));
    const py = Math.max(0, Math.round(pos.y));

    renderContextMenuItems(clientX, clientY, [
      {
        label: tr("ctx.paste", "貼り付け"),
        shortcut: "Ctrl+V",
        disabled: !canvas.hasClipboard(),
        action: () => {
          canvas.pasteClipboard();
          syncPropertyPanel();
        }
      },
      { divider: true },
      {
        label: tr("ctx.newFrame", "新規フレーム"),
        shortcut: "F",
        action: () => {
          const fw = 280, fh = 180;
          const x = Math.min(px, Math.max(0, canvas.width - fw));
          const y = Math.min(py, Math.max(0, canvas.height - fh));
          const frame = canvas.addFrame({ x, y, width: fw, height: fh });
          canvas.selectShape(frame.id);
          syncPropertyPanel();
        }
      },
      {
        label: tr("ctx.addText", "テキストを追加"),
        action: () => {
          const s = canvas.addShape("text", { x: px, y: py });
          canvas.selectShape(s.id);
          syncPropertyPanel();
        }
      },
      {
        label: tr("ctx.addRect", "長方形を追加"),
        action: () => {
          const s = canvas.addShape("rect", { x: px, y: py });
          canvas.selectShape(s.id);
          syncPropertyPanel();
        }
      },
      { divider: true },
      {
        label: tr("ctx.selectAll", "すべて選択"),
        shortcut: "Ctrl+A",
        disabled: !hasVisible,
        action: () => canvas.selectAll()
      },
      {
        label: tr("ctx.toggleGrid", "グリッド表示切替"),
        action: () => {
          if (toggleGridBtn) toggleGridBtn.click();
        }
      },
      {
        label: tr("ctx.resetZoom", "ズームを100%に戻す"),
        disabled: Math.abs(canvas.zoom - 1.0) < 0.001,
        action: () => {
          canvas.setZoom(1.0);
          if (zoomLabel) zoomLabel.textContent = "100%";
        }
      },
      { divider: true },
      {
        label: tr("ctx.formatBg", "背景の書式設定"),
        action: () => {
          canvas.deselectAll();
          syncPropertyPanel();
          if (inputCanvasBg && canvas.backgroundColor !== "transparent") {
            inputCanvasBg.focus();
          }
        }
      }
    ]);
  }

  function showShapeContextMenu(clientX, clientY, shape) {
    const isText = (shape.type === "text");
    const isMath = (shape.type === "math_plot");
    const isSingle = (canvas.selectedShapeIds.size === 1);
    const isLocked = canvas.isEffectivelyLocked(shape);
    const anyEditable = canvas.getEditableSelectedShapes().length > 0;
    const tr = (k, fb) => (window.I18N ? I18N.t(k) : fb);

    const items = [];

    // 頂点の編集
    const isFrame = (shape.type === "frame");
    if (!isText && !isMath && !isFrame) {
      items.push({
        label: canvas.mode === "edit_points" ? tr("panel.endEditPoints", "頂点編集を終了") : tr("panel.editPoints", "頂点の編集"),
        disabled: (!isSingle || isLocked),
        action: () => {
          if (canvas.mode === "edit_points") canvas.exitEditPointsMode();
          else canvas.enterEditPointsMode();
        }
      });
      items.push({ divider: true });
    }

    // フレーム・オートレイアウト
    items.push({
      label: tr("ctx.frameSelected", "フレーム化"),
      shortcut: "Ctrl+Alt+G",
      disabled: !anyEditable,
      action: () => canvas.frameSelected(false)
    });
    if (isFrame) {
      items.push({
        label: tr("ctx.unframe", "フレーム解除"),
        shortcut: "Ctrl+Shift+G",
        disabled: !anyEditable,
        action: () => canvas.unframeSelected()
      });
    }
    items.push({
      label: tr("ctx.autoLayout", "オートレイアウト切替"),
      shortcut: "Shift+A",
      disabled: !anyEditable,
      action: () => canvas.toggleAutoLayoutSelected()
    });
    if (shape.parentId) {
      const parentObj = canvas.getShapeById(shape.parentId);
      if (parentObj && parentObj.autoLayout && parentObj.autoLayout.enabled) {
        items.push({
          label: tr("ctx.absolutePos", "絶対配置を切替"),
          disabled: isLocked,
          action: () => {
            if (canvas.isEffectivelyLocked(shape)) return;
            shape.layoutPositioning = (shape.layoutPositioning === "absolute") ? "auto" : "absolute";
            canvas.applyAutoLayout(parentObj.id);
            canvas.saveState();
            canvas.render();
            syncPropertyPanel();
          }
        });
      }
      items.push({
        label: tr("ctx.removeFromFrame", "フレームから出す"),
        disabled: !anyEditable,
        action: () => canvas.removeFromParent()
      });
    }
    items.push({
      label: tr("ctx.toggleVisible", "表示/非表示を切替"),
      action: () => canvas.setLayerVisible(shape.id, shape.visible === false)
    });
    items.push({
      label: tr("ctx.toggleLock", "ロック/解除を切替"),
      action: () => canvas.setLayerLocked(shape.id, !shape.locked)
    });
    items.push({ divider: true });

    // 重なり順 (PowerPoint準拠)
    items.push({
      label: tr("ctx.bringForward", "前面へ移動"),
      disabled: !anyEditable,
      action: () => canvas.bringForward()
    });
    items.push({
      label: tr("ctx.bringFront", "最前面へ移動"),
      disabled: !anyEditable,
      action: () => canvas.bringToFront()
    });
    items.push({
      label: tr("ctx.sendBackward", "背面へ移動"),
      disabled: !anyEditable,
      action: () => canvas.sendBackward()
    });
    items.push({
      label: tr("ctx.sendBack", "最背面へ移動"),
      disabled: !anyEditable,
      action: () => canvas.sendToBack()
    });

    items.push({ divider: true });

    // 反転
    items.push({
      label: tr("ctx.flipH", "左右反転"),
      disabled: !anyEditable,
      action: () => canvas.toggleFlipH()
    });
    items.push({
      label: tr("ctx.flipV", "上下反転"),
      disabled: !anyEditable,
      action: () => canvas.toggleFlipV()
    });

    items.push({ divider: true });

    // 切り取り・コピー・貼り付け・複製・削除
    items.push({
      label: tr("ctx.cut", "切り取り"),
      shortcut: "Ctrl+X",
      disabled: !anyEditable,
      action: () => {
        if (canvas.cutSelected()) {
          syncPropertyPanel();
        }
      }
    });
    items.push({
      label: tr("ctx.copy", "コピー"),
      shortcut: "Ctrl+C",
      action: () => canvas.copySelected()
    });
    items.push({
      label: tr("ctx.paste", "貼り付け"),
      shortcut: "Ctrl+V",
      disabled: !canvas.hasClipboard(),
      action: () => {
        canvas.pasteClipboard();
        syncPropertyPanel();
      }
    });
    items.push({
      label: tr("panel.duplicate", "複製"),
      shortcut: "Ctrl+D",
      disabled: !anyEditable,
      action: () => canvas.duplicateSelected()
    });
    items.push({
      label: tr("panel.delete", "削除"),
      shortcut: "Del",
      danger: true,
      disabled: !anyEditable,
      action: () => canvas.deleteSelected()
    });

    renderContextMenuItems(clientX, clientY, items);
  }

});
