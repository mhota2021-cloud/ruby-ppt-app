# frozen_string_literal: true

module PPTApp
  # 図形の階層順・可視性判定、SVGパス生成、ポリゴン展開の共通ジオメトリモジュール
  module ShapeGeometry
    module_function

    # 親の直後に子が並ぶ描画順リストを返す（canvas.jsのgetRenderOrderedShapes準拠）
    def get_render_ordered_shapes(shapes_list)
      return [] unless shapes_list.is_a?(Array) && !shapes_list.empty?

      children_by_parent = Hash.new { |h, k| h[k] = [] }
      shapes_list.each do |s|
        next unless s.is_a?(Hash)
        pid = s["parentId"]
        children_by_parent[pid] << s
      end

      ordered = []
      visited = {}

      walk = lambda do |s|
        return unless s

        key = s["id"] || s.object_id
        return if visited[key]

        visited[key] = true
        ordered << s
        if s["type"] == "frame" && s["id"]
          kids = children_by_parent[s["id"]]
          al = s["autoLayout"]
          if al.is_a?(Hash) && al["enabled"] && al["canvasStacking"] == "first-on-top"
            kids = kids.reverse
          end
          kids.each { |k| walk.call(k) }
        end
      end

      children_by_parent[nil].each { |s| walk.call(s) }
      shapes_list.each do |s|
        next unless s

        key = s["id"] || s.object_id
        next if visited[key]

        walk.call(s)
      end
      ordered
    end

    # 祖先を含めて表示状態かを判定する
    def effectively_visible?(shape, by_id)
      cur = shape
      seen = {}
      while cur
        return false if cur["visible"] == false
        cid = cur["id"]
        break if cid && seen[cid]
        seen[cid] = true if cid
        pid = cur["parentId"]
        break unless pid
        cur = by_id[pid]
      end
      true
    end

    # 描画順かつ実質表示中の図形一覧を返す
    def visible_ordered_shapes(shapes_list)
      ordered = get_render_ordered_shapes(shapes_list)
      by_id = {}
      ordered.each { |s| by_id[s["id"]] = s if s["id"] }
      ordered.select { |s| effectively_visible?(s, by_id) }
    end

    # 編集頂点配列からSVGパス文字列を生成する
    def points_to_svg_path(points, closed = true)
      return "" unless points.is_a?(Array) && !points.empty?

      p0 = points[0]
      parts = ["M #{format('%.2f', p0['x'].to_f)} #{format('%.2f', p0['y'].to_f)}"]

      points.each_with_index do |curr, i|
        break if !closed && i == points.length - 1
        nxt = points[(i + 1) % points.length]
        h_out = curr["hOut"]
        h_in = nxt["hIn"]
        if h_out || h_in
          cp1 = h_out || curr
          cp2 = h_in || nxt
          parts << "C #{format('%.2f', cp1['x'].to_f)} #{format('%.2f', cp1['y'].to_f)}, #{format('%.2f', cp2['x'].to_f)} #{format('%.2f', cp2['y'].to_f)}, #{format('%.2f', nxt['x'].to_f)} #{format('%.2f', nxt['y'].to_f)}"
        else
          parts << "L #{format('%.2f', nxt['x'].to_f)} #{format('%.2f', nxt['y'].to_f)}"
        end
      end

      parts << "Z" if closed
      parts.join(" ")
    end

    # 図形モデルからローカルSVGパス文字列を生成する
    def svg_path_for(shape)
      if shape["points"].is_a?(Array) && !shape["points"].empty?
        closed = shape["isPathClosed"].nil? ? true : !!shape["isPathClosed"]
        return points_to_svg_path(shape["points"], closed)
      end
      return shape["d"].to_s if shape["d"] && !shape["d"].to_s.empty?

      w = (shape["width"] || 100).to_f
      h = (shape["height"] || 100).to_f
      adj = shape["adjustments"].is_a?(Hash) ? shape["adjustments"] : {}
      generate_definition_path(shape["type"].to_s, w, h, adj)
    end

    # shapes.js準拠の各図形タイプ別SVGパス生成
    def generate_definition_path(type, w, h, adj = {})
      short_edge = [w, h].min
      case type
      when "rect"
        "M 0 0 L #{w} 0 L #{w} #{h} L 0 #{h} Z"
      when "rounded_rect"
        r = short_edge * (adj["radius"] || 0.2).to_f.clamp(0.0, 0.5)
        return "M 0 0 L #{w} 0 L #{w} #{h} L 0 #{h} Z" if r <= 0
        "M #{r} 0 L #{w - r} 0 Q #{w} 0 #{w} #{r} L #{w} #{h - r} Q #{w} #{h} #{w - r} #{h} L #{r} #{h} Q 0 #{h} 0 #{h - r} L 0 #{r} Q 0 0 #{r} 0 Z"
      when "snip_rect"
        s = short_edge * (adj["snip"] || 0.2).to_f
        "M 0 0 L #{w - s} 0 L #{w} #{s} L #{w} #{h} L 0 #{h} Z"
      when "ellipse", "circle"
        rx = w / 2.0
        ry = h / 2.0
        "M #{rx} 0 A #{rx} #{ry} 0 1 0 #{rx} #{h} A #{rx} #{ry} 0 1 0 #{rx} 0 Z"
      when "triangle"
        tx = w * (adj["topX"] || 0.5).to_f
        "M #{tx} 0 L #{w} #{h} L 0 #{h} Z"
      when "right_triangle"
        "M 0 0 L 0 #{h} L #{w} #{h} Z"
      when "trapezoid"
        ins = w * (adj["inset"] || 0.2).to_f
        "M #{ins} 0 L #{w - ins} 0 L #{w} #{h} L 0 #{h} Z"
      when "parallelogram"
        s = w * (adj["slant"] || 0.25).to_f
        "M #{s} 0 L #{w} 0 L #{w - s} #{h} L 0 #{h} Z"
      when "diamond"
        "M #{w / 2.0} 0 L #{w} #{h / 2.0} L #{w / 2.0} #{h} L 0 #{h / 2.0} Z"
      when "cross"
        t = short_edge * (adj["thickness"] || 0.25).to_f
        x1 = (w - t) / 2.0; x2 = (w + t) / 2.0
        y1 = (h - t) / 2.0; y2 = (h + t) / 2.0
        "M #{x1} 0 L #{x2} 0 L #{x2} #{y1} L #{w} #{y1} L #{w} #{y2} L #{x2} #{y2} L #{x2} #{h} L #{x1} #{h} L #{x1} #{y2} L 0 #{y2} L 0 #{y1} L #{x1} #{y1} Z"
      when "donut"
        hr = (adj["holeRatio"] || 0.5).to_f
        rx = w / 2.0; ry = h / 2.0
        irx = rx * hr; iry = ry * hr
        "M #{rx} 0 A #{rx} #{ry} 0 1 0 #{rx} #{h} A #{rx} #{ry} 0 1 0 #{rx} 0 Z M #{rx} #{ry - iry} A #{irx} #{iry} 0 1 1 #{rx} #{ry + iry} A #{irx} #{iry} 0 1 1 #{rx} #{ry - iry} Z"
      when "pie"
        rx = w / 2.0; ry = h / 2.0
        s_deg = (adj["startAngle"] || 0).to_f
        e_deg = (adj["endAngle"] || 270).to_f
        diff = (e_deg - s_deg) % 360.0
        s_rad = s_deg * Math::PI / 180.0
        e_rad = e_deg * Math::PI / 180.0
        x1 = rx + rx * Math.cos(s_rad); y1 = ry + ry * Math.sin(s_rad)
        x2 = rx + rx * Math.cos(e_rad); y2 = ry + ry * Math.sin(e_rad)
        large_arc = diff > 180.0 ? 1 : 0
        "M #{rx} #{ry} L #{x1} #{y1} A #{rx} #{ry} 0 #{large_arc} 1 #{x2} #{y2} Z"
      when "heart"
        "M #{w / 2.0} #{h * 0.8} C #{w * 0.1} #{h * 0.55} 0 #{h * 0.3} 0 #{h * 0.15} C 0 0 #{w * 0.25} 0 #{w / 2.0} #{h * 0.25} C #{w * 0.75} 0 #{w} 0 #{w} #{h * 0.15} C #{w} #{h * 0.3} #{w * 0.9} #{h * 0.55} #{w / 2.0} #{h * 0.8} Z"
      when "lightning"
        "M #{w * 0.55} 0 L #{w * 0.15} #{h * 0.55} L #{w * 0.45} #{h * 0.55} L #{w * 0.35} #{h} L #{w * 0.85} #{h * 0.45} L #{w * 0.55} #{h * 0.45} Z"
      when "right_arrow"
        hl = w * (adj["headLength"] || 0.35).to_f
        sw = h * (adj["shaftWidth"] || 0.3).to_f
        y_top = (h - sw) / 2.0; y_bot = (h + sw) / 2.0; x_end = w - hl
        "M 0 #{y_top} L #{x_end} #{y_top} L #{x_end} 0 L #{w} #{h / 2.0} L #{x_end} #{h} L #{x_end} #{y_bot} L 0 #{y_bot} Z"
      when "left_arrow"
        hl = w * (adj["headLength"] || 0.35).to_f
        sw = h * (adj["shaftWidth"] || 0.3).to_f
        y_top = (h - sw) / 2.0; y_bot = (h + sw) / 2.0
        "M #{w} #{y_top} L #{hl} #{y_top} L #{hl} 0 L 0 #{h / 2.0} L #{hl} #{h} L #{hl} #{y_bot} L #{w} #{y_bot} Z"
      when "left_right_arrow"
        hl = w * (adj["headLength"] || 0.25).to_f
        sw = h * (adj["shaftWidth"] || 0.3).to_f
        y_top = (h - sw) / 2.0; y_bot = (h + sw) / 2.0
        "M #{hl} #{y_top} L #{w - hl} #{y_top} L #{w - hl} 0 L #{w} #{h / 2.0} L #{w - hl} #{h} L #{w - hl} #{y_bot} L #{hl} #{y_bot} L #{hl} #{h} L 0 #{h / 2.0} L #{hl} 0 Z"
      when "chevron"
        s = w * (adj["slant"] || 0.3).to_f
        "M 0 0 L #{w - s} 0 L #{w} #{h / 2.0} L #{w - s} #{h} L 0 #{h} L #{s} #{h / 2.0} Z"
      when "star4"
        n_star_path(w, h, 4, (adj["innerRadiusRatio"] || 0.3).to_f)
      when "star5"
        n_star_path(w, h, 5, (adj["innerRadiusRatio"] || 0.382).to_f)
      when "star6"
        n_star_path(w, h, 6, (adj["innerRadiusRatio"] || 0.5).to_f)
      when "star8"
        n_star_path(w, h, 8, (adj["innerRadiusRatio"] || 0.54).to_f)
      when "star12"
        n_star_path(w, h, 12, (adj["innerRadiusRatio"] || 0.72).to_f)
      when "star16"
        n_star_path(w, h, 16, (adj["innerRadiusRatio"] || 0.8).to_f)
      when "callout_rect"
        tx = w * (adj["tailX"] || 0.2).to_f; ty = h * (adj["tailY"] || 1.3).to_f
        b1 = w * (adj["tailBase1"] || 0.15).to_f; b2 = w * (adj["tailBase2"] || 0.3).to_f
        "M 0 0 L #{w} 0 L #{w} #{h} L #{b2} #{h} L #{tx} #{ty} L #{b1} #{h} L 0 #{h} Z"
      when "callout_rounded"
        r = short_edge * (adj["radius"] || 0.15).to_f
        tx = w * (adj["tailX"] || 0.2).to_f; ty = h * (adj["tailY"] || 1.3).to_f
        b1 = [r, w * (adj["tailBase1"] || 0.2).to_f].max
        b2 = [w - r, w * (adj["tailBase2"] || 0.35).to_f].min
        "M #{r} 0 L #{w - r} 0 Q #{w} 0 #{w} #{r} L #{w} #{h - r} Q #{w} #{h} #{w - r} #{h} L #{b2} #{h} L #{tx} #{ty} L #{b1} #{h} L #{r} #{h} Q 0 #{h} 0 #{h - r} L 0 #{r} Q 0 0 #{r} 0 Z"
      when "callout_oval"
        rx = w / 2.0; ry = h / 2.0
        tx = w * (adj["tailX"] || 0.2).to_f; ty = h * (adj["tailY"] || 1.3).to_f
        a1 = Math::PI * 0.65; a2 = Math::PI * 0.55
        x1 = rx + rx * Math.cos(a1); y1 = ry + ry * Math.sin(a1)
        x2 = rx + rx * Math.cos(a2); y2 = ry + ry * Math.sin(a2)
        "M #{x2} #{y2} A #{rx} #{ry} 0 1 0 #{x1} #{y1} L #{tx} #{ty} Z"
      when "callout_cloud"
        "M #{w * 0.25} #{h * 0.3} C #{w * 0.15} #{h * 0.1} #{w * 0.45} 0 #{w * 0.55} #{h * 0.15} C #{w * 0.7} 0 #{w * 0.95} #{h * 0.15} #{w * 0.85} #{h * 0.35} C #{w * 1.05} #{h * 0.45} #{w * 0.95} #{h * 0.8} #{w * 0.75} #{h * 0.8} C #{w * 0.65} #{h * 0.95} #{w * 0.35} #{h * 0.95} #{w * 0.25} #{h * 0.8} C #{w * 0.05} #{h * 0.85} 0 #{h * 0.5} #{w * 0.15} #{h * 0.4} C #{w * 0.1} #{h * 0.35} #{w * 0.18} #{h * 0.3} #{w * 0.25} #{h * 0.3} Z"
      when "snip_2_rect"
        s = short_edge * (adj["snip"] || 0.2).to_f
        "M #{s} 0 L #{w - s} 0 L #{w} #{s} L #{w} #{h} L 0 #{h} L 0 #{s} Z"
      when "diag_snip_rect"
        s = short_edge * (adj["snip"] || 0.2).to_f
        "M #{s} 0 L #{w} 0 L #{w} #{h - s} L #{w - s} #{h} L 0 #{h} L 0 #{s} Z"
      when "round_top_rect"
        r = short_edge * (adj["radius"] || 0.25).to_f
        "M #{r} 0 L #{w - r} 0 Q #{w} 0 #{w} #{r} L #{w} #{h} L 0 #{h} L 0 #{r} Q 0 0 #{r} 0 Z"
      when "diag_round_rect"
        r = short_edge * (adj["radius"] || 0.35).to_f
        "M #{r} 0 L #{w} 0 L #{w} #{h - r} Q #{w} #{h} #{w - r} #{h} L 0 #{h} L 0 #{r} Q 0 0 #{r} 0 Z"
      when "pentagon"
        regular_polygon_path(w, h, 5)
      when "hexagon"
        regular_polygon_path(w, h, 6)
      when "octagon"
        regular_polygon_path(w, h, 8)
      when "capsule"
        r = short_edge / 2.0
        "M #{r} 0 L #{w - r} 0 A #{r} #{r} 0 0 1 #{w - r} #{h} L #{r} #{h} A #{r} #{r} 0 0 1 #{r} 0 Z"
      when "semicircle"
        "M 0 #{h} A #{w / 2.0} #{h} 0 0 1 #{w} #{h} Z"
      when "frame"
        t = short_edge * (adj["thickness"] || 0.2).to_f
        "M 0 0 L #{w} 0 L #{w} #{h} L 0 #{h} Z M #{t} #{t} L #{t} #{h - t} L #{w - t} #{h - t} L #{w - t} #{t} Z"
      when "l_shape"
        tx = w * (adj["thicknessX"] || 0.35).to_f
        ty = h * (adj["thicknessY"] || 0.35).to_f
        "M 0 0 L #{tx} 0 L #{tx} #{h - ty} L #{w} #{h - ty} L #{w} #{h} L 0 #{h} Z"
      when "moon"
        off = w * (adj["offset"] || 0.4).to_f
        "M #{w * 0.75} 0 A #{w * 0.75} #{h / 2.0} 0 1 0 #{w * 0.75} #{h} Q #{off} #{h / 2.0} #{w * 0.75} 0 Z"
      when "cloud"
        "M #{w * 0.25} #{h * 0.85} C #{w * 0.05} #{h * 0.85} 0 #{h * 0.6} #{w * 0.15} #{h * 0.45} C #{w * 0.1} #{h * 0.25} #{w * 0.3} #{h * 0.1} #{w * 0.45} #{h * 0.2} C #{w * 0.55} #{h * 0.05} #{w * 0.8} #{h * 0.1} #{w * 0.82} #{h * 0.35} C #{w * 1.0} #{h * 0.4} #{w * 1.0} #{h * 0.85} #{w * 0.78} #{h * 0.85} Z"
      when "drop"
        "M #{w / 2.0} 0 C #{w * 0.9} #{h * 0.5} #{w} #{h * 0.7} #{w} #{h * 0.75} A #{w / 2.0} #{h * 0.25} 0 1 1 0 #{h * 0.75} C 0 #{h * 0.7} #{w * 0.1} #{h * 0.5} #{w / 2.0} 0 Z"
      when "up_arrow"
        hl = h * (adj["headLength"] || 0.35).to_f; sw = w * (adj["shaftWidth"] || 0.35).to_f
        x1 = (w - sw) / 2.0; x2 = (w + sw) / 2.0
        "M #{w / 2.0} 0 L #{w} #{hl} L #{x2} #{hl} L #{x2} #{h} L #{x1} #{h} L #{x1} #{hl} L 0 #{hl} Z"
      when "down_arrow"
        hl = h * (adj["headLength"] || 0.35).to_f; sw = w * (adj["shaftWidth"] || 0.35).to_f
        x1 = (w - sw) / 2.0; x2 = (w + sw) / 2.0
        "M #{x1} 0 L #{x2} 0 L #{x2} #{h - hl} L #{w} #{h - hl} L #{w / 2.0} #{h} L 0 #{h - hl} L #{x1} #{h - hl} Z"
      when "up_down_arrow"
        hl = h * (adj["headLength"] || 0.25).to_f; sw = w * (adj["shaftWidth"] || 0.35).to_f
        x1 = (w - sw) / 2.0; x2 = (w + sw) / 2.0
        "M #{w / 2.0} 0 L #{w} #{hl} L #{x2} #{hl} L #{x2} #{h - hl} L #{w} #{h - hl} L #{w / 2.0} #{h} L 0 #{h - hl} L #{x1} #{h - hl} L #{x1} #{hl} L 0 #{hl} Z"
      when "quad_arrow"
        hs = short_edge * (adj["headSize"] || 0.22).to_f
        sw = short_edge * (adj["shaftWidth"] || 0.2).to_f
        cx = w / 2.0; cy = h / 2.0; half = sw / 2.0
        "M #{cx} 0 L #{cx + hs} #{hs} L #{cx + half} #{hs} L #{cx + half} #{cy - half} L #{w - hs} #{cy - half} L #{w - hs} #{cy - hs} L #{w} #{cy} L #{w - hs} #{cy + hs} L #{w - hs} #{cy + half} L #{cx + half} #{cy + half} L #{cx + half} #{h - hs} L #{cx + hs} #{h - hs} L #{cx} #{h} L #{cx - hs} #{h - hs} L #{cx - half} #{h - hs} L #{cx - half} #{cy + half} L #{hs} #{cy + half} L #{hs} #{cy + hs} L 0 #{cy} L #{hs} #{cy - hs} L #{hs} #{cy - half} L #{cx - half} #{cy - half} L #{cx - half} #{hs} L #{cx - hs} #{hs} Z"
      when "pentagon_arrow"
        t = w * (adj["tip"] || 0.25).to_f
        "M 0 0 L #{w - t} 0 L #{w} #{h / 2.0} L #{w - t} #{h} L 0 #{h} Z"
      when "notched_right_arrow"
        hl = w * (adj["headLength"] || 0.3).to_f; sw = h * (adj["shaftWidth"] || 0.45).to_f; n = w * (adj["notch"] || 0.15).to_f
        y1 = (h - sw) / 2.0; y2 = (h + sw) / 2.0
        "M 0 #{y1} L #{w - hl} #{y1} L #{w - hl} 0 L #{w} #{h / 2.0} L #{w - hl} #{h} L #{w - hl} #{y2} L 0 #{y2} L #{n} #{h / 2.0} Z"
      when "ribbon_banner"
        c = w * (adj["cut"] || 0.15).to_f
        "M 0 0 L #{w} 0 L #{w - c} #{h / 2.0} L #{w} #{h} L 0 #{h} L #{c} #{h / 2.0} Z"
      when "tag_badge"
        r = short_edge * 0.08; cx = w * 0.22; cy = h / 2.0
        "M #{w * 0.25} 0 L #{w} 0 L #{w} #{h} L #{w * 0.25} #{h} L 0 #{h / 2.0} Z M #{cx - r} #{cy} A #{r} #{r} 0 1 0 #{cx + r} #{cy} A #{r} #{r} 0 1 0 #{cx - r} #{cy} Z"
      when "bookmark_ribbon"
        c = h * (adj["cut"] || 0.22).to_f
        "M 0 0 L #{w} 0 L #{w} #{h} L #{w / 2.0} #{h - c} L 0 #{h} Z"
      when "flow_terminator"
        r = short_edge * 0.45
        "M #{r} 0 L #{w - r} 0 Q #{w} 0 #{w} #{h / 2.0} Q #{w} #{h} #{w - r} #{h} L #{r} #{h} Q 0 #{h} 0 #{h / 2.0} Q 0 0 #{r} 0 Z"
      when "flow_document"
        "M 0 0 L #{w} 0 L #{w} #{h * 0.85} Q #{w * 0.75} #{h * 0.7} #{w / 2.0} #{h * 0.85} Q #{w * 0.25} #{h * 1.0} 0 #{h * 0.85} Z"
      when "flow_database"
        ry = h * 0.16
        "M 0 #{ry} A #{w / 2.0} #{ry} 0 1 1 #{w} #{ry} A #{w / 2.0} #{ry} 0 1 1 0 #{ry} M 0 #{ry} L 0 #{h - ry} A #{w / 2.0} #{ry} 0 0 0 #{w} #{h - ry} L #{w} #{ry}"
      else
        "M 0 0 L #{w} 0 L #{w} #{h} L 0 #{h} Z"
      end
    end

    def regular_polygon_path(w, h, sides)
      rx = w / 2.0; ry = h / 2.0
      (0...sides).map do |i|
        a = -Math::PI / 2.0 + (2.0 * Math::PI * i) / sides
        x = rx + rx * Math.cos(a)
        y = ry + ry * Math.sin(a)
        "#{i == 0 ? 'M' : 'L'} #{format('%.2f', x)} #{format('%.2f', y)}"
      end.join(" ") + " Z"
    end

    def n_star_path(w, h, points_count, inner_ratio)
      rx = w / 2.0; ry = h / 2.0
      step = Math::PI / points_count
      (0...(2 * points_count)).map do |i|
        a = -Math::PI / 2.0 + i * step
        rr = i.even? ? 1.0 : inner_ratio
        x = rx + rx * rr * Math.cos(a)
        y = ry + ry * rr * Math.sin(a)
        "#{i == 0 ? 'M' : 'L'} #{format('%.2f', x)} #{format('%.2f', y)}"
      end.join(" ") + " Z"
    end

    # SVGパス文字列dをサブパスごとの点列（[x, y]の配列）に分解する
    # 戻り値: [{ points: [[x, y], ...], closed: true/false }, ...]
    def svg_path_to_subpaths(d)
      tokens = d.to_s.scan(/[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?/)
      subpaths = []
      current = nil
      cx = 0.0; cy = 0.0
      sx = 0.0; sy = 0.0
      cmd = nil
      i = 0

      next_num = lambda do
        return 0.0 if i >= tokens.length
        v = tokens[i].to_f
        i += 1
        v
      end

      start_subpath = lambda do |x, y|
        subpaths << current if current && !current[:points].empty?
        current = { points: [[x, y]], closed: false }
        cx = x; cy = y
        sx = x; sy = y
      end

      while i < tokens.length
        t = tokens[i]
        if t.match?(/\A[a-zA-Z]\z/)
          cmd = t
          i += 1
          if cmd == "Z" || cmd == "z"
            if current
              current[:closed] = true
              cx = sx; cy = sy
            end
            cmd = nil
          end
          next
        end

        break unless cmd

        case cmd
        when "M", "m"
          nx = next_num.call
          ny = next_num.call
          if cmd == "m"
            nx += cx; ny += cy
          end
          start_subpath.call(nx, ny)
          cmd = cmd == "M" ? "L" : "l"
        when "L", "l"
          nx = next_num.call
          ny = next_num.call
          if cmd == "l"
            nx += cx; ny += cy
          end
          start_subpath.call(cx, cy) unless current
          current[:points] << [nx, ny]
          cx = nx; cy = ny
        when "H", "h"
          nx = next_num.call
          nx += cx if cmd == "h"
          start_subpath.call(cx, cy) unless current
          current[:points] << [nx, cy]
          cx = nx
        when "V", "v"
          ny = next_num.call
          ny += cy if cmd == "v"
          start_subpath.call(cx, cy) unless current
          current[:points] << [cx, ny]
          cy = ny
        when "Q", "q"
          qx = next_num.call; qy = next_num.call
          nx = next_num.call; ny = next_num.call
          if cmd == "q"
            qx += cx; qy += cy; nx += cx; ny += cy
          end
          start_subpath.call(cx, cy) unless current
          1.upto(10) do |k|
            u = k / 10.0
            iu = 1.0 - u
            px = iu * iu * cx + 2.0 * iu * u * qx + u * u * nx
            py = iu * iu * cy + 2.0 * iu * u * qy + u * u * ny
            current[:points] << [px, py]
          end
          cx = nx; cy = ny
        when "C", "c"
          c1x = next_num.call; c1y = next_num.call
          c2x = next_num.call; c2y = next_num.call
          nx = next_num.call; ny = next_num.call
          if cmd == "c"
            c1x += cx; c1y += cy; c2x += cx; c2y += cy; nx += cx; ny += cy
          end
          start_subpath.call(cx, cy) unless current
          1.upto(12) do |k|
            u = k / 12.0
            iu = 1.0 - u
            px = (iu**3) * cx + 3.0 * (iu**2) * u * c1x + 3.0 * iu * (u**2) * c2x + (u**3) * nx
            py = (iu**3) * cy + 3.0 * (iu**2) * u * c1y + 3.0 * iu * (u**2) * c2y + (u**3) * ny
            current[:points] << [px, py]
          end
          cx = nx; cy = ny
        when "A", "a"
          rx = next_num.call; ry = next_num.call
          x_rot = next_num.call
          large_arc = next_num.call != 0.0
          sweep = next_num.call != 0.0
          nx = next_num.call; ny = next_num.call
          if cmd == "a"
            nx += cx; ny += cy
          end
          start_subpath.call(cx, cy) unless current
          arc_pts = approximate_svg_arc(cx, cy, rx, ry, x_rot, large_arc, sweep, nx, ny, 20)
          current[:points].concat(arc_pts)
          cx = nx; cy = ny
        else
          i += 1
        end
      end

      subpaths << current if current && !current[:points].empty?
      subpaths
    end

    # SVG楕円弧コマンドを端点群に近似する（W3C SVG実装ノート準拠）
    def approximate_svg_arc(x1, y1, rx, ry, phi_deg, large_arc, sweep, x2, y2, segments = 20)
      return [[x2, y2]] if (x1 - x2).abs < 1e-6 && (y1 - y2).abs < 1e-6
      rx = rx.abs; ry = ry.abs
      return [[x2, y2]] if rx < 1e-6 || ry < 1e-6

      phi = phi_deg * Math::PI / 180.0
      cos_p = Math.cos(phi); sin_p = Math.sin(phi)
      dx2 = (x1 - x2) / 2.0; dy2 = (y1 - y2) / 2.0
      x1p = cos_p * dx2 + sin_p * dy2
      y1p = -sin_p * dx2 + cos_p * dy2

      lam = (x1p**2) / (rx**2) + (y1p**2) / (ry**2)
      if lam > 1.0
        s = Math.sqrt(lam)
        rx *= s; ry *= s
      end

      num = [(rx**2) * (ry**2) - (rx**2) * (y1p**2) - (ry**2) * (x1p**2), 0.0].max
      den = (rx**2) * (y1p**2) + (ry**2) * (x1p**2)
      coef = den > 1e-12 ? Math.sqrt(num / den) : 0.0
      coef = -coef if large_arc == sweep

      cxp = coef * (rx * y1p) / ry
      cyp = coef * -(ry * x1p) / rx

      cx = cos_p * cxp - sin_p * cyp + (x1 + x2) / 2.0
      cy = sin_p * cxp + cos_p * cyp + (y1 + y2) / 2.0

      vec_angle = lambda do |ux, uy, vx, vy|
        dot = ux * vx + uy * vy
        len = Math.sqrt((ux**2 + uy**2) * (vx**2 + vy**2))
        return 0.0 if len < 1e-12
        ang = Math.acos((dot / len).clamp(-1.0, 1.0))
        (ux * vy - uy * vx) < 0 ? -ang : ang
      end

      theta1 = vec_angle.call(1.0, 0.0, (x1p - cxp) / rx, (y1p - cyp) / ry)
      dtheta = vec_angle.call((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry)
      dtheta -= 2.0 * Math::PI if !sweep && dtheta > 0
      dtheta += 2.0 * Math::PI if sweep && dtheta < 0

      (1..segments).map do |k|
        t = theta1 + dtheta * k / segments.to_f
        px = rx * Math.cos(t)
        py = ry * Math.sin(t)
        [cx + cos_p * px - sin_p * py, cy + sin_p * px + cos_p * py]
      end
    end

    # ローカル座標点列に図形の移動・反転・せん断・回転を適用してキャンバス座標を返す
    def transform_local_points(local_pts, shape, offset_x: 0.0, offset_y: 0.0)
      sx = shape["x"].to_f - offset_x
      sy = shape["y"].to_f - offset_y
      w = (shape["width"] || 100).to_f
      h = (shape["height"] || 100).to_f
      cx = sx + w / 2.0
      cy = sy + h / 2.0
      flip_h = shape["flipH"] ? -1.0 : 1.0
      flip_v = shape["flipV"] ? -1.0 : 1.0
      tan_x = Math.tan((shape["shearX"] || 0).to_f * Math::PI / 180.0)
      tan_y = Math.tan((shape["shearY"] || 0).to_f * Math::PI / 180.0)
      rad = (shape["rotation"] || 0).to_f * Math::PI / 180.0
      cos_r = Math.cos(rad)
      sin_r = Math.sin(rad)

      local_pts.map do |pt|
        lx = pt[0] - w / 2.0
        ly = pt[1] - h / 2.0
        if tan_x != 0.0 || tan_y != 0.0
          sh_x = lx + tan_x * ly
          sh_y = tan_y * lx + ly
          lx = sh_x; ly = sh_y
        end
        lx *= flip_h
        ly *= flip_v
        rx = lx * cos_r - ly * sin_r
        ry = lx * sin_r + ly * cos_r
        [cx + rx, cy + ry]
      end
    end

    # 図形からワールド座標のサブパス群を返す
    def world_subpaths_for(shape, offset_x: 0.0, offset_y: 0.0)
      d = svg_path_for(shape)
      subpaths = svg_path_to_subpaths(d)
      subpaths.map do |sp|
        {
          points: transform_local_points(sp[:points], shape, offset_x: offset_x, offset_y: offset_y),
          closed: sp[:closed]
        }
      end
    end
  end
end
