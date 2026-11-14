# frozen_string_literal: true

# RubyCodeGeneratorとRubyCodeParserの単体・往復テスト
require "tmpdir"
require_relative "lib/ruby_code_generator"
require_relative "lib/ruby_code_parser"

def assert(cond, msg)
  raise "ASSERTION FAILED: #{msg}" unless cond
end

def run_generated_and_read_ppm(code)
  Dir.mktmpdir do |dir|
    rb_path = File.join(dir, "gen.rb")
    File.write(rb_path, code, encoding: "UTF-8")
    Dir.chdir(dir) do
      ok = system("ruby", rb_path)
      raise "Generated ruby script failed" unless ok
    end
    ppm_path = File.join(dir, "t.ppm")
    assert(File.exist?(ppm_path), "t.ppm generated")
    raw = File.binread(ppm_path)
    lines = raw.lines
    tokens = []
    idx = 0
    while tokens.length < 4 && idx < lines.length
      line = lines[idx].strip
      idx += 1
      next if line.empty? || line.start_with?("#")
      tokens.concat(line.split(/\s+/))
    end
    magic = tokens[0]
    w = tokens[1].to_i
    h = tokens[2].to_i
    if magic == "P6"
      m = raw.match(/\AP6\s+#{w}\s+#{h}\s+\d+\s/m)
      raise "Bad P6 header" unless m
      bytes = raw.byteslice(m.end(0)..-1)
      return { width: w, height: h, magic: magic, pixels: bytes.unpack("C*").each_slice(3).to_a }
    else
      rest = lines[idx..-1].join(" ").split(/\s+/).reject(&:empty?).map(&:to_i)
      return { width: w, height: h, magic: magic, pixels: rest.each_slice(3).to_a }
    end
  end
end

def pixel_at(img, x, y)
  img[:pixels][y * img[:width] + x]
end

# 1. RubyCodeGeneratorのclipContentとFrame回転・反転・角丸枠線検証
project = {
  "width" => 200,
  "height" => 200,
  "backgroundColor" => "#ffffff",
  "shapes" => [
    {
      "id" => "frame_clip",
      "type" => "frame",
      "name" => "ClipFrame",
      "x" => 20, "y" => 20, "width" => 80, "height" => 80,
      "fill" => "transparent", "fillOpacity" => 1.0,
      "stroke" => "transparent", "strokeWidth" => 0,
      "cornerRadius" => 16,
      "rotation" => 0,
      "clipContent" => true,
      "visible" => true
    },
    {
      "id" => "child_rect",
      "type" => "rect",
      "name" => "ChildRect",
      "parentId" => "frame_clip",
      "x" => 0, "y" => 0, "width" => 150, "height" => 150,
      "fill" => "#ff0000", "fillOpacity" => 1.0,
      "rotation" => 0,
      "visible" => true
    },
    {
      "id" => "sibling_rect",
      "type" => "rect",
      "name" => "SiblingRect",
      "x" => 110, "y" => 110, "width" => 30, "height" => 30,
      "fill" => "#00ff00", "fillOpacity" => 1.0,
      "rotation" => 0,
      "visible" => true
    },
    {
      "id" => "frame_rot",
      "type" => "frame",
      "name" => "RotRoundedFrame",
      "x" => 120, "y" => 20, "width" => 60, "height" => 40,
      "fill" => "#0000ff", "fillOpacity" => 1.0,
      "stroke" => "#111111", "strokeWidth" => 2,
      "cornerRadius" => 10,
      "rotation" => 45,
      "flipH" => true,
      "flipV" => false,
      "clipContent" => false,
      "visible" => true
    }
  ]
}

code = PPTApp::RubyCodeGenerator.generate_from_project(project)
assert(code.include?("def push_clip"), "push_clip emitted when clipContent Frame exists")
assert(code.include?("push_clip("), "push_clip call emitted")
assert(code.include?("pop_clip"), "pop_clip call emitted")
assert(code.include?("fillconvex("), "Rotated/rounded frame uses fillconvex")

img = run_generated_and_read_ppm(code)
assert(pixel_at(img, 60, 60) == [255, 0, 0], "Inside ClipFrame should be red")
assert(pixel_at(img, 21, 21) == [255, 255, 255], "Outside ClipFrame rounded corner should remain white")
assert(pixel_at(img, 10, 10) == [255, 255, 255], "Outside ClipFrame (10,10) should remain white")
assert(pixel_at(img, 105, 60) == [255, 255, 255], "Outside ClipFrame (105,60) should remain white")
assert(pixel_at(img, 120, 120) == [0, 255, 0], "Sibling after pop_clip should be green")
assert(pixel_at(img, 150, 40) == [0, 0, 255], "Rotated flipH frame center should be blue")
assert(pixel_at(img, 122, 22) == [255, 255, 255], "Unrotated corner outside 45deg frame should be white")
has_stroke_px = (120..180).any? { |x| (10..70).any? { |y| pixel_at(img, x, y) == [17, 17, 17] } }
assert(has_stroke_px, "Rotated rounded frame stroke pixels (#111111) drawn")

# ネスト回転ClipFrameの検証
rot_clip_project = {
  "width" => 120,
  "height" => 120,
  "backgroundColor" => "#ffffff",
  "shapes" => [
    {
      "id" => "rot_clip", "type" => "frame", "name" => "RotClip",
      "x" => 30, "y" => 45, "width" => 60, "height" => 30,
      "fill" => "transparent", "fillOpacity" => 1.0,
      "stroke" => "transparent", "strokeWidth" => 0,
      "cornerRadius" => 0, "rotation" => 90, "clipContent" => true, "visible" => true
    },
    {
      "id" => "inner_clip", "type" => "frame", "name" => "InnerClip", "parentId" => "rot_clip",
      "x" => 40, "y" => 20, "width" => 40, "height" => 50,
      "fill" => "transparent", "fillOpacity" => 1.0,
      "stroke" => "transparent", "strokeWidth" => 0,
      "cornerRadius" => 0, "rotation" => 0, "clipContent" => true, "visible" => true
    },
    {
      "id" => "big_child", "type" => "rect", "name" => "BigChild", "parentId" => "inner_clip",
      "x" => 0, "y" => 0, "width" => 120, "height" => 120,
      "fill" => "#ff0000", "fillOpacity" => 1.0, "rotation" => 0, "visible" => true
    }
  ]
}
rot_img = run_generated_and_read_ppm(PPTApp::RubyCodeGenerator.generate_from_project(rot_clip_project))
assert(pixel_at(rot_img, 60, 40) == [255, 0, 0], "Intersection of nested rotated clips should be red")
assert(pixel_at(rot_img, 60, 80) == [255, 255, 255], "Outside inner clip should be white")
assert(pixel_at(rot_img, 35, 50) == [255, 255, 255], "Outside 90deg rotated outer clip should be white")

# 2. RubyCodeParserのfillline・コメント・セミコロン・省略引数・clip階層復元検証
sample_ruby = <<~RUBY
  def fillline(x0, y0, x1, y1, w, r = 0, g = 0, b = 0)
    # ヘルパー内部は無視される
    fillrect(0, 0, 1, 1)
  end

  def mypicture
    fillline(10, 50, 110, 50, 6, 255, 0, 0) # 水平線
    fillline(10, 20, 90, 100, 4, 0, 128, 255, 0.25); fillrect(120, 20, 40, 30)
    draw_text(20, 120, "HI; #TEST") # 文字列中の区切り文字保護
    push_clip(50, 50, 100, 80, 12, 15)
    fillcircle(90, 90, 25, 0, 200, 0)
    pop_clip
    filltriangle(10, 10, 40, 10, 25, 40)
    writeimage("t.ppm")
  end
RUBY

parsed = PPTApp::RubyCodeParser.parse(sample_ruby)
assert(parsed.length == 7, "Expected 7 parsed shapes (line1, line2, rect, text, clipFrame, circle, triangle), got #{parsed.length}")

line1 = parsed[0]
assert(line1["fill"] == "none", "fillline fill is none")
assert(line1["stroke"] == "#ff0000", "fillline stroke hex restored")
assert(line1["strokeWidth"] == 6.0, "fillline strokeWidth restored")
assert(line1["isPathClosed"] == false, "fillline uses open path")
assert(line1["points"].length == 2, "fillline restores 2 points")
assert((line1["x"] + line1["points"][0]["x"] - 10.0).abs < 0.2 && (line1["y"] + line1["points"][0]["y"] - 50.0).abs < 0.2, "fillline start coordinate accurate")
assert((line1["x"] + line1["points"][1]["x"] - 110.0).abs < 0.2 && (line1["y"] + line1["points"][1]["y"] - 50.0).abs < 0.2, "fillline end coordinate accurate")

line2 = parsed[1]
assert(line2["stroke"] == "#0080ff", "fillline RGBA color restored")
assert((line2["fillOpacity"] - 0.75).abs < 0.02, "fillline alpha restored as opacity")

def_rect = parsed[2]
assert(def_rect["type"] == "rect" && def_rect["fill"] == "#000000", "Omitted RGB defaults to black")

txt = parsed[3]
assert(txt["type"] == "text" && txt["text"] == "HI; #TEST", "Quoted semicolon/hash preserved in draw_text")

clip_frame = parsed[4]
child_circle = parsed[5]
outer_tri = parsed[6]
assert(clip_frame["type"] == "frame" && clip_frame["clipContent"] == true, "push_clip restored as clipContent frame")
assert(clip_frame["cornerRadius"] == 12.0 && clip_frame["rotation"] == 15.0, "push_clip radius and rotation restored")
assert(child_circle["parentId"] == clip_frame["id"], "Shape inside push_clip/pop_clip linked to frame")
assert(outer_tri["parentId"].nil?, "Shape after pop_clip has nil parentId")

# 3. filllineとclipの生成→逆インポート→再生成往復検証
roundtrip_code = PPTApp::RubyCodeGenerator.generate_from_project({
  "width" => 220,
  "height" => 220,
  "backgroundColor" => "#ffffff",
  "shapes" => parsed
})
assert(roundtrip_code.include?("fillline("), "Roundtrip preserves open polyline via fillline")
assert(roundtrip_code.include?("push_clip("), "Roundtrip preserves clip frame via push_clip")
rt_img = run_generated_and_read_ppm(roundtrip_code)
assert(pixel_at(rt_img, 60, 50) == [255, 0, 0], "Roundtrip horizontal fillline renders red at (60,50)")
assert(pixel_at(rt_img, 90, 90) == [0, 200, 0], "Roundtrip clipped circle renders green at (90,90)")

# 4. 閉じた図形のstroke・破線・FONT_5X7拡張・テキスト回転/textWarpの検証
ext_code = PPTApp::RubyCodeGenerator.generate_from_project({
  "width" => 240,
  "height" => 180,
  "backgroundColor" => "#ffffff",
  "shapes" => [
    {
      "id" => "r_stroke",
      "type" => "rect",
      "x" => 10, "y" => 10, "width" => 60, "height" => 40,
      "fill" => "none", "fillOpacity" => 0.0,
      "stroke" => "#ff0000", "strokeWidth" => 4, "strokeDash" => "dashed",
      "visible" => true
    },
    {
      "id" => "e_stroke",
      "type" => "ellipse",
      "x" => 90, "y" => 10, "width" => 50, "height" => 50,
      "fill" => "#00ff00", "fillOpacity" => 1.0,
      "stroke" => "#0000ff", "strokeWidth" => 3, "strokeDash" => "solid",
      "visible" => true
    },
    {
      "id" => "t_num",
      "type" => "text",
      "x" => 10, "y" => 70, "width" => 120, "height" => 30,
      "text" => "123!あ",
      "fontSize" => 16,
      "fill" => "#111111",
      "visible" => true
    },
    {
      "id" => "t_warp",
      "type" => "text",
      "x" => 10, "y" => 110, "width" => 140, "height" => 50,
      "text" => "WAVE",
      "fontSize" => 16,
      "rotation" => 15,
      "textWarp" => "wave",
      "fill" => "#cc00cc",
      "visible" => true
    }
  ]
})
assert(ext_code.include?("filldashedline("), "Dashed stroke generates filldashedline")
assert(ext_code.include?("draw_glyph_rot("), "Rotated/warped text generates draw_glyph_rot")
assert(ext_code.include?('"1" =>') && ext_code.include?('"!" =>') && ext_code.include?('"□" =>'), "FONT_5X7 includes digits, symbols, and fallback")
ext_img = run_generated_and_read_ppm(ext_code)
assert(pixel_at(ext_img, 115, 35) == [0, 255, 0], "Ellipse fill renders green at center")
assert(pixel_at(ext_img, 115, 10) == [0, 0, 255], "Ellipse stroke renders blue at top edge")

# 5. H-1: id無し図形の重複排除検証
require_relative "lib/svg_generator"
require_relative "lib/renderer"
no_id_shapes = [
  { "type" => "rect", "x" => 10, "y" => 10, "width" => 40, "height" => 30, "fill" => "#ff0000" },
  { "type" => "ellipse", "x" => 60, "y" => 10, "width" => 40, "height" => 30, "fill" => "#00ff00" }
]
ordered_no_id = PPTApp::ShapeGeometry.visible_ordered_shapes(no_id_shapes)
assert(ordered_no_id.length == 2, "H-1: visible_ordered_shapes must not duplicate id-less shapes")
no_id_svg = PPTApp::SVGGenerator.generate_from_model({ "width" => 200, "height" => 100, "shapes" => no_id_shapes })
assert(no_id_svg.scan("<path ").length == 2, "H-1: SVGGenerator must emit 2 paths for 2 id-less shapes")

# 6. H-4 & M-2: SVGエスケープ・複数行テキスト・shear+flip順序・math_plot回転
esc_svg = PPTApp::SVGGenerator.generate_from_model({
  "width" => 200,
  "height" => 100,
  "shapes" => [
    {
      "id" => "t_multi",
      "type" => "text",
      "x" => 10, "y" => 10, "width" => 100, "height" => 60,
      "text" => "Line1\nLine2",
      "fontFamily" => '"Segoe UI", sans-serif',
      "fill" => '#111" onclick="alert(1)',
      "visible" => true
    }
  ]
})
assert(esc_svg.include?("&quot;Segoe UI&quot;"), "H-4: fontFamily quotes must be XML-escaped")
assert(!esc_svg.include?('onclick="alert(1)"'), "H-4: fill attribute must be XML-escaped")
assert(esc_svg.scan("<tspan ").length == 2, "M-2: multiline text must emit 2 <tspan> elements in SVG")

# shear→flip→rotateの順序一致検証 (local [10, 0] on 20x20 at (0,0), center (10,10))
# local offset: lx = 0, ly = -10. shearX=45 (tan=1) => lx' = -10, ly' = -10. flipH => lx'' = 10, ly'' = -10 => world [20, 0]
xf_pt = PPTApp::ShapeGeometry.transform_local_points(
  [[10.0, 0.0]],
  { "x" => 0, "y" => 0, "width" => 20, "height" => 20, "flipH" => true, "shearX" => 45, "rotation" => 0 }
)[0]
assert((xf_pt[0] - 20.0).abs < 0.01 && (xf_pt[1] - 0.0).abs < 0.01, "M-2: transform_local_points applies shear before flip (got #{xf_pt.inspect})")

# math_plot回転時のRenderer描画検証
math_rot_renderer = PPTApp::Renderer.render_project({
  "width" => 120,
  "height" => 120,
  "backgroundColor" => "#ffffff",
  "shapes" => [
    {
      "id" => "mp_rot",
      "type" => "math_plot",
      "x" => 20, "y" => 40, "width" => 80, "height" => 40,
      "rotation" => 90,
      "fill" => "#ff0000", "fillOpacity" => 1.0,
      "mathConfig" => { "expr" => "0" },
      "visible" => true
    }
  ]
})
# 80x40 centered at (60,60), rotated 90deg => occupies x:[40..80], y:[20..100]
assert(math_rot_renderer.buffer[25][60] == [255, 0, 0], "M-2: rotated math_plot fills rotated top area (60,25)")
assert(math_rot_renderer.buffer[60][25] == [255, 255, 255], "M-2: rotated math_plot does not fill unrotated left area (25,60)")

# 7. M-1: filldashedlineとdraw_glyph_rotの逆インポート検証
parsed_ext = PPTApp::RubyCodeParser.parse(<<~RUBY)
  def mypicture
    filldashedline(10, 20, 110, 20, 4, 8, 5, 255, 0, 0)
    draw_glyph_rot(50, 50, "A", 10, 20, 30, 2.0, 2.0, 45.0)
  end
RUBY
assert(parsed_ext.length == 2, "M-1: parser must recover both filldashedline and draw_glyph_rot")
assert(parsed_ext[0]["strokeDash"] == "dashed" && parsed_ext[0]["isPathClosed"] == false, "M-1: filldashedline restores dashed open line")
assert(parsed_ext[1]["type"] == "text" && parsed_ext[1]["text"] == "A" && parsed_ext[1]["rotation"] == 45.0, "M-1: draw_glyph_rot restores rotated text glyph")

# 8. 授業の定義どおりのfillrect（中心座標）とfillrotellipse（ラジアン）
course_code = PPTApp::RubyCodeGenerator.generate_from_project({
  "width" => 200, "height" => 120, "backgroundColor" => "#ffffff",
  "shapes" => [
    { "id" => "r", "type" => "rect", "x" => 10, "y" => 10, "width" => 40, "height" => 30, "fill" => "#ff0000", "visible" => true },
    { "id" => "e", "type" => "ellipse", "x" => 70, "y" => 50, "width" => 100, "height" => 20, "rotation" => 30, "fill" => "#0000ff", "visible" => true }
  ]
})
assert(course_code.include?("fillrect(30, 25, 40, 30, 255, 0, 0)"), "fillrect receives the center like the course definition")
assert(course_code.include?("j0 = (y-0.5*h).to_i; j1 = (y+0.5*h).to_i"), "fillrect body matches the course definition")
assert(course_code.include?("def fillrotellipse(x, y, rx, ry, theta, r=0, g=0, b=0, a=0.0)"), "fillrotellipse takes radians like the course definition")
assert(!course_code.include?("theta_deg"), "no degree-based fillrotellipse remains")
course_img = run_generated_and_read_ppm(course_code)
assert(pixel_at(course_img, 12, 12) == [255, 0, 0], "rect top-left area is filled")
assert(pixel_at(course_img, 5, 5) == [255, 255, 255], "outside rect stays white")
# 編集画面の回転は時計回りが正。中心(120,60)から30度方向へ40の点は内側、-30度方向は外側
c30 = Math.cos(Math::PI / 6); s30 = Math.sin(Math::PI / 6)
assert(pixel_at(course_img, (120 + 40 * c30).round, (60 + 40 * s30).round) == [0, 0, 255], "rotated ellipse follows the editor's clockwise rotation")
assert(pixel_at(course_img, (120 + 40 * c30).round, (60 - 40 * s30).round) == [255, 255, 255], "rotated ellipse is not mirrored")

parsed_course = PPTApp::RubyCodeParser.parse("fillrect(30, 25, 40, 30, 255, 0, 0)\nfillrotellipse(120, 60, 50, 10, -0.5236, 0, 0, 255)\n")
assert(parsed_course[0]["x"] == 10 && parsed_course[0]["y"] == 10, "parser converts fillrect center back to top-left")
assert(parsed_course[1]["rotation"] == 30, "parser converts radians back to editor degrees")

# 9. 凹んだ図形（星形・ハート）と反転した図形を、授業のメソッドで正しく塗れるか
def even_odd_inside?(x, y, pts)
  inside = false
  j = pts.length - 1
  pts.each_with_index do |p, i|
    q = pts[j]
    if (p[1] > y) != (q[1] > y) && x < (q[0] - p[0]) * (y - p[1]) / (q[1] - p[1]) + p[0]
      inside = !inside
    end
    j = i
  end
  inside
end

concave_shapes = [
  { "id" => "star", "type" => "star5", "x" => 10, "y" => 10, "width" => 100, "height" => 100, "fill" => "#ff0000", "visible" => true },
  { "id" => "heart", "type" => "heart", "x" => 120, "y" => 10, "width" => 80, "height" => 80, "fill" => "#00aa00", "visible" => true },
  { "id" => "arrow", "type" => "right_arrow", "x" => 10, "y" => 120, "width" => 100, "height" => 50, "fill" => "#0000ff", "flipH" => true, "visible" => true },
  { "id" => "moon", "type" => "moon", "x" => 130, "y" => 110, "width" => 60, "height" => 70, "fill" => "#aa00aa", "rotation" => 20, "visible" => true }
]
concave_code = PPTApp::RubyCodeGenerator.generate_from_project({
  "width" => 220, "height" => 190, "backgroundColor" => "#ffffff", "shapes" => concave_shapes
})
concave_img = run_generated_and_read_ppm(concave_code)
concave_shapes.each do |s|
  pts = PPTApp::RubyCodeGenerator.extract_polygon_points(s, s["x"], s["y"], s["width"], s["height"], 0.0, 0.0)
  color = PPTApp::RubyCodeGenerator.hex_to_rgb(s["fill"])
  xs = pts.map(&:first); ys = pts.map(&:last)
  total = 0; wrong = 0
  xs.min.ceil.step(xs.max.floor) do |x|
    ys.min.ceil.step(ys.max.floor) do |y|
      total += 1
      wrong += 1 if even_odd_inside?(x + 0.01, y + 0.01, pts) != (pixel_at(concave_img, x, y) == color)
    end
  end
  # 境界上の画素の丸めの差だけを許す
  assert(wrong.to_f / total < 0.04, "#{s['type']} should be filled like its outline (wrong #{wrong}/#{total})")
end

puts "RUBY CODE TEST PASS: Generator clip/rotation/fillline/stroke/text + Parser fillline/comments/clip/roundtrip verified!"
