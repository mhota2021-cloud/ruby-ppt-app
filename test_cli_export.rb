# frozen_string_literal: true

require "json"
require "tmpdir"
require_relative "lib/svg_generator"
require_relative "lib/renderer"

def assert(cond, msg)
  raise "ASSERTION FAILED: #{msg}" unless cond
end

project = {
  "width" => 240,
  "height" => 160,
  "backgroundColor" => "#ffffff",
  "shapes" => [
    {
      "id" => "f1",
      "type" => "frame",
      "x" => 20, "y" => 20, "width" => 80, "height" => 80,
      "cornerRadius" => 12,
      "rotation" => 15,
      "clipContent" => true,
      "fill" => "transparent", "stroke" => "#111111", "strokeWidth" => 2,
      "visible" => true
    },
    {
      "id" => "c1",
      "type" => "star5",
      "parentId" => "f1",
      "x" => 0, "y" => 0, "width" => 140, "height" => 140,
      "fill" => "#ff0000", "stroke" => "#000000", "strokeWidth" => 1,
      "visible" => true
    },
    {
      "id" => "hid",
      "type" => "rect",
      "x" => 150, "y" => 20, "width" => 50, "height" => 50,
      "fill" => "#00ff00",
      "visible" => false
    },
    {
      "id" => "txt1",
      "type" => "text",
      "x" => 120, "y" => 90, "width" => 100, "height" => 40,
      "text" => "A1!",
      "fontSize" => 16,
      "fill" => "#0000ff",
      "textWarp" => "arch_up",
      "visible" => true
    }
  ]
}

svg = PPTApp::SVGGenerator.generate_from_model(project)
assert(svg.include?('<clipPath id="clip_f1">'), "CLI SVG includes clipPath for clipContent frame")
assert(svg.include?('<g clip-path="url(#clip_f1)">'), "CLI SVG wraps frame children in clip-path group")
assert(!svg.include?("#00ff00"), "CLI SVG excludes hidden shape")
assert(svg.include?('class="warped-text"'), "CLI SVG supports textWarp")
assert(svg.include?("<path d=\"M "), "CLI SVG generates star5 path")

renderer = PPTApp::Renderer.render_project(project)
ppm = renderer.to_ppm(format: :p6)
assert(ppm.start_with?("P6\n240 160\n255\n"), "CLI PPM header matches canvas size")
# 非表示の緑矩形(175, 45)は背景色の白(255, 255, 255)のままであること
assert(renderer.buffer[45][175] == [255, 255, 255], "CLI PPM excludes hidden shape")
# クリップフレーム内側の中心(60, 60)には星(赤)が描画されていること
assert(renderer.buffer[60][60] == [255, 0, 0], "CLI PPM renders star5 inside clipped frame")
# クリップフレーム外側の星領域(5, 5)は白いままであること
assert(renderer.buffer[5][5] == [255, 255, 255], "CLI PPM clips star5 outside frame")

Dir.mktmpdir do |dir|
  json_path = File.join(dir, "sample.json")
  out_prefix = File.join(dir, "out")
  File.write(json_path, JSON.generate(project), encoding: "UTF-8")
  ok = system("ruby", File.join(__dir__, "app.rb"), "--export", json_path, "--format", "svg,ppm,ruby", "--output", out_prefix)
  assert(ok, "CLI app.rb --export succeeded")
  assert(File.exist?("#{out_prefix}.svg"), "CLI generated svg file")
  assert(File.exist?("#{out_prefix}.ppm"), "CLI generated ppm file")
  assert(File.exist?("#{out_prefix}.rb"), "CLI generated rb file")
end

puts "CLI EXPORT TEST PASS: SVGGenerator & Renderer parity verified!"
