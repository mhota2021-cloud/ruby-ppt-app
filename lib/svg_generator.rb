# frozen_string_literal: true

require "cgi"
require "rexml/document"
require_relative "shape_geometry"
require_relative "math_formula"

module PPTApp
  class SVGGenerator
    # SVG文字列の検証と整形式化
    def self.format_svg(svg_string)
      cleaned = svg_string.strip
      unless cleaned.start_with?("<?xml")
        cleaned = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n" + cleaned
      end

      begin
        REXML::Document.new(cleaned)
      rescue => e
        warn "[SVGGenerator] Warning: SVG XML parse check: #{e.message}"
      end

      cleaned
    end

    # JSON形式の図形モデルからSVGを組み立てる（CLI・ヘッドレス用）
    def self.generate_from_model(model)
      width = (model["width"] || 960).to_f
      height = (model["height"] || 540).to_f
      bg = model["backgroundColor"] || "#ffffff"
      visible_shapes = ShapeGeometry.visible_ordered_shapes(model["shapes"] || [])

      svg = []
      svg << %{<?xml version="1.0" encoding="UTF-8"?>}
      svg << %{<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 #{format_num(width)} #{format_num(height)}" width="#{format_num(width)}" height="#{format_num(height)}">}
      svg << %{  <defs>}
      svg << %{    <style>}
      svg << %{      .warped-text text { font-smooth: always; }}
      svg << %{    </style>}
      visible_shapes.each do |s|
        next unless s["type"] == "frame" && s["clipContent"]

        fx = (s["x"] || 0).to_f
        fy = (s["y"] || 0).to_f
        fw = (s["width"] || 100).to_f
        fh = (s["height"] || 100).to_f
        rx = [[0.0, (s["cornerRadius"] || 0).to_f].max, fw / 2.0, fh / 2.0].min
        t_attr = build_transform_attr(s)
        svg << %{    <clipPath id="clip_#{CGI.escapeHTML(s['id'].to_s)}"><rect x="#{format_num(fx)}" y="#{format_num(fy)}" width="#{format_num(fw)}" height="#{format_num(fh)}" rx="#{format_num(rx)}" ry="#{format_num(rx)}" #{t_attr}/></clipPath>}
      end
      svg << %{  </defs>}

      if bg != "transparent" && bg != "none"
        svg << %{  <rect width="100%" height="100%" fill="#{CGI.escapeHTML(bg.to_s)}"/>}
      end

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

          svg << %{  </g>}
          clip_stack.pop
        end
      end

      visible_shapes.each do |s|
        close_finished_clips.call(s)
        piece = shape_to_svg(s)
        svg << piece if piece && !piece.empty?
        if s["type"] == "frame" && s["clipContent"] && s["id"]
          svg << %{  <g clip-path="url(#clip_#{CGI.escapeHTML(s['id'].to_s)})">}
          clip_stack.push(s["id"])
        end
      end
      close_finished_clips.call(nil)

      svg << %{</svg>}
      svg.join("\n")
    end

    class << self
      private

      def format_num(v)
        f = v.to_f
        f == f.to_i ? f.to_i.to_s : format("%.2f", f).sub(/\.?0+\z/, "")
      end

      def build_transform_attr(s)
        x = (s["x"] || 0).to_f
        y = (s["y"] || 0).to_f
        w = (s["width"] || 100).to_f
        h = (s["height"] || 100).to_f
        cx = x + w / 2.0
        cy = y + h / 2.0

        transform = ["translate(#{format_num(cx)}, #{format_num(cy)})"]
        rot = (s["rotation"] || 0).to_f
        transform << "rotate(#{format_num(rot)})" if rot != 0.0
        sx = s["flipH"] ? -1 : 1
        sy = s["flipV"] ? -1 : 1
        transform << "scale(#{sx}, #{sy})" if sx != 1 || sy != 1
        shear_x = (s["shearX"] || 0).to_f
        shear_y = (s["shearY"] || 0).to_f
        if shear_x != 0.0 || shear_y != 0.0
          tan_x = Math.tan(shear_x * Math::PI / 180.0)
          tan_y = Math.tan(shear_y * Math::PI / 180.0)
          transform << "matrix(1, #{format_num(tan_y)}, #{format_num(tan_x)}, 1, 0, 0)"
        end
        transform << "translate(#{format_num(-cx)}, #{format_num(-cy)})"
        %{transform="#{transform.join(' ')}"}
      end

      def dash_attr_for(stroke_dash)
        case stroke_dash
        when "dashed" then %{ stroke-dasharray="8 5"}
        when "dotted" then %{ stroke-dasharray="3 3"}
        else ""
        end
      end

      def shape_to_svg(s)
        type = s["type"].to_s
        x = (s["x"] || 0).to_f
        y = (s["y"] || 0).to_f
        w = (s["width"] || 100).to_f
        h = (s["height"] || 100).to_f
        cx = x + w / 2.0
        cy = y + h / 2.0
        t_attr = build_transform_attr(s)

        case type
        when "text"
          text_group = build_warp_text_svg(s)
          %{  <g #{t_attr} transform-origin="#{format_num(cx)} #{format_num(cy)}">\n    <g transform="translate(#{format_num(x)}, #{format_num(y)})">\n      #{text_group}\n    </g>\n  </g>}
        when "frame"
          fill_op = s["fillOpacity"].nil? ? 1.0 : s["fillOpacity"].to_f
          has_fill = s["fill"] && s["fill"] != "none" && s["fill"] != "transparent" && fill_op > 0.0
          sw = (s["strokeWidth"] || 0).to_f
          has_stroke = sw > 0.0 && s["stroke"] && s["stroke"] != "none" && s["stroke"] != "transparent"
          return "" if !has_fill && !has_stroke

          fill_attr = has_fill ? CGI.escapeHTML(s["fill"].to_s) : "none"
          fill_op_attr = has_fill ? fill_op : 0
          stroke_attr = has_stroke ? CGI.escapeHTML(s["stroke"].to_s) : "none"
          sw_attr = has_stroke ? sw : 0
          rx = [0.0, (s["cornerRadius"] || 0).to_f].max
          dash = dash_attr_for(s["strokeDash"])
          %{  <g #{t_attr}>\n    <rect x="#{format_num(x)}" y="#{format_num(y)}" width="#{format_num(w)}" height="#{format_num(h)}" rx="#{format_num(rx)}" ry="#{format_num(rx)}" fill="#{fill_attr}" fill-opacity="#{fill_op_attr}" stroke="#{stroke_attr}" stroke-width="#{format_num(sw_attr)}"#{dash}/>\n  </g>}
        when "math_plot"
          build_math_plot_svg(s, x, y, w, h, t_attr)
        else
          d = CGI.escapeHTML(ShapeGeometry.svg_path_for(s).to_s)
          fill = CGI.escapeHTML((s["fill"] || "none").to_s)
          fill_opacity = s["fillOpacity"].nil? ? 1.0 : s["fillOpacity"].to_f
          stroke = CGI.escapeHTML((s["stroke"] || "none").to_s)
          stroke_width = (s["strokeWidth"] || 0).to_f
          dash = dash_attr_for(s["strokeDash"])
          %{  <g #{t_attr}>\n    <path d="#{d}" transform="translate(#{format_num(x)}, #{format_num(y)})" fill="#{fill}" fill-opacity="#{fill_opacity}" stroke="#{stroke}" stroke-width="#{format_num(stroke_width)}"#{dash}/>\n  </g>}
        end
      end

      def build_math_plot_svg(s, x, y, w, h, t_attr)
        cfg = s["mathConfig"].is_a?(Hash) ? s["mathConfig"] : {}
        parts = []
        fill_op = s["fillOpacity"].nil? ? 0.0 : s["fillOpacity"].to_f
        if s["fill"] && s["fill"] != "none" && s["fill"] != "transparent" && fill_op > 0.0
          parts << %{    <rect x="#{format_num(x)}" y="#{format_num(y)}" width="#{format_num(w)}" height="#{format_num(h)}" fill="#{CGI.escapeHTML(s['fill'].to_s)}" fill-opacity="#{fill_op}"/>}
        end
        sw = (s["strokeWidth"] || 0).to_f
        if sw > 0.0 && s["stroke"] && s["stroke"] != "none" && s["stroke"] != "transparent"
          parts << %{    <rect x="#{format_num(x)}" y="#{format_num(y)}" width="#{format_num(w)}" height="#{format_num(h)}" fill="none" stroke="#{CGI.escapeHTML(s['stroke'].to_s)}" stroke-width="#{format_num(sw)}"/>}
        elsif cfg["showFrame"] == true
          parts << %{    <rect x="#{format_num(x)}" y="#{format_num(y)}" width="#{format_num(w)}" height="#{format_num(h)}" fill="none" stroke="#94a3b8" stroke-opacity="0.45" stroke-width="1"/>}
        end

        data = s["mathData"].is_a?(Hash) ? s["mathData"] : nil
        if data.nil? && cfg["expr"]
          evaluated = MathFormula.evaluate(cfg)
          if evaluated[:success]
            data = {
              "axisXRatio" => evaluated[:axisXRatio],
              "axisYRatio" => evaluated[:axisYRatio],
              "segments" => evaluated[:segments].map { |seg| seg.map { |pt| { "x" => pt[:x], "y" => pt[:y] } } }
            }
          end
        end

        if data
          if cfg["showAxes"] == true
            ax_r = data["axisXRatio"]
            if ax_r.is_a?(Numeric) && ax_r >= 0.0 && ax_r <= 1.0
              ax = format("%.2f", x + ax_r * w)
              parts << %{    <line x1="#{ax}" y1="#{format_num(y)}" x2="#{ax}" y2="#{format_num(y + h)}" stroke="#94a3b8" stroke-width="1"/>}
            end
            ay_r = data["axisYRatio"]
            if ay_r.is_a?(Numeric) && ay_r >= 0.0 && ay_r <= 1.0
              ay = format("%.2f", y + ay_r * h)
              parts << %{    <line x1="#{format_num(x)}" y1="#{ay}" x2="#{format_num(x + w)}" y2="#{ay}" stroke="#94a3b8" stroke-width="1"/>}
            end
          end

          if data["segments"].is_a?(Array)
            stroke_color = cfg["lineColor"]
            if !stroke_color || stroke_color.to_s.empty?
              stroke_color = (s["stroke"] && s["stroke"] != "none" && s["stroke"] != "transparent") ? s["stroke"] : "#2563eb"
            end
            lw = (cfg["lineWidth"] || 3).to_f
            data["segments"].each do |seg|
              next unless seg.is_a?(Array) && seg.length >= 2

              pts = seg.map { |pt| "#{format('%.2f', x + pt['x'].to_f * w)},#{format('%.2f', y + pt['y'].to_f * h)}" }.join(" ")
              parts << %{    <polyline points="#{pts}" fill="none" stroke="#{CGI.escapeHTML(stroke_color.to_s)}" stroke-width="#{format_num(lw)}" stroke-linecap="round" stroke-linejoin="round"/>}
            end
          end
        end

        %{  <g #{t_attr}>\n#{parts.join("\n")}\n  </g>}
      end

      def build_warp_text_svg(s)
        text = s["text"].to_s
        return "" if text.empty?

        w = (s["width"] || 100).to_f
        h = (s["height"] || 100).to_f
        warp = (s["textWarp"] || "none").to_s
        font_size = (s["fontSize"] || 28).to_f
        font_family = s["fontFamily"] || "sans-serif"
        font_weight = s["fontWeight"] || "normal"
        font_style = s["fontStyle"] || "normal"
        fill = s["fill"] || "#2c3e50"

        font_family_esc = CGI.escapeHTML(font_family.to_s)
        font_weight_esc = CGI.escapeHTML(font_weight.to_s)
        font_style_esc = CGI.escapeHTML(font_style.to_s)
        fill_esc = CGI.escapeHTML(fill.to_s)

        if warp == "none"
          align = s["textAlign"] || "center"
          anchor = case align
                   when "center" then "middle"
                   when "right" then "end"
                   else "start"
                   end
          tx = case align
               when "center" then w / 2.0
               when "right" then w - 10.0
               else 10.0
               end
          lines = text.split("\n", -1)
          if lines.length <= 1
            return %{<text x="#{format_num(tx)}" y="#{format_num(h / 2.0)}" font-family="#{font_family_esc}" font-size="#{format_num(font_size)}" font-weight="#{font_weight_esc}" font-style="#{font_style_esc}" fill="#{fill_esc}" text-anchor="#{anchor}" dominant-baseline="middle">#{CGI.escapeHTML(text)}</text>}
          end

          line_height = font_size * 1.2
          start_y = (h - lines.length * line_height) / 2.0 + line_height / 2.0
          tspans = lines.each_with_index.map do |line, idx|
            ly = start_y + idx * line_height
            content = line.empty? ? "&#160;" : CGI.escapeHTML(line)
            %{<tspan x="#{format_num(tx)}" y="#{format_num(ly)}">#{content}</tspan>}
          end.join
          return %{<text x="#{format_num(tx)}" y="#{format_num(start_y)}" font-family="#{font_family_esc}" font-size="#{format_num(font_size)}" font-weight="#{font_weight_esc}" font-style="#{font_style_esc}" fill="#{fill_esc}" text-anchor="#{anchor}" dominant-baseline="middle">#{tspans}</text>}
        end

        chars = text.chars
        count = chars.length
        items = chars.each_with_index.map do |ch, i|
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

          tr = "translate(#{format('%.2f', cx)}, #{format('%.2f', cy)})"
          tr += " rotate(#{format('%.2f', ang)})" if ang != 0.0
          tr += " scale(1, #{format('%.2f', sy)})" if sy != 1.0
          %{<text transform="#{tr}" font-family="#{font_family_esc}" font-size="#{format_num(font_size)}" font-weight="#{font_weight_esc}" font-style="#{font_style_esc}" fill="#{fill_esc}" text-anchor="middle" dominant-baseline="middle">#{CGI.escapeHTML(ch)}</text>}
        end
        %{<g class="warped-text">#{items.join}</g>}
      end
    end
  end
end
