# frozen_string_literal: true

module PPTApp
  # 基礎プログラミングおよび演習準拠のRubyコードを解析して図形配列へ復元するモジュール
  class RubyCodeParser
    NUM_RE = /\A-?\d+(?:\.\d+)?\z/.freeze

    def self.parse(code_text)
      shapes = []
      return shapes if code_text.nil? || code_text.strip.empty?

      in_helper_def = false
      def_depth = 0
      seed = (Time.now.to_f * 1000).to_i
      seq = 0
      clip_stack = []

      code_text.each_line do |raw_line|
        line = raw_line.strip
        next if line.empty? || line.start_with?("#")

        # ヘルパーメソッド定義(def mypicture以外)の内部は無視する
        if (m = line.match(/\Adef\s+([a-zA-Z_]\w*)/))
          method_name = m[1]
          if method_name == "mypicture"
            in_helper_def = false
          else
            in_helper_def = true
            def_depth = 1
          end
          next
        end

        if in_helper_def
          if line.match?(/\b(do|if|unless|case|while|until|for)\b/) && !line.match?(/\bif\s+.+\bthen\b|\A.+\s+(?:if|unless|while|until)\s+/)
            def_depth += 1
          end
          if line == "end"
            def_depth -= 1
            in_helper_def = false if def_depth <= 0
          end
          next
        end

        split_statements_strip_comment(line).each do |stmt|
          seq += 1
          if (args_str = match_call(stmt, "push_clip"))
            frame = build_clip_frame(args_str, seed + seq)
            if frame
              frame["parentId"] = clip_stack.last unless clip_stack.empty?
              shapes << frame
              clip_stack.push(frame["id"])
            end
            next
          end

          if stmt.match?(/\Apop_clip(?:\s*\(\s*\))?\z/)
            clip_stack.pop
            next
          end

          shape = parse_draw_call(stmt, seed + seq)
          if shape
            shape["parentId"] = clip_stack.last unless clip_stack.empty?
            shapes << shape
          end
        end
      end

      shapes
    end

    # 文字列外の行末コメントを取り除き、セミコロン区切りの文配列へ分ける
    def self.split_statements_strip_comment(line)
      cleaned = +""
      in_quote = nil
      escaped = false

      line.each_char do |ch|
        if in_quote
          cleaned << ch
          if escaped
            escaped = false
          elsif ch == "\\"
            escaped = true
          elsif ch == in_quote
            in_quote = nil
          end
        elsif ch == "\"" || ch == "'"
          in_quote = ch
          cleaned << ch
        elsif ch == "#"
          break
        else
          cleaned << ch
        end
      end

      stmts = []
      buf = +""
      in_quote = nil
      escaped = false

      cleaned.each_char do |ch|
        if in_quote
          buf << ch
          if escaped
            escaped = false
          elsif ch == "\\"
            escaped = true
          elsif ch == in_quote
            in_quote = nil
          end
        elsif ch == "\"" || ch == "'"
          in_quote = ch
          buf << ch
        elsif ch == ";"
          s = buf.strip
          stmts << s unless s.empty?
          buf = +""
        else
          buf << ch
        end
      end
      last = buf.strip
      stmts << last unless last.empty?
      stmts
    end

    def self.match_call(stmt, name)
      m = stmt.match(/\A#{Regexp.escape(name)}(?:\s*\((.+)\)|\s+([^()]+))\s*\z/)
      m ? (m[1] || m[2]) : nil
    end

    def self.build_clip_frame(args_str, uid)
      parts = args_str.split(",").map(&:strip)
      return nil if parts.length < 4 || parts.length > 10

      num_parts = parts[0..[parts.length - 1, 7].min]
      return nil unless num_parts.all? { |p| p.match?(NUM_RE) }

      nums = num_parts.map(&:to_f)
      x, y, w, h = nums[0..3]
      radius = nums.length >= 5 ? [0.0, nums[4]].max : 0.0
      rot = nums.length >= 6 ? nums[5] : 0.0
      shear_x = nums.length >= 7 ? nums[6] : 0.0
      shear_y = nums.length >= 8 ? nums[7] : 0.0
      flip_h = parts[8] == "true"
      flip_v = parts[9] == "true"
      frame = base_shape(uid, "frame", "フレーム", x, y, w, h, 255, 255, 255, 1.0)
      frame["fill"] = "transparent"
      frame["cornerRadius"] = radius.round(1)
      frame["rotation"] = rot.round(1)
      frame["shearX"] = shear_x.round(2)
      frame["shearY"] = shear_y.round(2)
      frame["flipH"] = flip_h
      frame["flipV"] = flip_v
      frame["clipContent"] = true
      frame
    end

    def self.parse_draw_call(line, uid)
      if (args_str = match_call(line, "fillrect"))
        nums = extract_numeric_args(args_str)
        rgb_op = nums && extract_rgb_and_opacity(nums, 4)
        return nil unless rgb_op

        # 授業のfillrectは中心(x, y)を受け取るので、編集画面の左上の座標に直す
        x, y, w, h = nums[0..3]
        r, g, b, opacity = rgb_op
        return base_shape(uid, "rect", "長方形", x - w / 2.0, y - h / 2.0, w, h, r, g, b, opacity)
      end

      if (args_str = match_call(line, "fillcircle"))
        nums = extract_numeric_args(args_str)
        rgb_op = nums && extract_rgb_and_opacity(nums, 3)
        return nil unless rgb_op

        cx, cy, rad = nums[0..2]
        r, g, b, opacity = rgb_op
        return base_shape(uid, "ellipse", "円", cx - rad, cy - rad, rad * 2, rad * 2, r, g, b, opacity)
      end

      if (args_str = match_call(line, "fillrotellipse"))
        nums = extract_numeric_args(args_str)
        rgb_op = nums && extract_rgb_and_opacity(nums, 5)
        return nil unless rgb_op

        # 授業のfillrotellipseの角度はラジアンで、編集画面とは回る向きが逆
        cx, cy, rx, ry, theta = nums[0..4]
        r, g, b, opacity = rgb_op
        s = base_shape(uid, "ellipse", "楕円", cx - rx, cy - ry, rx * 2, ry * 2, r, g, b, opacity)
        s["rotation"] = (-theta * 180.0 / Math::PI).round
        return s
      end

      if (args_str = match_call(line, "filldonut"))
        nums = extract_numeric_args(args_str)
        rgb_op = nums && extract_rgb_and_opacity(nums, 4)
        return nil unless rgb_op

        cx, cy, r1, r2 = nums[0..3]
        r, g, b, opacity = rgb_op
        s = base_shape(uid, "donut", "ドーナツ", cx - r1, cy - r1, r1 * 2, r1 * 2, r, g, b, opacity)
        s["adjustments"] = { "holeRatio" => r1 > 0 ? (r2 / r1).clamp(0.1, 0.9) : 0.5 }
        return s
      end

      if (args_str = match_call(line, "filltriangle"))
        nums = extract_numeric_args(args_str)
        rgb_op = nums && extract_rgb_and_opacity(nums, 6)
        return nil unless rgb_op

        x1, y1, x2, y2, x3, y3 = nums[0..5]
        r, g, b, opacity = rgb_op
        min_x = [x1, x2, x3].min
        min_y = [y1, y2, y3].min
        w = [10.0, [x1, x2, x3].max - min_x].max
        h = [10.0, [y1, y2, y3].max - min_y].max
        s = base_shape(uid, "triangle", "三角形", min_x, min_y, w, h, r, g, b, opacity)
        s["points"] = [
          { "x" => x1 - min_x, "y" => y1 - min_y, "type" => "corner" },
          { "x" => x2 - min_x, "y" => y2 - min_y, "type" => "corner" },
          { "x" => x3 - min_x, "y" => y3 - min_y, "type" => "corner" }
        ]
        return s
      end

      if (args_str = match_call(line, "fillline"))
        nums = extract_numeric_args(args_str)
        rgb_op = nums && extract_rgb_and_opacity(nums, 5)
        return nil unless rgb_op

        return build_line_shape(uid, nums[0..3], nums[4], rgb_op, "solid")
      end

      if (args_str = match_call(line, "filldashedline"))
        nums = extract_numeric_args(args_str)
        rgb_op = nums && extract_rgb_and_opacity(nums, 7)
        return nil unless rgb_op

        on_len = nums[5]
        dash = on_len <= 4.0 ? "dotted" : "dashed"
        return build_line_shape(uid, nums[0..3], nums[4], rgb_op, dash)
      end

      if (m = line.match(/\Afillconvex(?:\s*\(|\s+)\s*\[([^\]]+)\]\s*,\s*\[([^\]]+)\](?:\s*,\s*(.+?))?\s*\)?\s*\z/))
        ax = m[1].split(",").map(&:strip).select { |t| t.match?(NUM_RE) }.map(&:to_f)
        ay = m[2].split(",").map(&:strip).select { |t| t.match?(NUM_RE) }.map(&:to_f)
        return nil unless ax.length >= 3 && ax.length == ay.length

        rest = m[3] ? extract_numeric_args(m[3]) : []
        return nil unless rest

        rgb_op = extract_rgb_and_opacity(rest, 0)
        return nil unless rgb_op

        if ax.length > 3 && (ax.first - ax.last).abs < 0.01 && (ay.first - ay.last).abs < 0.01
          ax.pop
          ay.pop
        end
        min_x = ax.min
        min_y = ay.min
        w = [10.0, ax.max - min_x].max
        h = [10.0, ay.max - min_y].max
        r, g, b, opacity = rgb_op
        s = base_shape(uid, "rect", "多角形", min_x, min_y, w, h, r, g, b, opacity)
        s["points"] = ax.each_with_index.map do |px, idx|
          { "x" => px - min_x, "y" => ay[idx] - min_y, "type" => "corner" }
        end
        return s
      end

      if (m = line.match(/\Adraw_text(?:\s*\(|\s+)\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*,\s*"((?:[^"\\]|\\.)*)"(?:\s*,\s*(.+?))?\s*\)?\s*\z/))
        x = m[1].to_f
        y = m[2].to_f
        text = m[3].gsub('\\"', '"').gsub("\\\\", "\\")
        rest = m[4] ? extract_numeric_args(m[4]) : []
        return nil unless rest && [0, 3, 4].include?(rest.length)

        r, g, b = rest.length >= 3 ? rest[0..2] : [0.0, 0.0, 0.0]
        scale = rest.length == 4 ? [0.5, rest[3]].max : 1.0
        font_size = [12, (scale * 10).round].max
        w = [40.0, text.length * 6.0 * scale].max
        h = [24.0, 7.0 * scale + 8].max
        s = base_shape(uid, "text", "テキスト", x, y, w, h, r, g, b, 1.0)
        s["text"] = text
        s["fontSize"] = font_size
        return s
      end

      if (m = line.match(/\Adraw_glyph_rot(?:\s*\(|\s+)\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*,\s*"((?:[^"\\]|\\.)*)"\s*,\s*(.+?)\s*\)?\s*\z/))
        cx = m[1].to_f
        cy = m[2].to_f
        ch = m[3].gsub('\\"', '"').gsub("\\\\", "\\")
        rest = extract_numeric_args(m[4])
        return nil unless rest && rest.length == 6

        r, g, b, sx, _sy, rot_deg = rest
        font_size = [12, (sx * 10).round].max
        w = [20.0, 6.0 * sx + 10.0].max
        h = [24.0, 7.0 * sx + 8.0].max
        s = base_shape(uid, "text", "テキスト", cx - w / 2.0, cy - h / 2.0, w, h, r, g, b, 1.0)
        s["text"] = ch
        s["fontSize"] = font_size
        s["rotation"] = rot_deg.round(1)
        return s
      end

      nil
    end

    def self.build_line_shape(uid, coords, lw, rgb_op, dash)
      x0, y0, x1, y1 = coords
      r, g, b, opacity = rgb_op
      lw_clamped = [1.0, lw].max
      min_dim = [lw_clamped, 4.0].max
      sw = [(x1 - x0).abs, min_dim].max
      sh = [(y1 - y0).abs, min_dim].max
      sx = (x0 + x1) / 2.0 - sw / 2.0
      sy = (y0 + y1) / 2.0 - sh / 2.0
      s = base_shape(uid, "rect", "直線", sx, sy, sw, sh, r, g, b, opacity)
      s["fill"] = "none"
      s["stroke"] = rgb_to_hex(r, g, b)
      s["strokeWidth"] = lw_clamped.round(1)
      s["strokeDash"] = dash
      s["isPathClosed"] = false
      s["points"] = [
        { "x" => (x0 - sx).round(1), "y" => (y0 - sy).round(1), "type" => "corner" },
        { "x" => (x1 - sx).round(1), "y" => (y1 - sy).round(1), "type" => "corner" }
      ]
      s
    end

    def self.extract_rgb_and_opacity(nums, start_idx)
      extra = nums.length - start_idx
      case extra
      when 0
        [0.0, 0.0, 0.0, 1.0]
      when 3
        [nums[start_idx], nums[start_idx + 1], nums[start_idx + 2], 1.0]
      when 4
        [nums[start_idx], nums[start_idx + 1], nums[start_idx + 2], (1.0 - nums[start_idx + 3]).clamp(0.0, 1.0)]
      else
        nil
      end
    end

    # 引数文字列を解析する(先頭のimg等の変数引数は自動スキップし、数値のみならFloat配列で返す)
    def self.extract_numeric_args(args_str)
      parts = args_str.split(",").map(&:strip)
      return nil if parts.empty?

      parts.shift unless parts.first.match?(NUM_RE)
      return nil if parts.empty?
      return nil unless parts.all? { |p| p.match?(NUM_RE) }

      parts.map(&:to_f)
    end

    def self.base_shape(uid, type, name, x, y, w, h, r, g, b, opacity)
      {
        "id" => "shape_#{uid}",
        "type" => type,
        "name" => name,
        "x" => x.round(1),
        "y" => y.round(1),
        "width" => [1.0, w].max.round(1),
        "height" => [1.0, h].max.round(1),
        "rotation" => 0,
        "flipH" => false,
        "flipV" => false,
        "shearX" => 0,
        "shearY" => 0,
        "fill" => rgb_to_hex(r, g, b),
        "fillOpacity" => opacity.round(2),
        "stroke" => "none",
        "strokeWidth" => 0,
        "strokeDash" => "solid",
        "shadow" => false,
        "text" => "",
        "adjustments" => {},
        "points" => nil,
        "isPathClosed" => true
      }
    end

    def self.rgb_to_hex(r, g, b)
      ri = r.round.clamp(0, 255)
      gi = g.round.clamp(0, 255)
      bi = b.round.clamp(0, 255)
      format("#%02x%02x%02x", ri, gi, bi)
    end
  end
end
