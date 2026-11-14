# frozen_string_literal: true

require "net/http"
require "json"
require "tmpdir"
require "fileutils"

tmp_projects_dir = Dir.mktmpdir("ppt_test_projects_")
ENV["PPT_PROJECTS_DIR"] = tmp_projects_dir

require_relative "app"

server_port = PPTApp.find_available_port(5566)
server_thread = Thread.new do
  PPTApp.start_server(port: server_port, open_browser: false)
end

sleep 1.0 # 起動待ち

begin
  base_url = "http://localhost:#{server_port}"

  # 1. ステータス確認
  status_res = Net::HTTP.get_response(URI("#{base_url}/api/sync/status"))
  puts "Status API: #{status_res.code} - #{status_res.body}"
  raise "Status check failed" unless status_res.code == "200"

  # 2. プロジェクト同期(新規)
  test_project = {
    id: "proj_unit_test",
    title: "テストプレゼンテーション",
    revision: 1,
    updatedAt: Time.now.to_i * 1000,
    width: 960,
    height: 540,
    shapes: [
      { id: "s1", type: "rect", x: 10, y: 10, width: 100, height: 100 }
    ]
  }

  sync_res = Net::HTTP.post(
    URI("#{base_url}/api/sync/projects/proj_unit_test"),
    JSON.generate({ project: test_project }),
    "Content-Type" => "application/json"
  )
  puts "Sync API: #{sync_res.code} - #{sync_res.body}"
  sync_json = JSON.parse(sync_res.body)
  raise "Sync failed" unless sync_res.code == "200" && sync_json["revision"] == 2

  # 3. プロジェクト取得
  get_res = Net::HTTP.get_response(URI("#{base_url}/api/sync/projects/proj_unit_test"))
  puts "Get Project API: #{get_res.code}"
  raise "Get project failed" unless get_res.code == "200"

  # 4. プロジェクト一覧
  list_res = Net::HTTP.get_response(URI("#{base_url}/api/sync/projects"))
  puts "List API: #{list_res.code} - #{list_res.body}"
  list_json = JSON.parse(list_res.body)
  raise "List projects failed" unless list_json["projects"].any? { |p| p["id"] == "proj_unit_test" }

  # 5. 競合テスト(古いrevisionで送信)
  conflict_project = test_project.dup
  conflict_project[:revision] = 1 # サーバー側はすでに2になっている
  conflict_res = Net::HTTP.post(
    URI("#{base_url}/api/sync/projects/proj_unit_test"),
    JSON.generate({ project: conflict_project }),
    "Content-Type" => "application/json"
  )
  puts "Conflict API: #{conflict_res.code} - #{conflict_res.body}"
  raise "Conflict test failed" unless conflict_res.code == "409"

  # 6. プロジェクト削除
  del_uri = URI("#{base_url}/api/sync/projects/proj_unit_test")
  http = Net::HTTP.new(del_uri.host, del_uri.port)
  del_req = Net::HTTP::Delete.new(del_uri.request_uri)
  del_res = http.request(del_req)
  puts "Delete API: #{del_res.code} - #{del_res.body}"
  raise "Delete failed" unless del_res.code == "200"

  puts "\nALL SYNC API TESTS PASSED!"
ensure
  server_thread.kill
  FileUtils.rm_rf(tmp_projects_dir)
end
