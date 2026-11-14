# frozen_string_literal: true

require_relative "ppm_generator"
require_relative "shape_geometry"
require_relative "math_formula"
require_relative "font_5x7"

module PPTApp
  # 純Ruby製ソフトウェアラスタライザ（CLI/オフライン用）
  class Renderer
    attr_reader :width, :height, :buffer

    def initialize(width = 960, height = 540, bg_color: [255, 255, 255])
      @width = width.to_i
      @height = height.to_i
      @bg_color = bg_color
      @clips = []
      @buffer = Array.new(@height) { Array.new(@width) { @bg_color.dup } }
    end

    def clear(color = @bg_color)
      @height.times do |y|
        @width.times do |x|
          @buffer[y][x] = color.dup
        end
      end
    end

    def push_clip(x, y, w, h, r = 0.0, rot_deg = 0.0, shear_x = 0.0, shear_y = 0.0, flip_h = false, flip_v = false)
      cx = x + w / 2.0
      cy = y + h / 2.0
      hw = w / 2.0
      hh = h / 2.0
      rr = [r.to_f, hw, hh].min
      rad = rot_deg.to_f * Math::PI / 180.0
      tan_x = Math.tan(shear_x.to_f * Math::PI / 180.0)
      tan_y = Math.tan(shear_y.to_f * Math::PI / 180.0)
      fh = flip_h ? -1.0 : 1.0
      fv = flip_v ? -1.0 : 1.0
      @clips.push([cx, cy, hw, hh, rr, Math.cos(rad), Math.sin(rad), tan_x, tan_y, fh, fv])
    end

    def pop_clip
      @clips.pop
    end

    def in_clips?(px, py)
      return true if @clips.empty?

      @clips.all? do |cx, cy, hw, hh, r, cos_t, sin_t, tan_x, tan_y, fh, fv|
        dx = px - cx
        dy = py - cy
        rx = (dx * cos_t + dy * sin_t) * fh
        ry = (-dx * sin_t + dy * cos_t) * fv
        if tan_x != 0.0 || tan_y != 0.0
          det = 1.0 - tan_x * tan_y
          next false if det.abs < 1e-9

          lx = (rx - tan_x * ry) / det
          ly = (-tan_y * rx + ry) / det
        else
          lx = rx
          ly = ry
        end
        ax = lx.abs
        ay = ly.abs
        next false if ax > hw || ay > hh

        if r > 0.0
          ix = hw - r
          iy = hh - r
          next false if ax > ix && ay > iy && (ax - ix)**2 + (ay - iy)**2 > r**2
        end
        true
      end
    end

    def set_pixel(x, y, color, alpha = 1.0)
      return if x < 0 || x >= @width || y < 0 || y >= @height
      return unless in_clips?(x, y)

      if alpha >= 1.0
        @buffer[y][x] = color.dup
      elsif alpha > 0.0
        current = @buffer[y][x]
        @buffer[y][x] = [
          ((1.0 - alpha) * current[0] + alpha * color[0]).round.clamp(0, 255),
          ((1.0 - alpha) * current[1] + alpha * color[1]).round.clamp(0, 255),
          ((1.0 - alpha) * current[2] + alpha * color[2]).round.clamp(0, 255)
        ]
      end
    end

    # 矩形塗りつぶし
    def fill_rect(rx, ry, rw, rh, color, alpha = 1.0)
      x_start = [rx.round, 0].max
      x_end = [(rx + rw).round, @width].min
      y_start = [ry.round, 0].max
      y_end = [(ry + rh).round, @height].min

      (y_start...y_end).each do |y|
        (x_start...x_end).each do |x|
          set_pixel(x, y, color, alpha)
        end
      end
    end

    # 楕円塗りつぶし
    def fill_ellipse(cx, cy, rx, ry, color, alpha = 1.0)
      return if rx <= 0 || ry <= 0

      x_start = [(cx - rx).floor, 0].max
      x_end = [(cx + rx).ceil, @width].min
      y_start = [(cy - ry).floor, 0].max
      y_end = [(cy + ry).ceil, @height].min

      (y_start...y_end).each do |y|
        dy = (y - cy).to_f / ry
        (x_start...x_end).each do |x|
          dx = (x - cx).to_f / rx
          set_pixel(x, y, color, alpha) if dx * dx + dy * dy <= 1.0
        end
      end
    end

    # 多角形スキャンライン塗りつぶし（単一閉路）
    def fill_polygon(points, color, alpha = 1.0)
      fill_subpaths([points], color, alpha)
    end

    # 複数サブパスの奇偶規則スキャンライン塗りつぶし（穴あき図形対応）
    def fill_subpaths(subpaths_points, color, alpha = 1.0)
      valid = subpaths_points.select { |pts| pts.is_a?(Array) && pts.length >= 3 }
      return if valid.empty?

      all_y = valid.flatten(1).map { |p| p[1] }
      min_y = all_y.min.floor.clamp(0, @height - 1)
      max_y = all_y.max.ceil.clamp(0, @height - 1)

      (min_y..max_y).each do |y|
        intersections = []
        valid.each do |points|
          n = points.length
          n.times do |i|
            p1 = points[i]
            p2 = points[(i + 1) % n]
            y1, y2 = p1[1], p2[1]
            x1, x2 = p1[0], p2[0]
            if (y1 <= y && y2 > y) || (y2 <= y && y1 > y)
              t = (y - y1).to_f / (y2 - y1)
              intersections << (x1 + t * (x2 - x1))
            end
          end
        end

        intersections.sort!
        (0...intersections.length).step(2) do |k|
          break if k + 1 >= intersections.length

          x_start = [intersections[k].ceil, 0].max
          x_end = [intersections[k + 1].floor, @width - 1].min
          (x_start..x_end).each do |x|
            set_pixel(x, y, color, alpha)
          end
        end
      end
    end

    # 太さ・破線対応の線分描画
    def draw_line(x0, y0, x1, y1, line_width, color, alpha = 1.0, dash: "solid")
      dx = x1 - x0
      dy = y1 - y0
      len = Math.hypot(dx, dy)
      return if len < 1e-6

      if dash == "dashed" || dash == "dotted"
        on_len = dash == "dashed" ? 8.0 : 3.0
        off_len = dash == "dashed" ? 5.0 : 3.0
        pos = 0.0
        while pos < len
          seg_end = [pos + on_len, len].min
          t0 = pos / len
          t1 = seg_end / len
          draw_solid_line(x0 + dx * t0, y0 + dy * t0, x0 + dx * t1, y0 + dy * t1, line_width, color, alpha)
          pos += on_len + off_len
        end
      else
        draw_solid_line(x0, y0, x1, y1, line_width, color, alpha)
      end
    end

    # プロジェクトJSON全体をラスタライズする（CLI --format ppm用）
    def self.render_project(project)
      w = (project["width"] || 960).to_i
      h = (project["height"] || 540).to_i
      bg = project["backgroundColor"] || "#ffffff"
      bg_rgb = (bg == "transparent" || bg == "none") ? [255, 255, 255] : hex_to_rgb(bg)
      renderer = new(w, h, bg_color: bg_rgb)

      visible_shapes = ShapeGeometry.visible_ordered_shapes(project["shapes"] || [])
      by_id = {}
      visible_shapes.each { |s| by_id[s["id"]] = s if s["id"] }
      has_ancestor = lambda do |shape, pid|
        cur = shape
        seen = {}
        while cur && cur["parentId"] && !seen[cur["parentId"]]
          return true if cur["parentId"] == pid

          seen[cur["parentId"]] = true
          cur = by_id[cur["parentId"]]
        end
        false
      end

      clip_stack = []
      close_finished_clips = lambda do |next_shape|
        while !clip_stack.empty?
          top_id = clip_stack.last
          break if next_shape && has_ancestor.call(next_shape, top_id)

          renderer.pop_clip
          clip_stack.pop
        end
      end

      visible_shapes.each do |s|
        close_finished_clips.call(s)
        renderer.draw_shape(s)
        if s["type"] == "frame" && s["clipContent"] && s["id"]
          r = [(s["cornerRadius"] || 0).to_f, [s["width"].to_f, s["height"].to_f].min / 2.0].min
          renderer.push_clip(
            s["x"].to_f, s["y"].to_f, s["width"].to_f, s["height"].to_f,
            r, (s["rotation"] || 0).to_f,
            (s["shearX"] || 0).to_f, (s["shearY"] || 0).to_f,
            !!s["flipH"], !!s["flipV"]
          )
          clip_stack.push(s["id"])
        end
      end
      close_finished_clips.call(nil)
      renderer
    end

    def draw_shape(s)
      type = s["type"].to_s
      fill_op = s["fillOpacity"].nil? ? 1.0 : s["fillOpacity"].to_f
      has_fill = s["fill"] && s["fill"] != "none" && s["fill"] != "transparent" && fill_op > 0.005
      sw = (s["strokeWidth"] || 0).to_f
      has_stroke = sw > 0.0 && s["stroke"] && s["stroke"] != "none" && s["stroke"] != "transparent"
      dash = (s["strokeDash"] || "solid").to_s

      case type
      when "text"
        draw_text_shape(s)
      when "math_plot"
        draw_math_plot_shape(s)
      when "frame"
        x = (s["x"] || 0).to_f
        y = (s["y"] || 0).to_f
        w = (s["width"] || 100).to_f
        h = (s["height"] || 100).to_f
        r = [[0.0, (s["cornerRadius"] || 0).to_f].max, [w, h].min / 2.0].min
        d = ShapeGeometry.generate_definition_path("rounded_rect", w, h, { "radius" => [w, h].min > 0 ? r / [w, h].min : 0 })
        subpaths = ShapeGeometry.svg_path_to_subpaths(d).map do |sp|
          { points: ShapeGeometry.transform_local_points(sp[:points], s), closed: true }
        end
        fill_subpaths(subpaths.map { |sp| sp[:points] }, self.class.hex_to_rgb(s["fill"]), fill_op) if has_fill
        stroke_subpaths(subpaths, sw, self.class.hex_to_rgb(s["stroke"]), 1.0, dash) if has_stroke
      else
        subpaths = ShapeGeometry.world_subpaths_for(s)
        if has_fill && s["isPathClosed"] != false
          fill_subpaths(subpaths.map { |sp| sp[:points] }, self.class.hex_to_rgb(s["fill"]), fill_op)
        end
        if has_stroke
          stroke_subpaths(subpaths, sw, self.class.hex_to_rgb(s["stroke"]), 1.0, dash)
        end
      end
    end

    # PPMバイナリ (P6) またはテキスト (P3) を出力
    def to_ppm(format: :p6)
      rgb_bytes = String.new(capacity: @width * @height * 3, encoding: Encoding::BINARY)
      @height.times do |y|
        @width.times do |x|
          c = @buffer[y][x]
          rgb_bytes << c[0].chr << c[1].chr << c[2].chr
        end
      end

      PPMGenerator.generate_from_raw_rgb(@width, @height, rgb_bytes, format: format)
    end

    # 16進カラーコード (#RRGGBB) をRGB配列に変換
    def self.hex_to_rgb(hex)
      hex = hex.to_s.delete("#")
      hex = hex.chars.map { |c| c * 2 }.join if hex.length == 3
      return [0, 0, 0] unless hex.match?(/\A[0-9a-fA-F]{6}\z/)

      [hex[0..1].to_i(16), hex[2..3].to_i(16), hex[4..5].to_i(16)]
    end

    private

    def draw_solid_line(x0, y0, x1, y1, line_width, color, alpha)
      nx = y1 - y0
      ny = x0 - x1
      len = Math.hypot(nx, ny)
      return if len < 1e-6

      half_w = [line_width.to_f, 1.0].max * 0.5
      ox = nx / len * half_w
      oy = ny / len * half_w
      poly = [[x0 - ox, y0 - oy], [x0 + ox, y0 + oy], [x1 + ox, y1 + oy], [x1 - ox, y1 - oy]]
      fill_polygon(poly, color, alpha)
    end

    def stroke_subpaths(subpaths, sw, color, alpha, dash)
      subpaths.each do |sp|
        pts = sp[:points]
        next if pts.length < 2

        count = sp[:closed] ? pts.length : pts.length - 1
        count.times do |i|
          p1 = pts[i]
          p2 = pts[(i + 1) % pts.length]
          draw_line(p1[0], p1[1], p2[0], p2[1], sw, color, alpha, dash: dash)
        end
      end
    end

    def draw_math_plot_shape(s)
      w = (s["width"] || 100).to_f
      h = (s["height"] || 100).to_f
      cfg = s["mathConfig"].is_a?(Hash) ? s["mathConfig"] : {}
      xf = ->(pts) { ShapeGeometry.transform_local_points(pts, s) }
      draw_local_line = lambda do |lx0, ly0, lx1, ly1, line_w, col, alpha = 1.0|
        wp = xf.call([[lx0, ly0], [lx1, ly1]])
        draw_line(wp[0][0], wp[0][1], wp[1][0], wp[1][1], line_w, col, alpha)
      end

      fill_op = s["fillOpacity"].nil? ? 0.0 : s["fillOpacity"].to_f
      if s["fill"] && s["fill"] != "none" && s["fill"] != "transparent" && fill_op > 0.0
        fill_polygon(xf.call([[0.0, 0.0], [w, 0.0], [w, h], [0.0, h]]), self.class.hex_to_rgb(s["fill"]), fill_op)
      end

      sw = (s["strokeWidth"] || 0).to_f
      if sw > 0.0 && s["stroke"] && s["stroke"] != "none" && s["stroke"] != "transparent"
        fc = self.class.hex_to_rgb(s["stroke"])
        [[0.0, 0.0, w, 0.0], [w, 0.0, w, h], [w, h, 0.0, h], [0.0, h, 0.0, 0.0]].each do |lx0, ly0, lx1, ly1|
          draw_local_line.call(lx0, ly0, lx1, ly1, sw, fc)
        end
      elsif cfg["showFrame"] == true
        fc = [148, 163, 184]
        [[0.0, 0.0, w, 0.0], [w, 0.0, w, h], [w, h, 0.0, h], [0.0, h, 0.0, 0.0]].each do |lx0, ly0, lx1, ly1|
          draw_local_line.call(lx0, ly0, lx1, ly1, 1.0, fc, 0.45)
        end
      end

      data = s["mathData"].is_a?(Hash) ? s["mathData"] : nil
      if data.nil? && cfg["expr"]
        ev = MathFormula.evaluate(cfg)
        if ev[:success]
          data = {
            "axisXRatio" => ev[:axisXRatio],
            "axisYRatio" => ev[:axisYRatio],
            "segments" => ev[:segments].map { |seg| seg.map { |pt| { "x" => pt[:x], "y" => pt[:y] } } }
          }
        end
      end
      return unless data

      if cfg["showAxes"] == true
        ax_r = data["axisXRatio"]
        draw_local_line.call(ax_r * w, 0.0, ax_r * w, h, 1.0, [148, 163, 184]) if ax_r.is_a?(Numeric) && ax_r >= 0.0 && ax_r <= 1.0
        ay_r = data["axisYRatio"]
        draw_local_line.call(0.0, ay_r * h, w, ay_r * h, 1.0, [148, 163, 184]) if ay_r.is_a?(Numeric) && ay_r >= 0.0 && ay_r <= 1.0
      end

      return unless data["segments"].is_a?(Array)

      lcol = cfg["lineColor"]
      lcol = (s["stroke"] && s["stroke"] != "none" && s["stroke"] != "transparent") ? s["stroke"] : "#2563eb" if !lcol || lcol.to_s.empty?
      rgb = self.class.hex_to_rgb(lcol)
      lw = (cfg["lineWidth"] || 3).to_f
      data["segments"].each do |seg|
        next unless seg.is_a?(Array) && seg.length >= 2

        (seg.length - 1).times do |i|
          p1 = seg[i]; p2 = seg[i + 1]
          draw_local_line.call(p1["x"].to_f * w, p1["y"].to_f * h, p2["x"].to_f * w, p2["y"].to_f * h, lw, rgb)
        end
      end
    end

    def draw_text_shape(s)
      text = s["text"].to_s
      return if text.empty?

      w = (s["width"] || 100).to_f
      h = (s["height"] || 100).to_f
      font_size = (s["fontSize"] || 28).to_f
      scale = [1.0, font_size / 8.0].max
      rgb = self.class.hex_to_rgb(s["fill"] || "#2c3e50")
      alpha = s["fillOpacity"].nil? ? 1.0 : s["fillOpacity"].to_f
      warp = (s["textWarp"] || "none").to_s

      if warp == "none"
        lines = text.split("\n", -1)
        line_h = 9.0 * scale
        total_h = lines.length * line_h
        start_y = (h - total_h) / 2.0
        align = (s["textAlign"] || "center").to_s

        lines.each_with_index do |line, li|
          line_w = line.length * 6.0 * scale
          lx0 = case align
                when "left" then 10.0
                when "right" then w - 10.0 - line_w
                else (w - line_w) / 2.0
                end
          ly0 = start_y + li * line_h
          line.chars.each_with_index do |ch, ci|
            draw_glyph_transformed(ch, lx0 + ci * 6.0 * scale, ly0, scale, 1.0, 0.0, s, rgb, alpha)
          end
        end
      else
        chars = text.chars
        count = chars.length
        chars.each_with_index do |ch, i|
          u = count == 1 ? 0.5 : i.to_f / (count - 1)
          cx = w * u
          cy = h / 2.0
          ang = 0.0
          sy = 1.0
          case warp
          when "arch_up"
            arc = (u - 0.5) * (Math::PI * 0.65)
            r = w * 0.75
            cx = w / 2.0 + r * Math.sin(arc)
            cy = h * 0.8 - r * Math.cos(arc) + r
            ang = arc * 180.0 / Math::PI
          when "arch_down"
            arc = (u - 0.5) * (Math::PI * 0.65)
            r = w * 0.75
            cx = w / 2.0 + r * Math.sin(arc)
            cy = h * 0.2 + r * Math.cos(arc) - r
            ang = -arc * 180.0 / Math::PI
          when "circle"
            arc = -Math::PI / 2.0 + (u - 0.5) * (2.0 * Math::PI * 0.85)
            r = [w, h].min * 0.4
            cx = w / 2.0 + r * Math.cos(arc)
            cy = h / 2.0 + r * Math.sin(arc)
            ang = (arc + Math::PI / 2.0) * 180.0 / Math::PI
          when "wave"
            cy = h / 2.0 + Math.sin(u * 2.0 * Math::PI) * (h * 0.3)
            ang = Math.cos(u * 2.0 * Math::PI) * 0.45 * 180.0 / Math::PI
          when "triangle_up"
            sy = 0.5 + (1.0 - 2.0 * (u - 0.5).abs) * 0.9
          when "triangle_down"
            sy = 0.5 + (2.0 * (u - 0.5).abs) * 0.9
          when "inflate"
            sy = 0.7 + Math.sin(u * Math::PI) * 0.8
          when "deflate"
            sy = 1.0 - Math.sin(u * Math::PI) * 0.6
          when "fade_right"
            sy = 0.4 + u * 1.0
          when "fade_left"
            sy = 1.4 - u * 1.0
          end
          draw_glyph_transformed(ch, cx - 2.5 * scale, cy - 3.5 * scale * sy, scale, sy, ang, s, rgb, alpha, pivot: [cx, cy])
        end
      end
    end

    def draw_glyph_transformed(ch, local_x, local_y, scale_x, scale_y, char_rot_deg, shape, color, alpha, pivot: nil)
      rows = Font5x7.rows_for(ch)
      char_rad = char_rot_deg * Math::PI / 180.0
      c_cos = Math.cos(char_rad)
      c_sin = Math.sin(char_rad)
      px, py = pivot || [local_x + 2.5 * scale_x, local_y + 3.5 * scale_x * scale_y]

      rows.each_with_index do |bits, row|
        5.times do |col|
          next if (bits & (1 << (4 - col))) == 0

          rx0 = local_x + col * scale_x
          ry0 = local_y + row * scale_x * scale_y
          rw = scale_x
          rh = scale_x * scale_y
          corners = [[rx0, ry0], [rx0 + rw, ry0], [rx0 + rw, ry0 + rh], [rx0, ry0 + rh]].map do |gx, gy|
            if char_rot_deg != 0.0
              dx = gx - px; dy = gy - py
              [px + dx * c_cos - dy * c_sin, py + dx * c_sin + dy * c_cos]
            else
              [gx, gy]
            end
          end
          world_poly = ShapeGeometry.transform_local_points(corners, shape)
          fill_polygon(world_poly, color, alpha)
        end
      end
    end
  end
end
