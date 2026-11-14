# frozen_string_literal: true

# 全自動テスト一括ランナー(構文チェック・フロントエンド・Ruby生成/解析・API)
ROOT = __dir__

def run_step(label, cmd)
  puts "==> #{label}"
  ok = system(cmd, chdir: ROOT)
  return if ok

  warn "FAILED: #{label}"
  exit 1
end

([File.join(ROOT, "app.rb")] + Dir.glob(File.join(ROOT, "lib", "*.rb")).sort).each do |rb|
  run_step("Ruby syntax: #{File.basename(rb)}", "ruby -c \"#{rb}\"")
end

Dir.glob(File.join(ROOT, "public", "js", "*.js")).sort.each do |js|
  run_step("JS syntax: #{File.basename(js)}", "node --check \"#{js}\"")
end

run_step("Frontend unit tests (test_frontend.js)", "node test_frontend.js")
run_step("Ruby codegen & parser tests (test_ruby_code.rb)", "ruby test_ruby_code.rb")
run_step("CLI export tests (test_cli_export.rb)", "ruby test_cli_export.rb")
run_step("Export API tests (test_api.rb)", "ruby test_api.rb")
run_step("Sync API tests (test_sync_api.rb)", "ruby test_sync_api.rb")

puts "\nALL TESTS PASSED!"
