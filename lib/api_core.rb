# frozen_string_literal: true

require "json"
require_relative "ruby_code_generator"
require_relative "ruby_code_parser"
require_relative "math_formula"

module PPTApp
  # ファイルやサーバーに依存しないAPI処理。
  # WEBrickのサーバー（app.rb）と、ブラウザ内のruby.wasm（public/js/ruby_backend.js）の両方から呼ぶ。
  module ApiCore
    JSON_TYPE = "application/json; charset=utf-8"
    RUBY_TYPE = "text/x-ruby; charset=utf-8"

    def self.math_presets
      { success: true, presets: MathFormula::FUNCTION_PRESETS }
    end

    def self.export_ruby_code(data)
      code = if data["project"].is_a?(Hash)
               RubyCodeGenerator.generate_from_project(
                 data["project"],
                 crop_to_shapes: !!data["cropToShapes"]
               )
             else
               data["code"]
             end
      raise "Missing ruby code content" if code.nil? || code.empty?

      code
    end

    def self.import_ruby(data)
      code_text = data["code"].to_s
      raise "Missing ruby code content" if code_text.strip.empty?

      { success: true, shapes: RubyCodeParser.parse(code_text) }
    end

    def self.math_evaluate(data)
      MathFormula.evaluate(data)
    end

    def self.parse_json_body(body)
      return {} if body.nil? || body.strip.empty?

      JSON.parse(body)
    rescue JSON::ParserError => e
      raise "Invalid JSON body: #{e.message}"
    end

    # 自分でraiseした入力エラー（RuntimeError・FormulaError）だけ文言を返し、それ以外は内部情報を伏せる
    def self.public_error_message(error)
      if error.instance_of?(RuntimeError) || error.class.name.to_s.end_with?("FormulaError")
        error.message
      else
        "Internal server error"
      end
    end

    # ブラウザ内実行用の入口。戻り値は [HTTPステータス, Content-Type, 本文]
    def self.dispatch(method, path, body)
      case [method, path]
      when ["GET", "/api/math/presets"]
        [200, JSON_TYPE, JSON.generate(math_presets)]
      when ["POST", "/api/export/ruby"]
        [200, RUBY_TYPE, export_ruby_code(parse_json_body(body))]
      when ["POST", "/api/import/ruby"]
        [200, JSON_TYPE, JSON.generate(import_ruby(parse_json_body(body)))]
      when ["POST", "/api/math/evaluate"]
        [200, JSON_TYPE, JSON.generate(math_evaluate(parse_json_body(body)))]
      else
        [404, JSON_TYPE, JSON.generate({ error: "Endpoint not found" })]
      end
    rescue StandardError => e
      [500, JSON_TYPE, JSON.generate({ error: public_error_message(e) })]
    end
  end
end
