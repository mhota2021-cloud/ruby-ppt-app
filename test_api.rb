# frozen_string_literal: true

require "net/http"
require "json"
require "base64"

require_relative "app"

# テスト用スレッドでWEBrick起動
server_port = PPTApp.find_available_port(5555)
server_thread = Thread.new do
  PPTApp.start_server(port: server_port, open_browser: false)
end

sleep 1.0 # 起動待ち

begin
  uri = URI("http://localhost:#{server_port}/api/export/ppm")
  # 2x2ピクセル赤
  rgba_bytes = [
    255, 0, 0, 255,
    255, 0, 0, 255,
    255, 0, 0, 255,
    255, 0, 0, 255
  ].pack("C*")

  req_body = JSON.generate({
    width: 2,
    height: 2,
    format: "p6",
    rgba_base64: Base64.strict_encode64(rgba_bytes),
    filename: "unit_test.ppm"
  })

  res = Net::HTTP.post(uri, req_body, "Content-Type" => "application/json")
  puts "HTTP Status: #{res.code}"
  puts "Content-Type: #{res['Content-Type']}"
  puts "Body Size: #{res.body.bytesize} bytes"
  if res.body.start_with?("P6\n2 2\n255\n")
    puts "PPM Header OK!"
  else
    puts "PPM Header FAILED"
  end
ensure
  # サーバー終了
  # WEBrickのプロセスを終了させるため、Thread kill
  server_thread.kill
end
