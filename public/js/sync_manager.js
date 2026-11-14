// public/js/sync_manager.js
// ブラウザローカル永続化と将来的なサーバー同期エンジン

window.SyncManager = (function() {
  const STORAGE_PREFIX = "ppt_project_";
  const INDEX_KEY = "ppt_projects_index";
  const CURRENT_KEY = "ppt_current_project_id";

  // クライアント識別ID生成
  function getClientSyncId() {
    let id = localStorage.getItem("ppt_client_sync_id");
    if (!id) {
      id = "client_" + Date.now() + "_" + Math.random().toString(36).substring(2, 9);
      localStorage.setItem("ppt_client_sync_id", id);
    }
    return id;
  }

  class Manager {
    constructor(canvasInstance) {
      this.canvas = canvasInstance;
      this.clientSyncId = getClientSyncId();

      // 現在のプロジェクト情報
      this.currentProject = null;
      this.syncStatus = "offline"; // "synced" | "modified" | "syncing" | "offline" | "conflict"
      this.autoSyncTimer = null;
      this.serverOnline = false;

      // イベントリスナー
      this.onStatusChange = null;
      this.onProjectLoaded = null;

      // 初期化
      this.init();
    }

    async init() {
      // 1. ローカルから直近のプロジェクトを読み込むか新規作成
      this.loadInitialProject();

      // 2. サーバー生存確認と同期
      await this.checkServerStatus();

      // 3. 定期的なサーバー健全性チェックと同期(10秒周期)
      setInterval(() => {
        this.checkServerStatus();
      }, 10000);
    }

    // --- プロジェクト管理 ---
    createProjectData(title = null, id = null, docType = "slide") {
      const now = Date.now();
      const isAsset = (docType === "asset");
      const w = isAsset ? 400 : 960;
      const h = isAsset ? 400 : 540;
      const bg = isAsset ? "transparent" : "#ffffff";
      const defaultTitle = window.I18N ? window.I18N.t("doc.untitled") : "無題のドキュメント";

      return {
        id: id || "proj_" + now + "_" + Math.random().toString(36).substring(2, 7),
        title: title || defaultTitle,
        docType: docType,
        revision: 1,
        createdAt: now,
        updatedAt: now,
        clientSyncId: this.clientSyncId,
        width: w,
        height: h,
        backgroundColor: bg,
        shapes: []
      };
    }

    loadInitialProject() {
      const lastId = localStorage.getItem(CURRENT_KEY);
      if (lastId) {
        const loaded = this.loadLocalProject(lastId);
        if (loaded) {
          this.setCurrentProject(loaded);
          return;
        }
      }

      // 存在しなければ新規作成
      const newProj = this.createProjectData(window.I18N ? window.I18N.t("doc.newDoc") : "新規ドキュメント");
      this.saveLocalProject(newProj);
      this.setCurrentProject(newProj);
    }

    setCurrentProject(project) {
      this.currentProject = project;
      localStorage.setItem(CURRENT_KEY, project.id);

      // 過去バージョンのデフォルト青枠線(太さ2)を「枠線なし」に自動マイグレーション
      if (Array.isArray(project.shapes)) {
        project.shapes.forEach(s => {
          if (s.stroke === "#1d4ed8" && s.strokeWidth === 2) {
            s.stroke = "none";
            s.strokeWidth = 0;
          }
          if (s.strokeWidth === undefined || s.strokeWidth === null) {
            s.strokeWidth = 0;
            s.stroke = "none";
          }
        });
      }

      // キャンバスへ反映
      this.canvas.width = project.width || 960;
      this.canvas.height = project.height || 540;
      this.canvas.backgroundColor = project.backgroundColor || "#ffffff";
      this.canvas.docType = project.docType || (project.width === 400 && project.height === 400 ? "asset" : "slide");
      this.canvas.shapes = project.shapes || [];
      this.canvas.selectedShapeIds.clear();
      this.canvas.enteredContainerId = null;
      this.canvas.exitEditPointsMode();
      this.canvas.normalizeHierarchy();
      this.canvas.updateCanvasDimensions();
      this.canvas.saveState();

      this.setStatus("synced");
      this.onProjectLoaded && this.onProjectLoaded(this.currentProject);
    }

    // キャンバス編集時の通知
    notifyCanvasChanged() {
      if (!this.currentProject) return;

      this.currentProject.width = this.canvas.width;
      this.currentProject.height = this.canvas.height;
      this.currentProject.docType = this.canvas.docType || this.currentProject.docType || "slide";
      this.currentProject.backgroundColor = this.canvas.backgroundColor;
      this.currentProject.shapes = JSON.parse(JSON.stringify(this.canvas.shapes));
      this.currentProject.updatedAt = Date.now();

      // ローカル保存
      this.saveLocalProject(this.currentProject);
      this.setStatus("modified");

      // 変更後1.5秒で自動同期(デバウンス)
      clearTimeout(this.autoSyncTimer);
      this.autoSyncTimer = setTimeout(() => {
        this.syncCurrentProject();
      }, 1500);
    }

    setTitle(newTitle) {
      if (!this.currentProject) return;
      const fallback = window.I18N ? window.I18N.t("doc.untitledPres") : "無題のプレゼンテーション";
      this.currentProject.title = newTitle.trim() || fallback;
      this.notifyCanvasChanged();
    }

    // --- ローカルストレージ操作 ---
    getLocalIndex() {
      try {
        const str = localStorage.getItem(INDEX_KEY);
        return str ? JSON.parse(str) : [];
      } catch (e) {
        return [];
      }
    }

    saveLocalIndex(list) {
      localStorage.setItem(INDEX_KEY, JSON.stringify(list));
    }

    loadLocalProject(id) {
      try {
        const str = localStorage.getItem(STORAGE_PREFIX + id);
        return str ? JSON.parse(str) : null;
      } catch (e) {
        return null;
      }
    }

    saveLocalProject(project) {
      try {
        localStorage.setItem(STORAGE_PREFIX + project.id, JSON.stringify(project));

        // インデックス更新
        let index = this.getLocalIndex();
        const existing = index.find(it => it.id === project.id);
        if (existing) {
          existing.title = project.title;
          existing.updatedAt = project.updatedAt;
          existing.revision = project.revision;
        } else {
          index.push({
            id: project.id,
            title: project.title,
            updatedAt: project.updatedAt,
            revision: project.revision
          });
        }
        // 更新日時降順
        index.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
        this.saveLocalIndex(index);
      } catch (e) {
        console.warn("[SyncManager] LocalStorage save failed:", e);
      }
    }

    deleteLocalProject(id) {
      localStorage.removeItem(STORAGE_PREFIX + id);
      const index = this.getLocalIndex().filter(it => it.id !== id);
      this.saveLocalIndex(index);

      if (this.currentProject && this.currentProject.id === id) {
        if (index.length > 0) {
          const next = this.loadLocalProject(index[0].id);
          this.setCurrentProject(next);
        } else {
          const newProj = this.createProjectData(window.I18N ? window.I18N.t("doc.newDoc") : "新規ドキュメント");
          this.saveLocalProject(newProj);
          this.setCurrentProject(newProj);
        }
      }
    }

    // --- サーバー同期通信 ---
    async checkServerStatus() {
      try {
        const res = await fetch("/api/sync/status", { cache: "no-store" });
        if (res.ok) {
          this.serverOnline = true;
          if (this.syncStatus === "offline") {
            this.setStatus(this.currentProject ? "modified" : "synced");
            // サーバーと自動同期試行
            this.syncCurrentProject();
          }
          return true;
        }
      } catch (e) {
        // サーバー未接続
      }
      this.serverOnline = false;
      this.setStatus("offline");
      return false;
    }

    async syncCurrentProject() {
      if (!this.currentProject) return;
      if (!this.serverOnline) {
        this.setStatus("offline");
        return;
      }

      this.setStatus("syncing");

      try {
        const res = await fetch(`/api/sync/projects/${this.currentProject.id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clientSyncId: this.clientSyncId,
            project: this.currentProject
          })
        });

        if (res.status === 409) {
          // 競合発生
          const conflictData = await res.json();
          this.setStatus("conflict");
          this.handleConflict(conflictData);
          return;
        }

        if (res.ok) {
          const result = await res.json();
          this.currentProject.revision = result.revision;
          this.currentProject.updatedAt = result.updatedAt;
          this.saveLocalProject(this.currentProject);
          this.setStatus("synced");
        } else {
          this.setStatus("modified");
        }
      } catch (e) {
        console.warn("[SyncManager] Sync request failed:", e);
        this.serverOnline = false;
        this.setStatus("offline");
      }
    }

    // 競合発生時の解決処理
    handleConflict(conflictData) {
      const serverProj = conflictData.serverProject;
      const msg = window.I18N ? window.I18N.t("msg.syncConflict") : (
        "【同期競合の検出】\n" +
        "サーバー側で新しい変更が見つかりました。\n\n" +
        "・OK: サーバーの最新データを取り込みます\n" +
        "・キャンセル: 手元のデータを別名コピーとして保持します"
      );
      const confirmOverride = confirm(msg);

      if (confirmOverride && serverProj) {
        this.setCurrentProject(serverProj);
        this.saveLocalProject(serverProj);
        this.setStatus("synced");
      } else {
        // 手元データを別プロジェクトIDで分岐保存
        const branched = JSON.parse(JSON.stringify(this.currentProject));
        branched.id = "proj_" + Date.now() + "_fork";
        branched.title += window.I18N ? window.I18N.t("doc.localCopySuffix") : " (ローカル版コピー)";
        branched.revision = 1;
        this.saveLocalProject(branched);
        this.setCurrentProject(branched);
        this.syncCurrentProject();
      }
    }

    // サーバー上のプロジェクト一覧取得
    async fetchRemoteProjectList() {
      if (!this.serverOnline) return [];
      try {
        const res = await fetch("/api/sync/projects");
        if (res.ok) {
          const data = await res.json();
          return data.projects || [];
        }
      } catch (e) {
        console.warn("[SyncManager] Failed to fetch project list:", e);
      }
      return [];
    }

    // サーバーから特定プロジェクトを取得
    async fetchRemoteProject(id) {
      if (!this.serverOnline) return null;
      try {
        const res = await fetch(`/api/sync/projects/${id}`);
        if (res.ok) {
          const data = await res.json();
          return data.project || null;
        }
      } catch (e) {
        console.warn("[SyncManager] Failed to fetch project:", e);
      }
      return null;
    }

    // --- ファイルインポート・エクスポート(手動同期) ---
    exportCurrentProjectAsJson() {
      if (!this.currentProject) return;
      const dataStr = JSON.stringify(this.currentProject, null, 2);
      const blob = new Blob([dataStr], { type: "application/json" });
      const filename = `${this.currentProject.title.replace(/[/\\?%*:|"<>]/g, "_")}.json`;

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

    async importProjectFromJsonFile(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
          try {
            const data = JSON.parse(e.target.result);
            if (!data.shapes || !Array.isArray(data.shapes)) {
              throw new Error(window.I18N ? window.I18N.t("msg.invalidProjectFile") : "無効なプロジェクトファイルです");
            }
            // 新しいプロジェクトとして取り込み
            data.id = "proj_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7);
            const impDef = window.I18N ? window.I18N.t("doc.importedDefault") : "インポートされたドキュメント";
            const impSuf = window.I18N ? window.I18N.t("doc.importedSuffix") : "(インポート)";
            data.title = (data.title || impDef) + impSuf;
            data.updatedAt = Date.now();
            data.revision = 1;

            this.saveLocalProject(data);
            this.setCurrentProject(data);
            await this.syncCurrentProject();
            resolve(data);
          } catch (err) {
            const prefix = window.I18N ? window.I18N.t("msg.loadJsonFail") : "JSONの読み込みに失敗しました: ";
            alert(prefix + err.message);
            reject(err);
          }
        };
        reader.readAsText(file, "utf-8");
      });
    }

    setStatus(status) {
      this.syncStatus = status;
      this.onStatusChange && this.onStatusChange(status);
    }
  }

  return {
    Manager
  };
})();
