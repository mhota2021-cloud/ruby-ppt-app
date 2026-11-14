# frozen_string_literal: true

require_relative "math_formula"
require_relative "font_5x7"
require_relative "shape_geometry"

module PPTApp
  # 基礎プログラミングおよび演習準拠のRubyコード生成モジュール
  class RubyCodeGenerator
    FONT_5X7 = Font5x7::GLYPHS

    def self.shapes_bounding_box(shapes, margin = 10)
      return { x: 0, y: 0, width: 400, height: 400 } if shapes.nil? || shapes.empty?

      min_x = Float::INFINITY
      min_y = Float::INFINITY
      max_x = -Float::INFINITY
      max_y = -Float::INFINITY

      shapes.each do |s|
        sx = s["x"].to_f
        sy = s["y"].to_f
        sw = s["width"].to_f
        sh = s["height"].to_f
        cx = sx + sw / 2.0
        cy = sy + sh / 2.0
        rot = (s["rotation"] || 0).to_f * Math::PI / 180.0
        cos_v = Math.cos(rot).abs
        sin_v = Math.sin(rot).abs
        hw = (sw / 2.0) * cos_v + (sh / 2.0) * sin_v
        hh = (sw / 2.0) * sin_v + (sh / 2.0) * cos_v

        min_x = [min_x, cx - hw].min
        min_y = [min_y, cy - hh].min
        max_x = [max_x, cx + hw].max
        max_y = [max_y, cy + hh].max
      end

      x = [0, (min_x - margin).floor].max
      y = [0, (min_y - margin).floor].max
      width = [10, (max_x - min_x + margin * 2).ceil].max
      height = [10, (max_y - min_y + margin * 2).ceil].max
      { x: x, y: y, width: width, height: height }
    end

    def self.generate_from_project(project, crop_to_shapes: false)
      w = (project["width"] || 960).to_i
      h = (project["height"] || 540).to_i
      shapes = ShapeGeometry.visible_ordered_shapes(project["shapes"] || [])
      bg_rgb = hex_to_rgb(project["backgroundColor"] || "#ffffff")
      offset_x = 0.0
      offset_y = 0.0

      if crop_to_shapes
        bbox = shapes_bounding_box(shapes, 10)
        w = bbox[:width]
        h = bbox[:height]
        offset_x = bbox[:x].to_f
        offset_y = bbox[:y].to_f
      end

      used = {
        pset: false,
        fillrect: false,
        fillcircle: false,
        fillrotellipse: false,
        filldonut: false,
        filltriangle: false,
        fillconvex: false,
        fillline: false,
        filldashedline: false,
        draw_text: false,
        draw_glyph_rot: false,
        alpha: false,
        clip: false
      }
      used_chars = {}
      draw_lines = []

      by_id = shapes.each_with_object({}) { |sh, map| map[sh["id"]] = sh if sh["id"] }
      is_descendant_of = lambda do |child, anc_id|
        cur = child
        visited = {}
        while cur && cur["parentId"]
          pid = cur["parentId"]
          return false if visited[pid]
          return true if pid == anc_id

          visited[pid] = true
          cur = by_id[pid]
        end
        false
      end
      clip_stack = []
      pop_clips_before_next = lambda do |next_shape|
        while !clip_stack.empty?
          top_id = clip_stack.last
          break if next_shape && is_descendant_of.call(next_shape, top_id)

          clip_stack.pop
          draw_lines << "  pop_clip"
        end
      end

      shapes.each do |s|
        pop_clips_before_next.call(s)

        is_math = s["type"] == "math_plot"
        is_frame = s["type"] == "frame"
        is_clip_frame = is_frame && !!s["clipContent"]
        has_stroke = s["strokeWidth"].to_f > 0 && s["stroke"].to_s.start_with?("#")
        is_open_stroke = !is_frame && !is_math && s["isPathClosed"] == false &&
                         s["points"].is_a?(Array) && s["points"].length >= 2 && has_stroke
        opacity = s["fillOpacity"].nil? ? 1.0 : s["fillOpacity"].to_f
        alpha = (1.0 - opacity).clamp(0.0, 1.0)
        has_fill = s["fill"] != "none" && s["fill"] != "transparent" && alpha < 0.995

        if is_frame
          next if !has_fill && !has_stroke && !is_clip_frame
        elsif !is_math
          next if !has_fill && !has_stroke && s["type"] != "text"
        end

        has_alpha = !is_math && (has_fill || is_open_stroke) && alpha >= 0.005
        used[:alpha] = true if has_alpha
        fill_rgb = hex_to_rgb(s["fill"] || "#3b82f6")
        color_args = if has_alpha
                       "#{fill_rgb[0]}, #{fill_rgb[1]}, #{fill_rgb[2]}, #{format('%.2f', alpha)}"
                     else
                       "#{fill_rgb[0]}, #{fill_rgb[1]}, #{fill_rgb[2]}"
                     end

        sx = s["x"].to_f - offset_x
        sy = s["y"].to_f - offset_y
        sw = s["width"].to_f
        sh = s["height"].to_f
        cx = (sx + sw / 2.0).round
        cy = (sy + sh / 2.0).round
        rot = (s["rotation"] || 0).to_f
        flip_h = !!s["flipH"]
        flip_v = !!s["flipV"]
        shear_x = (s["shearX"] || 0).to_f
        shear_y = (s["shearY"] || 0).to_f
        has_shear = shear_x != 0.0 || shear_y != 0.0
        label = (s["name"] || s["type"]).to_s.gsub(/[[:cntrl:]  ]/, " ")

        draw_lines << "  # #{label}"
        used[:pset] = true

        if is_open_stroke
          append_open_polyline_draw(draw_lines, used, s, sx, sy, sw, sh, offset_x, offset_y, has_alpha, alpha)
        else
          has_custom_pts = s["points"].is_a?(Array) && s["points"].length >= 3
          case s["type"]
          when "text"
            append_text_draw(draw_lines, used, used_chars, s, sx, sy, sw, sh, fill_rgb)
          when "ellipse", "circle"
            if has_shear || has_custom_pts
              append_polygon_draw(draw_lines, used, s, sx, sy, sw, sh, offset_x, offset_y, color_args, has_fill: has_fill, has_stroke: has_stroke)
            else
              if has_fill
                rx = (sw / 2.0).round
                ry = (sh / 2.0).round
                if rx == ry && rot == 0
                  used[:fillcircle] = true
                  draw_lines << "  fillcircle(#{cx}, #{cy}, #{rx}, #{color_args})"
                else
                  used[:fillrotellipse] = true
                  # 授業のfillrotellipseはラジアンで、正の角度は画面上で反時計回りになる。
                  # 編集画面の回転は時計回りが正なので、符号を反転して渡す。
                  theta = (-rot * Math::PI / 180.0).round(4)
                  draw_lines << "  fillrotellipse(#{cx}, #{cy}, #{rx}, #{ry}, #{theta}, #{color_args})"
                end
              end
              append_ellipse_stroke(draw_lines, used, s, sx, sy, sw, sh, rot) if has_stroke
            end
          when "donut"
            if has_shear || has_custom_pts
              append_polygon_draw(draw_lines, used, s, sx, sy, sw, sh, offset_x, offset_y, color_args, has_fill: has_fill, has_stroke: has_stroke)
            else
              if has_fill
                r1 = ([sw, sh].min / 2.0).round
                hole_ratio = (s.dig("adjustments", "holeRatio") || 0.5).to_f
                r2 = (r1 * hole_ratio).round
                used[:filldonut] = true
                draw_lines << "  filldonut(#{cx}, #{cy}, #{r1}, #{r2}, #{color_args})"
              end
              if has_stroke
                hole_ratio = (s.dig("adjustments", "holeRatio") || 0.5).to_f
                append_ellipse_stroke(draw_lines, used, s, sx, sy, sw, sh, rot)
                iw = sw * hole_ratio; ih = sh * hole_ratio
                append_ellipse_stroke(draw_lines, used, s, sx + (sw - iw) / 2.0, sy + (sh - ih) / 2.0, iw, ih, rot)
              end
            end
          when "triangle"
            if rot == 0 && !flip_h && !flip_v && !has_shear && !has_custom_pts
              top_x = (s.dig("adjustments", "topX") || 0.5).to_f
              tx = (sx + sw * top_x).round
              ty = sy.round
              bx1 = sx.round; by1 = (sy + sh).round
              bx2 = (sx + sw).round; by2 = (sy + sh).round
              if has_fill
                used[:filltriangle] = true
                used[:fillconvex] = true
                draw_lines << "  filltriangle(#{tx}, #{ty}, #{bx1}, #{by1}, #{bx2}, #{by2}, #{color_args})"
              end
              append_closed_pts_stroke(draw_lines, used, s, [[tx, ty], [bx2, by2], [bx1, by1]]) if has_stroke
            else
              append_polygon_draw(draw_lines, used, s, sx, sy, sw, sh, offset_x, offset_y, color_args, has_fill: has_fill, has_stroke: has_stroke)
            end
          when "rect"
            if rot == 0 && !flip_h && !flip_v && !has_shear && !has_custom_pts
              if has_fill
                used[:fillrect] = true
                draw_lines << rect_call(sx, sy, sw, sh, color_args)
              end
              if has_stroke
                pts = [[sx, sy], [sx + sw, sy], [sx + sw, sy + sh], [sx, sy + sh]]
                append_closed_pts_stroke(draw_lines, used, s, pts)
              end
            else
              append_polygon_draw(draw_lines, used, s, sx, sy, sw, sh, offset_x, offset_y, color_args, has_fill: has_fill, has_stroke: has_stroke)
            end
          when "math_plot"
            append_math_plot_draw(draw_lines, used, s, sx, sy, sw, sh, offset_x, offset_y, color_args, has_fill)
          when "frame"
            append_frame_draw(draw_lines, used, s, sx, sy, sw, sh, offset_x, offset_y, color_args, alpha)
          else
            append_polygon_draw(draw_lines, used, s, sx, sy, sw, sh, offset_x, offset_y, color_args, has_fill: has_fill, has_stroke: has_stroke)
          end
        end

        if is_clip_frame
          used[:clip] = true
          used[:pset] = true
          rad_clip = [(s["cornerRadius"] || 0).to_f, [sw, sh].min / 2.0].min
          if has_shear || flip_h || flip_v
            draw_lines << "  push_clip(#{sx.round(1)}, #{sy.round(1)}, #{sw.round(1)}, #{sh.round(1)}, #{rad_clip.round(1)}, #{rot.round(1)}, #{shear_x.round(2)}, #{shear_y.round(2)}, #{flip_h}, #{flip_v})"
          else
            draw_lines << "  push_clip(#{sx.round(1)}, #{sy.round(1)}, #{sw.round(1)}, #{sh.round(1)}, #{rad_clip.round(1)}, #{rot.round(1)})"
          end
          clip_stack.push(s["id"]) if s["id"]
        end
      end
      pop_clips_before_next.call(nil)

      a_param = used[:alpha] ? ", a = 0.0" : ""
      a_pass = used[:alpha] ? ", a" : ""
      code = []

      code << "Pixel = Struct.new(:r, :g, :b)"
      code << ""
      code << "$width = #{w}"
      code << "$height = #{h}"
      code << "$img = Array.new($height) do"
      code << "  Array.new($width) do"
      code << "    Pixel.new(#{bg_rgb[0]}, #{bg_rgb[1]}, #{bg_rgb[2]})"
      code << "  end"
      code << "end"
      code << ""

      if used[:clip]
        code << "$clips = []"
        code << ""
        code << "def push_clip(x, y, w, h, r = 0.0, rot_deg = 0.0, shear_x = 0.0, shear_y = 0.0, flip_h = false, flip_v = false)"
        code << "  cx = x + w / 2.0"
        code << "  cy = y + h / 2.0"
        code << "  hw = w / 2.0"
        code << "  hh = h / 2.0"
        code << "  rr = [r.to_f, hw, hh].min"
        code << "  rad = rot_deg.to_f * Math::PI / 180.0"
        code << "  tan_x = Math.tan(shear_x.to_f * Math::PI / 180.0)"
        code << "  tan_y = Math.tan(shear_y.to_f * Math::PI / 180.0)"
        code << "  fh = flip_h ? -1.0 : 1.0"
        code << "  fv = flip_v ? -1.0 : 1.0"
        code << "  $clips.push([cx, cy, hw, hh, rr, Math.cos(rad), Math.sin(rad), tan_x, tan_y, fh, fv])"
        code << "end"
        code << ""
        code << "def pop_clip"
        code << "  $clips.pop"
        code << "end"
        code << ""
        code << "def in_clip?(px, py, c)"
        code << "  cx, cy, hw, hh, r, cos_t, sin_t, tan_x, tan_y, fh, fv = c"
        code << "  dx = px - cx"
        code << "  dy = py - cy"
        code << "  rx = (dx * cos_t + dy * sin_t) * fh"
        code << "  ry = (-dx * sin_t + dy * cos_t) * fv"
        code << "  if tan_x != 0.0 || tan_y != 0.0"
        code << "    det = 1.0 - tan_x * tan_y"
        code << "    return false if det.abs < 1e-9"
        code << "    lx = (rx - tan_x * ry) / det"
        code << "    ly = (-tan_y * rx + ry) / det"
        code << "  else"
        code << "    lx = rx"
        code << "    ly = ry"
        code << "  end"
        code << "  ax = lx.abs"
        code << "  ay = ly.abs"
        code << "  return false if ax > hw || ay > hh"
        code << "  if r > 0.0"
        code << "    ix = hw - r"
        code << "    iy = hh - r"
        code << "    if ax > ix && ay > iy"
        code << "      return false if (ax - ix)**2 + (ay - iy)**2 > r**2"
        code << "    end"
        code << "  end"
        code << "  true"
        code << "end"
        code << ""
      end

      # 補助メソッドは「#06演習ガイド」の定義をそのまま出す。
      # 違いは画像の大きさを$width・$heightで持つことと、クリップ（push_clip）への対応だけ。
      if used[:pset]
        code << "def pset(x, y, r=0, g=0, b=0, a=0.0)"
        code << "  if x < 0 || x >= $width || y < 0 || y >= $height then return end"
        code << "  if !$clips.all? { |c| in_clip?(x, y, c) } then return end" if used[:clip]
        code << "  $img[y][x].r = ($img[y][x].r * a + r * (1.0 - a)).to_i"
        code << "  $img[y][x].g = ($img[y][x].g * a + g * (1.0 - a)).to_i"
        code << "  $img[y][x].b = ($img[y][x].b * a + b * (1.0 - a)).to_i"
        code << "end"
        code << ""
      end

      code << "def writeimage(name)"
      code << "  open(name, \"wb\") do |f|"
      code << "    f.puts(\"P6\\n\#{$width} \#{$height}\\n255\")"
      code << "    $img.each do |a|"
      code << "      a.each do |p| f.write(p.to_a.pack(\"ccc\")) end"
      code << "    end"
      code << "  end"
      code << "end"
      code << ""

      if used[:fillcircle]
        code << "def fillcircle(x, y, rad, r=0, g=0, b=0, a=0.0)"
        code << "  j0 = (y-rad).to_i; j1 = (y+rad).to_i"
        code << "  i0 = (x-rad).to_i; i1 = (x+rad).to_i"
        code << "  j0.step(j1) do |j|"
        code << "    i0.step(i1) do |i|"
        code << "      if (i-x)**2+(j-y)**2<rad**2"
        code << "        if block_given? then yield(i,j) else pset(i,j,r,g,b,a) end"
        code << "      end"
        code << "    end"
        code << "  end"
        code << "end"
        code << ""
      end

      if used[:filldonut]
        code << "def filldonut(x, y, r1, r2, r=0, g=0, b=0, a=0.0)"
        code << "  j0 = (y-r1).to_i; j1 = (y+r1).to_i"
        code << "  i0 = (x-r1).to_i; i1 = (x+r1).to_i"
        code << "  j0.step(j1) do |j|"
        code << "    i0.step(i1) do |i|"
        code << "      d2 = (i-x)**2+(j-y)**2"
        code << "      if r2**2 <= d2 && d2 <= r1**2"
        code << "        if block_given? then yield(i,j) else pset(i,j,r,g,b,a) end"
        code << "      end"
        code << "    end"
        code << "  end"
        code << "end"
        code << ""
      end

      if used[:fillrect]
        code << "def fillrect(x, y, w, h, r=0, g=0, b=0, a=0.0)"
        code << "  j0 = (y-0.5*h).to_i; j1 = (y+0.5*h).to_i"
        code << "  i0 = (x-0.5*w).to_i; i1 = (x+0.5*w).to_i"
        code << "  j0.step(j1) do |j|"
        code << "    i0.step(i1) do |i|"
        code << "      if block_given? then yield(i,j) else pset(i,j,r,g,b,a) end"
        code << "    end"
        code << "  end"
        code << "end"
        code << ""
      end

      if used[:fillrotellipse]
        code << "def fillrotellipse(x, y, rx, ry, theta, r=0, g=0, b=0, a=0.0)"
        code << "  d = (if rx > ry then rx else ry end)"
        code << "  j0 = (y-d).to_i; j1 = (y+d).to_i"
        code << "  i0 = (x-d).to_i; i1 = (x+d).to_i"
        code << "  j0.step(j1) do |j|"
        code << "    i0.step(i1) do |i|"
        code << "      dx = i - x; dy = j - y;"
        code << "      px = dx*Math.cos(theta) - dy*Math.sin(theta)"
        code << "      py = dx*Math.sin(theta) + dy*Math.cos(theta)"
        code << "      if (px/rx)**2 + (py/ry)**2 < 1.0"
        code << "        if block_given? then yield(i,j) else pset(i,j,r,g,b,a) end"
        code << "      end"
        code << "    end"
        code << "  end"
        code << "end"
        code << ""
      end

      if used[:filltriangle]
        code << "def filltriangle(x0, y0, x1, y1, x2, y2, r = 0, g = 0, b = 0, a = 0.0)"
        code << "  if block_given?"
        code << "    fillconvex([x0, x1, x2, x0], [y0, y1, y2, y0]) do |x,y| yield(x,y) end"
        code << "    fillconvex([x0, x2, x1, x0], [y0, y2, y1, y0]) do |x,y| yield(x,y) end"
        code << "  else"
        code << "    fillconvex([x0, x1, x2, x0], [y0, y1, y2, y0], r, g, b, a)"
        code << "    fillconvex([x0, x2, x1, x0], [y0, y2, y1, y0], r, g, b, a)"
        code << "  end"
        code << "end"
        code << ""
      end

      if used[:fillconvex]
        code << "def fillconvex(ax, ay, r=0, g=0, b=0, a=0.0)"
        code << "  xmax = ax.max.to_i; xmin = ax.min.to_i"
        code << "  ymax = ay.max.to_i; ymin = ay.min.to_i"
        code << "  ymin.step(ymax) do |j|"
        code << "    xmin.step(xmax) do |i|"
        code << "      if isinside(i, j, ax, ay)"
        code << "        if block_given? then yield(i,j) else pset(i,j,r,g,b,a) end"
        code << "      end"
        code << "    end"
        code << "  end"
        code << "end"
        code << ""
        code << "def isinside(x, y, ax, ay)"
        code << "  (ax.length-1).times do |i|"
        code << "    if oprod(ax[i+1]-ax[i],ay[i+1]-ay[i],x-ax[i],y-ay[i])<0"
        code << "      return false"
        code << "    end"
        code << "  end"
        code << "  return true"
        code << "end"
        code << ""
        code << "def oprod(a, b, c, d)"
        code << "  return a*d - b*c;"
        code << "end"
        code << ""
      end

      if used[:fillline]
        # 長さ0の線分はnで0除算になるため、ガイドの定義に1行だけ足して飛ばす
        code << "def fillline(x0, y0, x1, y1, w, r=0, g=0, b=0, a=0.0)"
        code << "  if x0 == x1 && y0 == y1 then return end"
        code << "  dx = y1-y0; dy = x0-x1; n = 0.5*w / Math.sqrt(dx**2 + dy**2)"
        code << "  dx = dx * n; dy = dy * n"
        code << "  if block_given?"
        code << "    fillconvex([x0-dx, x0+dx, x1+dx, x1-dx, x0-dx],"
        code << "               [y0-dy, y0+dy, y1+dy, y1-dy, y0-dy]) do |x,y| yield(x,y) end"
        code << "  else"
        code << "    fillconvex([x0-dx, x0+dx, x1+dx, x1-dx, x0-dx],"
        code << "               [y0-dy, y0+dy, y1+dy, y1-dy, y0-dy], r, g, b, a)"
        code << "  end"
        code << "end"
        code << ""
      end

      if used[:filldashedline]
        code << "def filldashedline(x0, y0, x1, y1, w, on_len, off_len, r = 0, g = 0, b = 0#{a_param})"
        code << "  dx = x1 - x0; dy = y1 - y0"
        code << "  len = Math.sqrt(dx**2 + dy**2)"
        code << "  return if len == 0"
        code << "  pos = 0.0"
        code << "  while pos < len"
        code << "    seg_end = [pos + on_len, len].min"
        code << "    t0 = pos / len; t1 = seg_end / len"
        code << "    fillline(x0 + dx * t0, y0 + dy * t0, x0 + dx * t1, y0 + dy * t1, w, r, g, b#{a_pass})"
        code << "    pos += on_len + off_len"
        code << "  end"
        code << "end"
        code << ""
      end

      if used[:draw_text] || used[:draw_glyph_rot]
        char_list = used_chars.keys.sort
        code << "$font_5x7 = {"
        char_list.each_with_index do |ch, idx|
          comma = idx < char_list.length - 1 ? "," : ""
          code << "  #{ch.inspect} =>#{FONT_5X7[ch]}#{comma}"
        end
        code << "}"
        code << ""
      end

      if used[:draw_text]
        code << "def draw_text(x0, y0, str, r = 0, g = 0, b = 0, scale = 1)"
        code << "  str.upcase.each_char.with_index do |ch, idx|"
        code << "    pattern = $font_5x7[ch] || $font_5x7[\"□\"] || $font_5x7[\" \"]"
        code << "    next unless pattern"
        code << "    cx = x0 + idx * (6 * scale)"
        code << "    7.times do |row|"
        code << "      bits = pattern[row]"
        code << "      5.times do |col|"
        code << "        if (bits & (1 << (4 - col))) != 0 then fillrect(cx + col * scale + (scale - 1) / 2.0, y0 + row * scale + (scale - 1) / 2.0, scale - 1, scale - 1, r, g, b) end"
        code << "      end"
        code << "    end"
        code << "  end"
        code << "end"
        code << ""
      end

      if used[:draw_glyph_rot]
        code << "def draw_glyph_rot(cx, cy, ch, r, g, b, sx, sy, rot_deg)"
        code << "  pattern = $font_5x7[ch.upcase] || $font_5x7[\"□\"] || $font_5x7[\" \"]"
        code << "  return unless pattern"
        code << "  rad = rot_deg * Math::PI / 180.0"
        code << "  cos_t = Math.cos(rad); sin_t = Math.sin(rad)"
        code << "  7.times do |row|"
        code << "    bits = pattern[row]"
        code << "    5.times do |col|"
        code << "      next if (bits & (1 << (4 - col))) == 0"
        code << "      lx = (col - 2.0) * sx; ly = (row - 3.0) * sy"
        code << "      hw = sx * 0.5; hh = sy * 0.5"
        code << "      pts = [[lx - hw, ly - hh], [lx + hw, ly - hh], [lx + hw, ly + hh], [lx - hw, ly + hh]].map do |px, py|"
        code << "        [cx + px * cos_t - py * sin_t, cy + px * sin_t + py * cos_t]"
        code << "      end"
        code << "      fillconvex([pts[0][0], pts[1][0], pts[2][0], pts[3][0], pts[0][0]], [pts[0][1], pts[1][1], pts[2][1], pts[3][1], pts[0][1]], r, g, b)"
        code << "    end"
        code << "  end"
        code << "end"
        code << ""
      end

      code << "def mypicture"
      draw_lines.each { |line| code << line }
      code << "  writeimage(\"t.ppm\")"
      code << "end"
      code << ""
      code << "mypicture"
      code.join("\n")
    end

    def self.emit_line(draw_lines, used, x0, y0, x1, y1, lw, color_args, dash = "solid")
      return if (x0 - x1).abs < 0.05 && (y0 - y1).abs < 0.05

      used[:fillconvex] = true
      if dash == "dashed" || dash == "dotted"
        used[:filldashedline] = true
        used[:fillline] = true
        on_len, off_len = dash == "dashed" ? [8.0, 5.0] : [3.0, 3.0]
        draw_lines << "  filldashedline(#{x0.round(1)}, #{y0.round(1)}, #{x1.round(1)}, #{y1.round(1)}, #{lw}, #{on_len}, #{off_len}, #{color_args})"
      else
        used[:fillline] = true
        draw_lines << "  fillline(#{x0.round(1)}, #{y0.round(1)}, #{x1.round(1)}, #{y1.round(1)}, #{lw}, #{color_args})"
      end
    end

    def self.stroke_args_for(s)
      s_rgb = hex_to_rgb(s["stroke"])
      "#{s_rgb[0]}, #{s_rgb[1]}, #{s_rgb[2]}"
    end

    def self.append_closed_pts_stroke(draw_lines, used, s, pts)
      return if pts.length < 2

      lw = [1.0, s["strokeWidth"].to_f].max.round(1)
      s_args = stroke_args_for(s)
      dash = (s["strokeDash"] || "solid").to_s
      pts.each_with_index do |p1, idx|
        p2 = pts[(idx + 1) % pts.length]
        emit_line(draw_lines, used, p1[0], p1[1], p2[0], p2[1], lw, s_args, dash)
      end
    end

    def self.append_ellipse_stroke(draw_lines, used, s, sx, sy, sw, sh, rot_deg)
      rx = sw / 2.0
      ry = sh / 2.0
      cx = sx + rx
      cy = sy + ry
      rad = rot_deg * Math::PI / 180.0
      cos_t = Math.cos(rad)
      sin_t = Math.sin(rad)
      steps = 36
      pts = (0...steps).map do |k|
        a = 2.0 * Math::PI * k / steps
        lx = rx * Math.cos(a)
        ly = ry * Math.sin(a)
        [cx + lx * cos_t - ly * sin_t, cy + lx * sin_t + ly * cos_t]
      end
      append_closed_pts_stroke(draw_lines, used, s, pts)
    end

    def self.append_text_draw(draw_lines, used, used_chars, s, sx, sy, sw, sh, fill_rgb)
      raw_text = s["text"].to_s
      font_size = (s["fontSize"] || 28).to_f
      scale = [1, (font_size / 10.0).round].max
      rot = (s["rotation"] || 0).to_f
      flip_h = !!s["flipH"]
      flip_v = !!s["flipV"]
      shear_x = (s["shearX"] || 0).to_f
      shear_y = (s["shearY"] || 0).to_f
      warp = (s["textWarp"] || "none").to_s

      raw_text.upcase.each_char do |ch|
        next if ch == "\n"

        used_chars[FONT_5X7.key?(ch) ? ch : "□"] = true
      end
      used_chars[" "] = true if used_chars.empty?

      if warp == "none" && rot == 0.0 && !flip_h && !flip_v && shear_x == 0.0 && shear_y == 0.0 && !raw_text.include?("\n")
        used[:draw_text] = true
        used[:fillrect] = true
        draw_lines << "  draw_text(#{sx.round}, #{sy.round}, #{raw_text.to_s.inspect}, #{fill_rgb[0]}, #{fill_rgb[1]}, #{fill_rgb[2]}, #{scale})"
        return
      end

      used[:draw_glyph_rot] = true
      used[:fillconvex] = true
      rgb_args = "#{fill_rgb[0]}, #{fill_rgb[1]}, #{fill_rgb[2]}"
      shape_cx = sx + sw / 2.0
      shape_cy = sy + sh / 2.0
      shape_rad = rot * Math::PI / 180.0
      s_cos = Math.cos(shape_rad)
      s_sin = Math.sin(shape_rad)
      tan_x = Math.tan(shear_x * Math::PI / 180.0)
      tan_y = Math.tan(shear_y * Math::PI / 180.0)
      fh = flip_h ? -1.0 : 1.0
      fv = flip_v ? -1.0 : 1.0

      emit_glyph = lambda do |ch, lx, ly, sy_factor, char_rot|
        dx = lx - sw / 2.0
        dy = ly - sh / 2.0
        if tan_x != 0.0 || tan_y != 0.0
          sh_x = dx + tan_x * dy
          sh_y = tan_y * dx + dy
          dx = sh_x; dy = sh_y
        end
        dx *= fh
        dy *= fv
        wx = shape_cx + dx * s_cos - dy * s_sin
        wy = shape_cy + dx * s_sin + dy * s_cos
        total_rot = rot + char_rot
        esc = Font5x7.escape_ruby_key(ch)
        draw_lines << "  draw_glyph_rot(#{wx.round(1)}, #{wy.round(1)}, \"#{esc}\", #{rgb_args}, #{scale}, #{(scale * sy_factor).round(2)}, #{total_rot.round(1)})"
      end

      if warp == "none"
        lines = raw_text.split("\n", -1)
        line_h = 9.0 * scale
        start_y = (sh - lines.length * line_h) / 2.0 + 3.5 * scale
        align = (s["textAlign"] || "center").to_s
        lines.each_with_index do |line, li|
          line_w = line.length * 6.0 * scale
          lx0 = case align
                when "left" then 10.0
                when "right" then sw - 10.0 - line_w
                else (sw - line_w) / 2.0
                end
          ly0 = start_y + li * line_h
          line.chars.each_with_index do |ch, ci|
            emit_glyph.call(ch, lx0 + ci * 6.0 * scale + 2.5 * scale, ly0, 1.0, 0.0)
          end
        end
      else
        chars = raw_text.chars
        count = chars.length
        chars.each_with_index do |ch, i|
          u = count == 1 ? 0.5 : i.to_f / (count - 1)
          cx = sw * u
          cy = sh / 2.0
          ang = 0.0
          sy_f = 1.0
          case warp
          when "arch_up"
            arc = (u - 0.5) * (Math::PI * 0.65); r = sw * 0.75
            cx = sw / 2.0 + r * Math.sin(arc); cy = sh * 0.8 - r * Math.cos(arc) + r
            ang = arc * 180.0 / Math::PI
          when "arch_down"
            arc = (u - 0.5) * (Math::PI * 0.65); r = sw * 0.75
            cx = sw / 2.0 + r * Math.sin(arc); cy = sh * 0.2 + r * Math.cos(arc) - r
            ang = -arc * 180.0 / Math::PI
          when "circle"
            arc = -Math::PI / 2.0 + (u - 0.5) * (2.0 * Math::PI * 0.85); r = [sw, sh].min * 0.4
            cx = sw / 2.0 + r * Math.cos(arc); cy = sh / 2.0 + r * Math.sin(arc)
            ang = (arc + Math::PI / 2.0) * 180.0 / Math::PI
          when "wave"
            cy = sh / 2.0 + Math.sin(u * 2.0 * Math::PI) * (sh * 0.3)
            ang = Math.cos(u * 2.0 * Math::PI) * 0.45 * 180.0 / Math::PI
          when "triangle_up"
            sy_f = 0.5 + (1.0 - 2.0 * (u - 0.5).abs) * 0.9
          when "triangle_down"
            sy_f = 0.5 + (2.0 * (u - 0.5).abs) * 0.9
          when "inflate"
            sy_f = 0.7 + Math.sin(u * Math::PI) * 0.8
          when "deflate"
            sy_f = 1.0 - Math.sin(u * Math::PI) * 0.6
          when "fade_right"
            sy_f = 0.4 + u * 1.0
          when "fade_left"
            sy_f = 1.4 - u * 1.0
          end
          emit_glyph.call(ch, cx, cy, sy_f, ang)
        end
      end
    end

    def self.append_math_plot_draw(draw_lines, used, s, sx, sy, sw, sh, offset_x, offset_y, color_args, has_fill)
      cfg = s["mathConfig"] || {}
      expr_str = (cfg["expr"] || "sin(x)").to_s
      begin
        ruby_expr = MathFormula.to_ruby_expr(MathFormula.parse(expr_str, allowed_vars: %w[x]))
      rescue MathFormula::FormulaError
        draw_lines << "  # 数式エラーのためスキップ"
        return
      end

      x_min = MathFormula.eval_scalar(cfg["xMin"], -4.0)
      x_max = MathFormula.eval_scalar(cfg["xMax"], 4.0)
      y_min = MathFormula.eval_scalar(cfg["yMin"], -3.0)
      y_max = MathFormula.eval_scalar(cfg["yMax"], 3.0)
      steps = [[(cfg["steps"] || 120).to_i, 10].max, 600].min
      lw = [[(cfg["lineWidth"] || 3).to_f, 1.0].max, 20.0].min
      show_axes = cfg["showAxes"] == true
      show_frame = cfg["showFrame"] == true

      rot = (s["rotation"] || 0).to_f
      flip_h = !!s["flipH"]
      flip_v = !!s["flipV"]
      shear_x = (s["shearX"] || 0).to_f
      shear_y = (s["shearY"] || 0).to_f
      has_xform = rot != 0.0 || flip_h || flip_v || shear_x != 0.0 || shear_y != 0.0

      used[:fillline] = true
      used[:fillconvex] = true

      xf = lambda do |lx, ly|
        ShapeGeometry.transform_local_points([[lx, ly]], s, offset_x: offset_x, offset_y: offset_y)[0]
      end

      if has_fill
        if has_xform
          pts = ShapeGeometry.transform_local_points([[0.0, 0.0], [sw, 0.0], [sw, sh], [0.0, sh]], s, offset_x: offset_x, offset_y: offset_y)
          append_polygon_fill(draw_lines, used, pts, color_args)
        else
          used[:fillrect] = true
          draw_lines << rect_call(sx, sy, sw, sh, color_args)
        end
      end

      line_hex = cfg["lineColor"].to_s
      line_hex = s["stroke"].to_s unless line_hex.start_with?("#")
      line_hex = "#2563eb" unless line_hex.start_with?("#")
      stroke_rgb = hex_to_rgb(line_hex)
      stroke_args = "#{stroke_rgb[0]}, #{stroke_rgb[1]}, #{stroke_rgb[2]}"

      if show_frame || (s["strokeWidth"].to_f > 0 && s["stroke"].to_s.start_with?("#"))
        fw = s["strokeWidth"].to_f > 0 ? s["strokeWidth"].to_f : 1
        f_hex = s["stroke"].to_s.start_with?("#") ? s["stroke"].to_s : "#94a3b8"
        f_rgb = hex_to_rgb(f_hex)
        f_args = "#{f_rgb[0]}, #{f_rgb[1]}, #{f_rgb[2]}"
        [[0.0, 0.0, sw, 0.0], [sw, 0.0, sw, sh], [sw, sh, 0.0, sh], [0.0, sh, 0.0, 0.0]].each do |lx0, ly0, lx1, ly1|
          p0 = xf.call(lx0, ly0)
          p1 = xf.call(lx1, ly1)
          draw_lines << "  fillline(#{p0[0].round(1)}, #{p0[1].round(1)}, #{p1[0].round(1)}, #{p1[1].round(1)}, #{fw}, #{f_args})"
        end
      end

      if show_axes && x_min < x_max && y_min < y_max
        if x_min <= 0.0 && x_max >= 0.0
          ax_l = (0.0 - x_min) / (x_max - x_min) * sw
          p0 = xf.call(ax_l, 0.0)
          p1 = xf.call(ax_l, sh)
          draw_lines << "  fillline(#{p0[0].round(1)}, #{p0[1].round(1)}, #{p1[0].round(1)}, #{p1[1].round(1)}, 1, 148, 163, 184)"
        end
        if y_min <= 0.0 && y_max >= 0.0
          ay_l = (y_max - 0.0) / (y_max - y_min) * sh
          p0 = xf.call(0.0, ay_l)
          p1 = xf.call(sw, ay_l)
          draw_lines << "  fillline(#{p0[0].round(1)}, #{p0[1].round(1)}, #{p1[0].round(1)}, #{p1[1].round(1)}, 1, 148, 163, 184)"
        end
      end

      gw = sw.round(1); gh = sh.round(1)
      draw_lines << "  xmin = #{x_min}; xmax = #{x_max}; ymin = #{y_min}; ymax = #{y_max}; n = #{steps}"
      draw_lines << "  prev_px = nil; prev_py = nil; prev_ly = nil"
      if has_xform
        cx_w = (sx + sw / 2.0).round(2)
        cy_w = (sy + sh / 2.0).round(2)
        rad = rot * Math::PI / 180.0
        cos_r = Math.cos(rad).round(6)
        sin_r = Math.sin(rad).round(6)
        tan_x = Math.tan(shear_x * Math::PI / 180.0).round(6)
        tan_y = Math.tan(shear_y * Math::PI / 180.0).round(6)
        fh = flip_h ? -1.0 : 1.0
        fv = flip_v ? -1.0 : 1.0
        draw_lines << "  0.step(n) do |k|"
        draw_lines << "    x = xmin + (xmax - xmin) * k.to_f / n"
        draw_lines << "    y = #{ruby_expr}"
        draw_lines << "    if y.finite?"
        draw_lines << "      lx = (x - xmin) / (xmax - xmin) * #{gw} - #{(sw / 2.0).round(2)}"
        draw_lines << "      ly_raw = (ymax - y) / (ymax - ymin) * #{gh}"
        draw_lines << "      if ly_raw >= 0.0 && ly_raw <= #{gh}"
        draw_lines << "        ly = ly_raw - #{(sh / 2.0).round(2)}"
        draw_lines << "        sx_l = (lx + #{tan_x} * ly) * #{fh}; sy_l = (#{tan_y} * lx + ly) * #{fv}"
        draw_lines << "        px = #{cx_w} + sx_l * #{cos_r} - sy_l * #{sin_r}"
        draw_lines << "        py = #{cy_w} + sx_l * #{sin_r} + sy_l * #{cos_r}"
        draw_lines << "        fillline(prev_px, prev_py, px, py, #{lw}, #{stroke_args}) if prev_px && prev_py && (ly_raw - prev_ly).abs < #{(gh * 0.85).round(1)}"
        draw_lines << "        prev_px = px; prev_py = py; prev_ly = ly_raw"
        draw_lines << "      else"
        draw_lines << "        prev_px = nil; prev_py = nil; prev_ly = nil"
        draw_lines << "      end"
        draw_lines << "    else"
        draw_lines << "      prev_px = nil; prev_py = nil; prev_ly = nil"
        draw_lines << "    end"
        draw_lines << "  end"
      else
        gx = sx.round(1); gy = sy.round(1)
        draw_lines << "  0.step(n) do |k|"
        draw_lines << "    x = xmin + (xmax - xmin) * k.to_f / n"
        draw_lines << "    y = #{ruby_expr}"
        draw_lines << "    if y.finite?"
        draw_lines << "      px = #{gx} + (x - xmin) / (xmax - xmin) * #{gw}"
        draw_lines << "      py = #{gy} + (ymax - y) / (ymax - ymin) * #{gh}"
        draw_lines << "      if py >= #{gy} && py <= #{(gy + gh).round(1)}"
        draw_lines << "        fillline(prev_px, prev_py, px, py, #{lw}, #{stroke_args}) if prev_px && prev_py && (py - prev_py).abs < #{(gh * 0.85).round(1)}"
        draw_lines << "        prev_px = px; prev_py = py"
        draw_lines << "      else"
        draw_lines << "        prev_px = nil; prev_py = nil"
        draw_lines << "      end"
        draw_lines << "    else"
        draw_lines << "      prev_px = nil; prev_py = nil"
        draw_lines << "    end"
        draw_lines << "  end"
      end
    end

    def self.append_frame_draw(draw_lines, used, s, sx, sy, sw, sh, offset_x, offset_y, color_args, alpha)
      has_fill = s["fill"] != "none" && s["fill"] != "transparent" && alpha < 0.995
      radius = [(s["cornerRadius"] || 0).to_f, [sw, sh].min / 2.0].min
      rot = (s["rotation"] || 0).to_f
      flip_h = !!s["flipH"]
      flip_v = !!s["flipV"]
      shear_x = (s["shearX"] || 0).to_f
      shear_y = (s["shearY"] || 0).to_f
      fw = s["strokeWidth"].to_f
      has_stroke = fw > 0 && s["stroke"].to_s.start_with?("#")
      is_axis_box = radius <= 0.5 && rot == 0 && !flip_h && !flip_v && shear_x == 0 && shear_y == 0
      dash = (s["strokeDash"] || "solid").to_s

      pts = nil
      if (has_fill || has_stroke) && !is_axis_box
        local_pts = rounded_rect_points(0.0, 0.0, sw, sh, radius)
        pts = ShapeGeometry.transform_local_points(local_pts, s, offset_x: offset_x, offset_y: offset_y)
        pts.reverse! if flip_h ^ flip_v
      end

      if has_fill
        if is_axis_box
          used[:fillrect] = true
          draw_lines << rect_call(sx, sy, sw, sh, color_args)
        else
          append_polygon_fill(draw_lines, used, pts, color_args)
        end
      end

      if has_stroke
        f_args = stroke_args_for(s)
        if is_axis_box
          gx = sx; gy = sy; gw = sw; gh = sh
          [[gx, gy, gx + gw, gy], [gx + gw, gy, gx + gw, gy + gh], [gx + gw, gy + gh, gx, gy + gh], [gx, gy + gh, gx, gy]].each do |x0, y0, x1, y1|
            emit_line(draw_lines, used, x0, y0, x1, y1, fw, f_args, dash)
          end
        else
          pts.each_with_index do |p1, idx|
            p2 = pts[(idx + 1) % pts.length]
            emit_line(draw_lines, used, p1[0], p1[1], p2[0], p2[1], fw, f_args, dash)
          end
        end
      end
    end

    def self.transformed_rounded_rect_points(sx, sy, sw, sh, radius, rot, flip_h, flip_v)
      pts = rounded_rect_points(0.0, 0.0, sw, sh, radius)
      hc_x = sw / 2.0
      hc_y = sh / 2.0
      rad = rot * Math::PI / 180.0
      cos_t = Math.cos(rad)
      sin_t = Math.sin(rad)
      res = pts.map do |px, py|
        dx = px - hc_x
        dy = py - hc_y
        dx = -dx if flip_h
        dy = -dy if flip_v
        rx = dx * cos_t - dy * sin_t
        ry = dx * sin_t + dy * cos_t
        [sx + hc_x + rx, sy + hc_y + ry]
      end
      res.reverse! if flip_h ^ flip_v
      res
    end

    def self.rounded_rect_points(x, y, w, h, r)
      return [[x, y], [x + w, y], [x + w, y + h], [x, y + h]] if r <= 0.5

      pts = []
      steps = 6
      corners = [
        [x + w - r, y + r, -Math::PI / 2.0, 0.0],
        [x + w - r, y + h - r, 0.0, Math::PI / 2.0],
        [x + r, y + h - r, Math::PI / 2.0, Math::PI],
        [x + r, y + r, Math::PI, 3.0 * Math::PI / 2.0]
      ]
      corners.each do |cx, cy, a0, a1|
        0.step(steps) do |k|
          ang = a0 + (a1 - a0) * k.to_f / steps
          pts << [cx + Math.cos(ang) * r, cy + Math.sin(ang) * r]
        end
      end
      pts
    end

    def self.append_open_polyline_draw(draw_lines, used, s, sx, sy, sw, sh, offset_x, offset_y, has_alpha, alpha)
      pts = extract_polygon_points(s, sx, sy, sw, sh, offset_x, offset_y)
      return if pts.length < 2

      lw = [1.0, s["strokeWidth"].to_f].max.round(1)
      s_rgb = hex_to_rgb(s["stroke"])
      s_args = if has_alpha
                 "#{s_rgb[0]}, #{s_rgb[1]}, #{s_rgb[2]}, #{format('%.2f', alpha)}"
               else
                 "#{s_rgb[0]}, #{s_rgb[1]}, #{s_rgb[2]}"
               end
      dash = (s["strokeDash"] || "solid").to_s
      (pts.length - 1).times do |idx|
        p1 = pts[idx]
        p2 = pts[idx + 1]
        emit_line(draw_lines, used, p1[0], p1[1], p2[0], p2[1], lw, s_args, dash)
      end
    end

    def self.append_polygon_draw(draw_lines, used, s, sx, sy, sw, sh, offset_x, offset_y, color_args, has_fill: true, has_stroke: false)
      pts = extract_polygon_points(s, sx, sy, sw, sh, offset_x, offset_y)
      if has_fill
        if pts.length >= 3
          append_polygon_fill(draw_lines, used, pts, color_args)
        else
          used[:fillrect] = true
          draw_lines << rect_call(sx, sy, sw, sh, color_args)
        end
      end
      append_closed_pts_stroke(draw_lines, used, s, pts) if has_stroke && pts.length >= 2
    end

    def self.extract_polygon_points(s, sx, sy, sw, sh, offset_x, offset_y)
      if s["polygonPoints"].is_a?(Array) && s["polygonPoints"].length >= 3
        return s["polygonPoints"].map { |p| [p[0].to_f - offset_x, p[1].to_f - offset_y] }
      end

      if s["points"].is_a?(Array) && s["points"].length >= 2
        local_pts = s["points"].map { |p| [p["x"].to_f, p["y"].to_f] }
        return ShapeGeometry.transform_local_points(local_pts, s, offset_x: offset_x, offset_y: offset_y)
      end

      subpaths = ShapeGeometry.world_subpaths_for(s, offset_x: offset_x, offset_y: offset_y)
      return subpaths[0][:points] if !subpaths.empty? && subpaths[0][:points].length >= 3

      ShapeGeometry.transform_local_points([[0.0, 0.0], [sw, 0.0], [sw, sh], [0.0, sh]], s, offset_x: offset_x, offset_y: offset_y)
    end
    
    # 多角形を授業のfillconvex・filltriangleで塗る行を出す。
    # 授業のisinsideは、各辺に対して外積oprodが0以上の点を内側とみなす。
    # そのため、正しく塗れるのは凸の多角形で、頂点が決まった向きに並ぶときだけである。
    # 凸なら向きを揃えてfillconvexを1回、凹んでいれば凸の部分に分けて塗る。
    def self.append_polygon_fill(draw_lines, used, pts, color_args)
      poly = clean_polygon(pts)
      return if poly.length < 3
    
      poly = poly.reverse if signed_area(poly) < 0
      pieces = convex?(poly) ? [poly] : convex_pieces(poly)
      pieces.each do |piece|
        if piece.length == 3
          used[:filltriangle] = true
          used[:fillconvex] = true
          coords = piece.flat_map { |p| [num(p[0]), num(p[1])] }.join(", ")
          draw_lines << "  filltriangle(#{coords}, #{color_args})"
        else
          used[:fillconvex] = true
          ax = (piece + [piece[0]]).map { |p| num(p[0]) }.join(", ")
          ay = (piece + [piece[0]]).map { |p| num(p[1]) }.join(", ")
          draw_lines << "  fillconvex([#{ax}], [#{ay}], #{color_args})"
        end
      end
    end
    
    # 小数第1位に丸めたうえで、重なった頂点と一直線上の頂点を除く
    def self.clean_polygon(pts)
      poly = pts.map { |p| [p[0].to_f.round(1), p[1].to_f.round(1)] }
      poly.pop while poly.length > 1 && poly.last == poly.first
      poly = poly.each_with_object([]) { |p, acc| acc << p unless acc.last == p }
      loop do
        break if poly.length < 3
    
        idx = (0...poly.length).find do |i|
          a = poly[i - 1]; b = poly[i]; c = poly[(i + 1) % poly.length]
          cross(a, b, c).abs < 1e-6
        end
        break unless idx
    
        poly.delete_at(idx)
      end
      poly
    end
    
    def self.cross(a, b, c)
      (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0])
    end
    
    # isinsideと同じ外積の向きで正になる面積（画面座標のまま計算する）
    def self.signed_area(poly)
      sum = 0.0
      poly.each_with_index do |p, i|
        q = poly[(i + 1) % poly.length]
        sum += p[0] * q[1] - q[0] * p[1]
      end
      sum / 2.0
    end
    
    def self.convex?(poly)
      poly.each_index.all? do |i|
        cross(poly[i - 1], poly[i], poly[(i + 1) % poly.length]) >= -1e-9
      end
    end
    
    # 耳を切り取る方法で三角形に分け、隣り合う部分を凸のまま合わせられる限りまとめる
    def self.convex_pieces(poly)
      tris = triangulate(poly)
      pieces = tris.map(&:dup)
      merged = true
      while merged
        merged = false
        pieces.each_index do |i|
          ((i + 1)...pieces.length).each do |j|
            joined = join_pieces(pieces[i], pieces[j])
            next unless joined && convex?(joined)
    
            pieces[i] = joined
            pieces.delete_at(j)
            merged = true
            break
          end
          break if merged
        end
      end
      pieces
    end
    
    # 2つの凸の部分が辺を1本共有していれば、その辺を消してつないだ多角形を返す
    def self.join_pieces(a, b)
      a.each_index do |i|
        p = a[i]; q = a[(i + 1) % a.length]
        j = b.index(q)
        next unless j && b[(j + 1) % b.length] == p
    
        rest_b = (1..(b.length - 2)).map { |k| b[(j + 1 + k) % b.length] }
        return a[0..i] + rest_b + a[(i + 1)..]
      end
      nil
    end
    
    def self.triangulate(poly)
      verts = poly.dup
      tris = []
      guard = 0
      while verts.length > 3 && guard < 10_000
        guard += 1
        ear = (0...verts.length).find do |i|
          a = verts[i - 1]; b = verts[i]; c = verts[(i + 1) % verts.length]
          next false if cross(a, b, c) <= 0
    
          verts.none? { |p| !p.equal?(a) && !p.equal?(b) && !p.equal?(c) && in_triangle?(p, a, b, c) }
        end
        # 自己交差などで耳が見つからないときは、残りを扇形に分けて打ち切る
        unless ear
          (1...(verts.length - 1)).each { |k| tris << [verts[0], verts[k], verts[k + 1]] }
          return tris
        end
    
        tris << [verts[ear - 1], verts[ear], verts[(ear + 1) % verts.length]]
        verts.delete_at(ear)
      end
      tris << verts if verts.length == 3
      tris
    end
    
    def self.in_triangle?(p, a, b, c)
      cross(a, b, p) >= 0 && cross(b, c, p) >= 0 && cross(c, a, p) >= 0
    end

    # 授業のfillrectは中心の座標を受け取る。左上の座標から中心を求めて渡す。
    def self.rect_call(sx, sy, sw, sh, color_args)
      "  fillrect(#{num(sx + sw / 2.0)}, #{num(sy + sh / 2.0)}, #{num(sw)}, #{num(sh)}, #{color_args})"
    end

    def self.num(v)
      r = v.round(1)
      r == r.to_i ? r.to_i.to_s : r.to_s
    end

    def self.hex_to_rgb(hex)
      hex = hex.to_s.delete("#")
      hex = hex.chars.map { |c| c * 2 }.join if hex.length == 3
      return [255, 255, 255] unless hex.match?(/\A[0-9a-fA-F]{6}\z/)

      [hex[0..1].to_i(16), hex[2..3].to_i(16), hex[4..5].to_i(16)]
    end
  end
end
