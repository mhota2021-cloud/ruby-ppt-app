# frozen_string_literal: true

require "webrick"
require "json"
require "fileutils"
require "base64"
require "optparse"
require "socket"

require_relative "lib/ppm_generator"
require_relative "lib/svg_generator"
require_relative "lib/renderer"
require_relative "lib/ruby_code_generator"
require_relative "lib/ruby_code_parser"
require_relative "lib/math_formula"
require_relative "lib/api_core"

module PPTApp
  VERSION = "1.1.0"
  EXPORTS_DIR  = File.expand_path(ENV["PPT_EXPORTS_DIR"] || "exports", __dir__)
  PROJECTS_DIR = File.expand_path(ENV["PPT_PROJECTS_DIR"] || "data/projects", __dir__)
  PUBLIC_DIR   = File.expand_path("public", __dir__)

  FileUtils.mkdir_p(EXPORTS_DIR)
  FileUtils.mkdir_p(PROJECTS_DIR)
  FileUtils.mkdir_p(PUBLIC_DIR)

  # 空きポートを探す
  def self.find_available_port(start_port = 4567)
    port = start_port
    loop do
      begin
        server = TCPServer.new("127.0.0.1", port)
        server.close
        return port
      rescue Errno::EADDRINUSE
        port += 1
      end
    end
  end

  # ブラウザを開く
  def self.open_browser(url)
    Thread.new do
      sleep 0.8
      if Gem.win_platform?
        system("start #{url}")
      elsif RUBY_PLATFORM =~ /darwin/
        system("open #{url}")
      else
        system("xdg-open #{url}")
      end
    end
  end

  # WebAPIサーブレット
  class ApiServlet < WEBrick::HTTPServlet::AbstractServlet
    LOCAL_HOSTS = %w[localhost 127.0.0.1 [::1]].freeze

    # 自分のPCで開いたページ以外（別サイト・別端末・DNSリバインディング）からの呼び出しを拒否する
    def service(req, res)
      host = req.host.to_s.downcase
      host = "[#{host}]" if host.include?(":") && !host.start_with?("[")
      origin = req["Origin"]
      allowed_origin = origin.nil? || LOCAL_HOSTS.any? { |h| origin == "http://#{h}:#{req.port}" }
      unless LOCAL_HOSTS.include?(host) && allowed_origin
        res.status = 403
        res["Content-Type"] = "application/json; charset=utf-8"
        res.body = JSON.generate({ error: "Forbidden" })
        return
      end
      super
    end

    def do_GET(req, res)
      path = req.path

      if path == "/api/sync/status"
        res.status = 200
        res["Content-Type"] = "application/json; charset=utf-8"
        res.body = JSON.generate({
          status: "online",
          version: VERSION,
          serverTime: Time.now.to_i * 1000
        })
      elsif path == "/api/math/presets"
        res.status = 200
        res["Content-Type"] = "application/json; charset=utf-8"
        res.body = JSON.generate(ApiCore.math_presets)
      elsif path == "/api/sync/projects"
        handle_list_projects(req, res)
      elsif path.start_with?("/api/sync/projects/")
        project_id = path.sub("/api/sync/projects/", "")
        handle_get_project(project_id, req, res)
      else
        res.status = 404
        res["Content-Type"] = "application/json; charset=utf-8"
        res.body = JSON.generate({ error: "Endpoint not found" })
      end
    rescue => e
      handle_error(e, res)
    end

    def do_POST(req, res)
      path = req.path

      case path
      when "/api/export/ppm"
        handle_export_ppm(req, res)
      when "/api/export/svg"
        handle_export_svg(req, res)
      when "/api/export/ruby"
        handle_export_ruby(req, res)
      when "/api/import/ruby"
        handle_import_ruby(req, res)
      when "/api/math/evaluate"
        handle_math_evaluate(req, res)
      when "/api/save_project"
        handle_save_project(req, res)
      when "/api/sync/projects"
        handle_create_or_sync_project(nil, req, res)
      else
        if path.start_with?("/api/sync/projects/")
          project_id = path.sub("/api/sync/projects/", "")
          handle_create_or_sync_project(project_id, req, res)
        else
          res.status = 404
          res["Content-Type"] = "application/json; charset=utf-8"
          res.body = JSON.generate({ error: "Endpoint not found" })
        end
      end
    rescue => e
      handle_error(e, res)
    end

    def do_DELETE(req, res)
      path = req.path

      if path.start_with?("/api/sync/projects/")
        project_id = path.sub("/api/sync/projects/", "")
        handle_delete_project(project_id, req, res)
      else
        res.status = 404
        res["Content-Type"] = "application/json; charset=utf-8"
        res.body = JSON.generate({ error: "Endpoint not found" })
      end
    rescue => e
      handle_error(e, res)
    end

    private

    def handle_error(e, res)
      res.status = 500
      res["Content-Type"] = "application/json; charset=utf-8"
      warn "[API] #{e.class}: #{e.message}"
      warn e.backtrace.first(5).join("\n") if e.backtrace
      res.body = JSON.generate({ error: ApiCore.public_error_message(e) })
    end

    def parse_json_body(req)
      ApiCore.parse_json_body(req.body)
    end

    # プロジェクト保存ファイルパス
    def project_file_path(project_id)
      safe_id = File.basename(project_id.to_s.gsub(/[^a-zA-Z0-9_\-]/, "_"))
      File.join(PROJECTS_DIR, "#{safe_id}.json")
    end

    # プロジェクト一覧取得
    def handle_list_projects(req, res)
      projects = []
      Dir.glob(File.join(PROJECTS_DIR, "*.json")).each do |path|
        begin
          data = JSON.parse(File.read(path, encoding: "utf-8"))
          projects << {
            id: data["id"] || File.basename(path, ".json"),
            title: data["title"] || "無題のプレゼンテーション",
            revision: data["revision"] || 1,
            updatedAt: data["updatedAt"] || File.mtime(path).to_i * 1000,
            shapeCount: (data["shapes"] || []).length
          }
        rescue => e
          warn "[Sync] Error reading #{path}: #{e.message}"
        end
      end

      # 更新日時順にソート
      projects.sort_by! { |p| -(p[:updatedAt] || 0) }

      res.status = 200
      res["Content-Type"] = "application/json; charset=utf-8"
      res.body = JSON.generate({ projects: projects })
    end

    # 特定プロジェクト取得
    def handle_get_project(project_id, req, res)
      file = project_file_path(project_id)
      unless File.exist?(file)
        res.status = 404
        res["Content-Type"] = "application/json; charset=utf-8"
        res.body = JSON.generate({ error: "Project not found" })
        return
      end

      data = JSON.parse(File.read(file, encoding: "utf-8"))
      res.status = 200
      res["Content-Type"] = "application/json; charset=utf-8"
      res.body = JSON.generate({ project: data })
    end

    # プロジェクト作成・同期処理
    def handle_create_or_sync_project(project_id, req, res)
      payload = parse_json_body(req)
      project_data = payload["project"] || payload
      pid = project_id || project_data["id"] || "proj_#{Time.now.strftime('%Y%m%d_%H%M%S')}"

      file = project_file_path(pid)
      client_rev = project_data["revision"].to_i
      now_ms = Time.now.to_i * 1000

      if File.exist?(file)
        server_data = JSON.parse(File.read(file, encoding: "utf-8"))
        server_rev = server_data["revision"].to_i

        # 競合判定: サーバー側のリビジョンがクライアントより進んでいる場合
        if server_rev > client_rev && payload["force"] != true
          res.status = 409
          res["Content-Type"] = "application/json; charset=utf-8"
          res.body = JSON.generate({
            status: "conflict",
            message: "Server has a newer revision",
            serverRevision: server_rev,
            serverUpdatedAt: server_data["updatedAt"],
            serverProject: server_data
          })
          return
        end
      end

      # 正常保存: リビジョン更新
      new_rev = client_rev + 1
      project_data["id"] = pid
      project_data["revision"] = new_rev
      project_data["updatedAt"] = now_ms

      File.write(file, JSON.pretty_generate(project_data), encoding: "utf-8")

      res.status = 200
      res["Content-Type"] = "application/json; charset=utf-8"
      res.body = JSON.generate({
        status: "ok",
        id: pid,
        revision: new_rev,
        updatedAt: now_ms
      })
    end

    # プロジェクト削除
    def handle_delete_project(project_id, req, res)
      file = project_file_path(project_id)
      if File.exist?(file)
        File.delete(file)
        res.status = 200
        res["Content-Type"] = "application/json; charset=utf-8"
        res.body = JSON.generate({ success: true })
      else
        res.status = 404
        res["Content-Type"] = "application/json; charset=utf-8"
        res.body = JSON.generate({ error: "Project not found" })
      end
    end

    # PPMエクスポート処理
    def handle_export_ppm(req, res)
      data = parse_json_body(req)
      width = data["width"].to_i
      height = data["height"].to_i
      format = (data["format"] || "p6").to_sym
      base64_rgba = data["rgba_base64"]
      filename = data["filename"] || "slide_#{Time.now.strftime('%Y%m%d_%H%M%S')}.ppm"
      filename = File.basename(filename)

      if base64_rgba.nil? || base64_rgba.empty?
        raise "Missing rgba_base64 data"
      end

      rgba_bytes = Base64.decode64(base64_rgba)
      ppm_data = PPMGenerator.generate_from_rgba(width, height, rgba_bytes, format: format)

      save_path = File.join(EXPORTS_DIR, filename)
      File.binwrite(save_path, ppm_data)

      res.status = 200
      res["Content-Type"] = "application/x-portable-pixmap"
      res["Content-Disposition"] = %(attachment; filename="#{filename}")
      res["X-Saved-Path"] = "exports/#{filename}"
      res.body = ppm_data
    end

    # SVGエクスポート処理
    def handle_export_svg(req, res)
      data = parse_json_body(req)
      svg_content = data["svg"]
      filename = data["filename"] || "slide_#{Time.now.strftime('%Y%m%d_%H%M%S')}.svg"
      filename = File.basename(filename)

      if svg_content.nil? || svg_content.empty?
        raise "Missing svg content"
      end

      formatted_svg = SVGGenerator.format_svg(svg_content)

      save_path = File.join(EXPORTS_DIR, filename)
      File.write(save_path, formatted_svg, encoding: "utf-8")

      res.status = 200
      res["Content-Type"] = "image/svg+xml; charset=utf-8"
      res["Content-Disposition"] = %(attachment; filename="#{filename}")
      res["X-Saved-Path"] = "exports/#{filename}"
      res.body = formatted_svg
    end

    # Rubyコードエクスポート処理
    def handle_export_ruby(req, res)
      data = parse_json_body(req)
      ruby_code = ApiCore.export_ruby_code(data)
      filename = data["filename"] || "slide_#{Time.now.strftime('%Y%m%d_%H%M%S')}.rb"
      filename = File.basename(filename)

      if data["save"] != false
        save_path = File.join(EXPORTS_DIR, filename)
        File.write(save_path, ruby_code, encoding: "utf-8")
        res["X-Saved-Path"] = "exports/#{filename}"
      end

      res.status = 200
      res["Content-Type"] = "text/x-ruby; charset=utf-8"
      res["Content-Disposition"] = %(attachment; filename="#{filename}")
      res.body = ruby_code
    end

    # Rubyコードインポート解析処理
    def handle_import_ruby(req, res)
      data = parse_json_body(req)
      res.status = 200
      res["Content-Type"] = "application/json; charset=utf-8"
      res.body = JSON.generate(ApiCore.import_ruby(data))
    end

    # 数式・グラフ評価API
    def handle_math_evaluate(req, res)
      data = parse_json_body(req)
      res.status = 200
      res["Content-Type"] = "application/json; charset=utf-8"
      res.body = JSON.generate(ApiCore.math_evaluate(data))
    end

    # 旧形式プロジェクト保存
    def handle_save_project(req, res)
      data = parse_json_body(req)
      project_name = data["name"] || "project_#{Time.now.strftime('%Y%m%d_%H%M%S')}"
      filename = "#{File.basename(project_name)}.json"
      save_path = File.join(EXPORTS_DIR, filename)

      File.write(save_path, JSON.pretty_generate(data), encoding: "utf-8")

      res.status = 200
      res["Content-Type"] = "application/json; charset=utf-8"
      res.body = JSON.generate({ success: true, saved_path: save_path })
    end
  end

  # キャッシュ無効化静的ファイルハンドラ
  class NoCacheFileHandler < WEBrick::HTTPServlet::FileHandler
    def service(req, res)
      super
      res["Cache-Control"] = "no-store, no-cache, must-revalidate"
      res["Pragma"] = "no-cache"
    end
  end

  # サーバー起動
  def self.start_server(port: nil, open_browser: true)
    port ||= find_available_port(4567)
    url = "http://localhost:#{port}/"

    server = WEBrick::HTTPServer.new(
      Port: port,
      BindAddress: "127.0.0.1",
      Logger: WEBrick::Log.new($stderr, WEBrick::Log::WARN),
      AccessLog: []
    )

    server.mount("/", NoCacheFileHandler, PUBLIC_DIR)
    server.mount("/api", ApiServlet)

    trap("INT")  { server.shutdown }
    trap("TERM") { server.shutdown }

    puts "========================================================"
    puts "  PowerPoint-like Shape & Text Editor (Ruby Edition)"
    puts "  URL: #{url}"
    puts "  Export Directory: #{EXPORTS_DIR}"
    puts "  Projects Directory: #{PROJECTS_DIR}"
    puts "  Press Ctrl+C to stop server."
    puts "========================================================"

    open_browser(url) if open_browser

    server.start
  end
end

# CLIエントリポイント
if __FILE__ == $0
  options = {
    port: nil,
    browser: true,
    export_file: nil,
    format: "ppm,svg",
    output: nil
  }

  opt_parser = OptionParser.new do |opts|
    opts.banner = "Usage: ruby app.rb [options]"

    opts.on("-p", "--port PORT", Integer, "Port number (default: auto 4567+)") do |p|
      options[:port] = p
    end

    opts.on("--no-browser", "Do not automatically open default browser") do
      options[:browser] = false
    end

    opts.on("-e", "--export JSON_FILE", "CLI mode: export a project JSON without starting GUI") do |f|
      options[:export_file] = f
    end

    opts.on("-f", "--format FORMATS", "Export formats (ppm, svg, or ppm,svg; default: ppm,svg)") do |fmt|
      options[:format] = fmt
    end

    opts.on("-o", "--output PREFIX", "Output filename prefix for CLI export") do |out|
      options[:output] = out
    end

    opts.on("-v", "--version", "Show version") do
      puts "Ruby PPT App v#{PPTApp::VERSION}"
      exit 0
    end

    opts.on("-h", "--help", "Show help") do
      puts opts
      exit 0
    end
  end

  opt_parser.parse!

  if options[:export_file]
    # CLIモード
    json_path = options[:export_file]
    unless File.exist?(json_path)
      warn "File not found: #{json_path}"
      exit 1
    end

    project = JSON.parse(File.read(json_path, encoding: "utf-8"))
    prefix = options[:output] || File.basename(json_path, ".*")
    formats = options[:format].split(",").map(&:strip).map(&:downcase)

    if formats.include?("svg")
      svg_str = PPTApp::SVGGenerator.generate_from_model(project)
      svg_out = "#{prefix}.svg"
      File.write(svg_out, svg_str, encoding: "utf-8")
      puts "Generated SVG: #{svg_out}"
    end

    if formats.include?("ppm")
      renderer = PPTApp::Renderer.render_project(project)
      ppm_out = "#{prefix}.ppm"
      File.binwrite(ppm_out, renderer.to_ppm(format: :p6))
      puts "Generated PPM: #{ppm_out}"
    end

    if formats.include?("ruby") || formats.include?("rb")
      ruby_code = PPTApp::RubyCodeGenerator.generate_from_project(project)
      ruby_out = "#{prefix}.rb"
      File.write(ruby_out, ruby_code, encoding: "utf-8")
      puts "Generated Ruby script: #{ruby_out}"
    end

    puts "CLI export finished successfully."
    exit 0
  else
    # サーバーモード
    PPTApp.start_server(port: options[:port], open_browser: options[:browser])
  end
end
