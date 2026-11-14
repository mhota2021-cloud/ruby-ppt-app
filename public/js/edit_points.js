// public/js/edit_points.js
// PowerPointの「頂点の編集 (Edit Points)」機能の実装

window.EditPointsManager = (function() {
  /*
    ポイントのデータ構造:
    {
      x: number,
      y: number,
      type: "corner" | "straight" | "smooth",
      hIn: { x: number, y: number } | null,   // ベジェ制御点（前）
      hOut: { x: number, y: number } | null   // ベジェ制御点（後）
    }
  */

  // 図形から編集可能ポイントリストを初期化・生成
  function initializePointsFromShape(shape) {
    if (shape.points && shape.points.length > 0) {
      // 既にポイント配列を持っていればクローン
      return JSON.parse(JSON.stringify(shape.points));
    }

    const def = ShapeDefinitions.getDefinition(shape.type);
    if (def && def.toPathPoints) {
      const pts = def.toPathPoints(shape.width, shape.height, shape.adjustments);
      return pts.map(p => ({
        x: p.x,
        y: p.y,
        type: p.type || "corner",
        hIn: p.hIn ? { ...p.hIn } : null,
        hOut: p.hOut ? { ...p.hOut } : null
      }));
    }

    // デフォルト四角形4頂点
    const w = shape.width, h = shape.height;
    return [
      { x: 0, y: 0, type: "corner", hIn: null, hOut: null },
      { x: w, y: 0, type: "corner", hIn: null, hOut: null },
      { x: w, y: h, type: "corner", hIn: null, hOut: null },
      { x: 0, y: h, type: "corner", hIn: null, hOut: null }
    ];
  }

  // ポイントリストからSVGパス文字列(d属性)を構築
  function pointsToSvgPath(points, closed = true) {
    if (!points || points.length === 0) return "";
    let d = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)} `;

    for (let i = 0; i < points.length; i++) {
      const curr = points[i];
      const nextIndex = (i + 1) % points.length;
      if (!closed && i === points.length - 1) break;
      const next = points[nextIndex];

      const cp1 = curr.hOut || { x: curr.x, y: curr.y };
      const cp2 = next.hIn || { x: next.x, y: next.y };

      const hasBezier = curr.hOut || next.hIn;
      if (hasBezier) {
        d += `C ${cp1.x.toFixed(2)} ${cp1.y.toFixed(2)}, ${cp2.x.toFixed(2)} ${cp2.y.toFixed(2)}, ${next.x.toFixed(2)} ${next.y.toFixed(2)} `;
      } else {
        d += `L ${next.x.toFixed(2)} ${next.y.toFixed(2)} `;
      }
    }

    if (closed) d += "Z";
    return d;
  }

  // ハンドルドラッグ時の連動更新（straight, smooth, corner）
  function updateHandle(point, handleName, newHandleX, newHandleY) {
    const isOut = handleName === "hOut";
    const targetHandle = isOut ? "hOut" : "hIn";
    const oppositeHandle = isOut ? "hIn" : "hOut";

    point[targetHandle] = { x: newHandleX, y: newHandleY };

    if (point.type === "corner") {
      // 頂点基準: 反対側ハンドルは何もしない
      return;
    }

    // ハンドルのベクトル
    const vx = newHandleX - point.x;
    const vy = newHandleY - point.y;
    const dist = Math.hypot(vx, vy);

    if (dist === 0) return;

    if (point.type === "smooth") {
      // スムーズ点: 反対側ハンドルは180度正反対で同じ長さ
      point[oppositeHandle] = {
        x: point.x - vx,
        y: point.y - vy
      };
    } else if (point.type === "straight") {
      // 直線点: 180度正反対だが、元の反対側ハンドルの長さを維持
      const opp = point[oppositeHandle];
      const currentOppDist = opp ? Math.hypot(opp.x - point.x, opp.y - point.y) : dist;
      const factor = currentOppDist / dist;
      point[oppositeHandle] = {
        x: point.x - vx * factor,
        y: point.y - vy * factor
      };
    }
  }

  // 頂点（アンカーポイント）自体を移動したとき、ハンドルも一緒に平行移動
  function moveAnchorPoint(point, newX, newY) {
    const dx = newX - point.x;
    const dy = newY - point.y;
    point.x = newX;
    point.y = newY;
    if (point.hIn) {
      point.hIn.x += dx;
      point.hIn.y += dy;
    }
    if (point.hOut) {
      point.hOut.x += dx;
      point.hOut.y += dy;
    }
  }

  // 線分をクリックして新しい頂点を追加（Add Point）
  function insertPointOnSegment(points, segmentIndex, t = 0.5) {
    const p1 = points[segmentIndex];
    const p2 = points[(segmentIndex + 1) % points.length];

    // 線形補間（ベジェの場合は中点）
    const midX = p1.x + (p2.x - p1.x) * t;
    const midY = p1.y + (p2.y - p1.y) * t;

    const newPoint = {
      x: midX,
      y: midY,
      type: "smooth",
      hIn: { x: midX - (p2.x - p1.x) * 0.15, y: midY - (p2.y - p1.y) * 0.15 },
      hOut: { x: midX + (p2.x - p1.x) * 0.15, y: midY + (p2.y - p1.y) * 0.15 }
    };

    points.splice(segmentIndex + 1, 0, newPoint);
    return segmentIndex + 1;
  }

  // 頂点を削除（Delete Point）
  function deletePoint(points, pointIndex) {
    if (points.length <= 3) return false; // 最低3頂点
    points.splice(pointIndex, 1);
    return true;
  }

  return {
    initializePointsFromShape,
    pointsToSvgPath,
    updateHandle,
    moveAnchorPoint,
    insertPointOnSegment,
    deletePoint
  };
})();
