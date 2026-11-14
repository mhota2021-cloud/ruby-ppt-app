# frozen_string_literal: true

module PPTApp
  # 安全な数式パーサー・評価器・Ruby式変換器
  module MathFormula
    FUNCTION_PRESETS = [
      {
        id: "sine",
        name: "正弦波",
        expr: "sin(x)",
        xMin: -4.0,
        xMax: 4.0,
        yMin: -3.0,
        yMax: 3.0,
        steps: 120,
        color: "#2563eb"
      },
      {
        id: "damped",
        name: "減衰振動",
        expr: "exp(-0.2*abs(x)) * cos(3*x)",
        xMin: -4.0,
        xMax: 4.0,
        yMin: -3.0,
        yMax: 3.0,
        steps: 160,
        color: "#e11d48"
      },
      {
        id: "cubic",
        name: "三次関数",
        expr: "x^3 - 3*x",
        xMin: -4.0,
        xMax: 4.0,
        yMin: -3.0,
        yMax: 3.0,
        steps: 120,
        color: "#059669"
      },
      {
        id: "gaussian",
        name: "正規分布",
        expr: "exp(-x^2 / 2)",
        xMin: -2.4,
        xMax: 2.4,
        yMin: -0.9,
        yMax: 2.7,
        steps: 120,
        color: "#7c3aed"
      }
    ].freeze

    MATH_FUNCS_1 = %w[sin cos tan asin acos atan sinh cosh tanh sqrt exp log log10 log2].freeze
    RUBY_METHODS_1 = %w[abs floor ceil round].freeze
    MULTI_ARG_FUNCS = %w[atan2 min max].freeze
    ALL_FUNCS = (MATH_FUNCS_1 + RUBY_METHODS_1 + MULTI_ARG_FUNCS).freeze

    CONSTANTS = {
      "pi" => Math::PI,
      "PI" => Math::PI,
      "Math::PI" => Math::PI,
      "e" => Math::E,
      "E" => Math::E,
      "Math::E" => Math::E
    }.freeze

    class FormulaError < StandardError; end

    Node = Struct.new(:kind, :value, :left, :right, :args)

    # 数式文字列を字句解析してトークン配列にする
    def self.tokenize(input)
      tokens = []
      i = 0
      len = input.length

      while i < len
        ch = input[i]
        if ch.match?(/\s/)
          i += 1
          next
        end

        if input[i, 2] == "**"
          tokens << [:op, "**"]
          i += 2
          next
        end

        if "+-*/%^(),".include?(ch)
          tokens << [ch == "(" ? :lparen : ch == ")" ? :rparen : ch == "," ? :comma : :op, ch]
          i += 1
          next
        end

        if ch.match?(/\d/) || (ch == "." && i + 1 < len && input[i + 1].match?(/\d/))
          m = input[i..].match(/\A\d+(?:\.\d+)?/)
          tokens << [:num, m[0].to_f]
          i += m[0].length
          next
        end

        if ch.match?(/[a-zA-Z_]/)
          m = input[i..].match(/\A(?:Math::[a-zA-Z_]+|Math\.[a-zA-Z0-9_]+|[a-zA-Z_][a-zA-Z0-9_]*)/)
          tokens << [:ident, m[0]]
          i += m[0].length
          next
        end

        raise FormulaError, "使用できない文字があります: #{ch}"
      end

      insert_implicit_multiplication(tokens)
    end

    def self.func_name?(ident)
      normalized = ident.sub(/\AMath\./, "")
      ALL_FUNCS.include?(normalized)
    end

    def self.insert_implicit_multiplication(tokens)
      out = []
      tokens.each_with_index do |tok, idx|
        if idx > 0
          prev = tokens[idx - 1]
          prev_is_value = (prev[0] == :num || prev[0] == :rparen || (prev[0] == :ident && !func_name?(prev[1])))
          curr_starts_factor = (tok[0] == :ident || tok[0] == :lparen || (tok[0] == :num && prev[0] == :rparen))
          if prev_is_value && curr_starts_factor
            out << [:op, "*"]
          elsif prev[0] == :ident && func_name?(prev[1]) && tok[0] == :num
            raise FormulaError, "関数 #{prev[1]} の後ろには括弧が必要です"
          end
        end
        out << tok
      end
      out
    end

    class Parser
      def initialize(tokens, allowed_vars)
        @tokens = tokens
        @pos = 0
        @allowed_vars = allowed_vars
      end

      def parse
        raise FormulaError, "数式が空です" if @tokens.empty?

        node = parse_add
        raise FormulaError, "式の末尾に解釈できない記号があります" if current
        node
      end

      private

      def current
        @tokens[@pos]
      end

      def consume
        tok = @tokens[@pos]
        @pos += 1
        tok
      end

      def parse_add
        node = parse_mul
        while current && current[0] == :op && (current[1] == "+" || current[1] == "-")
          op = consume[1]
          right = parse_mul
          node = Node.new(:binop, op, node, right)
        end
        node
      end

      def parse_mul
        node = parse_unary
        while current && current[0] == :op && %w[* / %].include?(current[1])
          op = consume[1]
          right = parse_unary
          node = Node.new(:binop, op, node, right)
        end
        node
      end

      def parse_unary
        if current && current[0] == :op && (current[1] == "+" || current[1] == "-")
          op = consume[1]
          operand = parse_unary
          return op == "+" ? operand : Node.new(:unary, "-", operand)
        end
        parse_pow
      end

      def parse_pow
        base = parse_primary
        if current && current[0] == :op && (current[1] == "^" || current[1] == "**")
          consume
          exp_node = parse_unary
          return Node.new(:binop, "**", base, exp_node)
        end
        base
      end

      def parse_primary
        tok = current
        raise FormulaError, "式が途中で終わっています" unless tok

        case tok[0]
        when :num
          consume
          Node.new(:num, tok[1])
        when :lparen
          consume
          inner = parse_add
          raise FormulaError, "閉じ括弧 ) が足りません" unless current && current[0] == :rparen
          consume
          inner
        when :ident
          ident = consume[1]
          if current && current[0] == :lparen
            consume
            args = []
            unless current && current[0] == :rparen
              loop do
                args << parse_add
                break unless current && current[0] == :comma
                consume
              end
            end
            raise FormulaError, "関数 #{ident} の閉じ括弧 ) が足りません" unless current && current[0] == :rparen
            consume
            fn = ident.sub(/\AMath\./, "")
            unless ALL_FUNCS.include?(fn)
              raise FormulaError, "未対応の関数です: #{ident}"
            end
            expected = MULTI_ARG_FUNCS.include?(fn) ? 2 : 1
            if args.length != expected
              raise FormulaError, "関数 #{fn} の引数は#{expected}個必要です"
            end
            Node.new(:call, fn, nil, nil, args)
          elsif CONSTANTS.key?(ident)
            Node.new(:const, ident)
          elsif @allowed_vars.include?(ident)
            Node.new(:var, ident)
          else
            raise FormulaError, "未定義の変数または関数です: #{ident}"
          end
        else
          raise FormulaError, "予期しない記号です: #{tok[1]}"
        end
      end
    end

    def self.parse(input, allowed_vars: %w[x])
      tokens = tokenize(input.to_s)
      Parser.new(tokens, allowed_vars).parse
    end

    def self.eval_ast(node, env = {})
      case node.kind
      when :num
        node.value
      when :var
        env.fetch(node.value) { raise FormulaError, "未設定の変数: #{node.value}" }.to_f
      when :const
        CONSTANTS.fetch(node.value)
      when :unary
        -eval_ast(node.left, env)
      when :binop
        l = eval_ast(node.left, env)
        r = eval_ast(node.right, env)
        case node.value
        when "+" then l + r
        when "-" then l - r
        when "*" then l * r
        when "/" then r == 0.0 ? Float::NAN : l / r
        when "%" then r == 0.0 ? Float::NAN : l % r
        when "**" then l**r
        end
      when :call
        vals = node.args.map { |a| eval_ast(a, env) }
        fn = node.value
        case fn
        when "sin" then Math.sin(vals[0])
        when "cos" then Math.cos(vals[0])
        when "tan" then Math.tan(vals[0])
        when "asin" then vals[0].abs <= 1.0 ? Math.asin(vals[0]) : Float::NAN
        when "acos" then vals[0].abs <= 1.0 ? Math.acos(vals[0]) : Float::NAN
        when "atan" then Math.atan(vals[0])
        when "atan2" then Math.atan2(vals[0], vals[1])
        when "sinh" then Math.sinh(vals[0])
        when "cosh" then Math.cosh(vals[0])
        when "tanh" then Math.tanh(vals[0])
        when "sqrt" then vals[0] >= 0.0 ? Math.sqrt(vals[0]) : Float::NAN
        when "exp" then Math.exp(vals[0])
        when "log" then vals[0] > 0.0 ? Math.log(vals[0]) : Float::NAN
        when "log10" then vals[0] > 0.0 ? Math.log10(vals[0]) : Float::NAN
        when "log2" then vals[0] > 0.0 ? Math.log2(vals[0]) : Float::NAN
        when "abs" then vals[0].abs
        when "floor" then vals[0].floor.to_f
        when "ceil" then vals[0].ceil.to_f
        when "round" then vals[0].round.to_f
        when "min" then vals.min
        when "max" then vals.max
        else Float::NAN
        end
      end
    rescue Math::DomainError, ZeroDivisionError
      Float::NAN
    end

    def self.to_ruby_expr(node, parent_prec = 0)
      case node.kind
      when :num
        v = node.value
        v == v.to_i && v.abs < 1e12 ? format("%.1f", v) : v.to_s
      when :var
        node.value
      when :const
        node.value.start_with?("pi", "PI", "Math::PI") ? "Math::PI" : "Math::E"
      when :unary
        inner = to_ruby_expr(node.left, 4)
        str = "-#{inner}"
        parent_prec > 3 ? "(#{str})" : str
      when :binop
        prec = case node.value
               when "+", "-" then 1
               when "*", "/", "%" then 2
               when "**" then 4
               end
        l_str = to_ruby_expr(node.left, prec)
        r_str = to_ruby_expr(node.right, node.value == "**" ? prec : prec + 1)
        str = node.value == "**" ? "#{l_str}**#{r_str}" : "#{l_str} #{node.value} #{r_str}"
        parent_prec > prec ? "(#{str})" : str
      when :call
        fn = node.value
        arg_strs = node.args.map { |a| to_ruby_expr(a, 0) }
        if MATH_FUNCS_1.include?(fn) || fn == "atan2"
          "Math.#{fn}(#{arg_strs.join(', ')})"
        elsif RUBY_METHODS_1.include?(fn)
          "(#{arg_strs[0]}).#{fn}"
        elsif fn == "min" || fn == "max"
          "[#{arg_strs.join(', ')}].#{fn}"
        end
      end
    end

    def self.eval_scalar(val, default_val)
      return val.to_f if val.is_a?(Numeric)
      str = val.to_s.strip
      return default_val if str.empty?

      ast = parse(str, allowed_vars: [])
      res = eval_ast(ast, {})
      res.finite? ? res : default_val
    rescue FormulaError
      default_val
    end

    def self.translate_error(msg, lang)
      return msg unless lang == "en"

      case msg
      when /\A使用できない文字があります: (.+)\z/
        "Invalid character: #{Regexp.last_match(1)}"
      when /\A関数 (.+) の後ろには括弧が必要です\z/
        "Parentheses required after function #{Regexp.last_match(1)}"
      when "数式が空です"
        "Formula is empty"
      when "式の末尾に解釈できない記号があります"
        "Unexpected trailing tokens in formula"
      when "式が途中で終わっています"
        "Unexpected end of formula"
      when "閉じ括弧 ) が足りません"
        "Missing closing parenthesis ')'"
      when /\A関数 (.+) の閉じ括弧 \) が足りません\z/
        "Missing closing parenthesis ')' for #{Regexp.last_match(1)}"
      when /\A未対応の関数です: (.+)\z/
        "Unsupported function: #{Regexp.last_match(1)}"
      when /\A関数 (.+) の引数は(\d+)個必要です\z/
        "Function #{Regexp.last_match(1)} expects #{Regexp.last_match(2)} argument(s)"
      when /\A未定義の変数または関数です: (.+)\z/
        "Undefined variable or function: #{Regexp.last_match(1)}"
      when /\A予期しない記号です: (.+)\z/
        "Unexpected token: #{Regexp.last_match(1)}"
      when /\A未設定の変数: (.+)\z/
        "Unbound variable: #{Regexp.last_match(1)}"
      when /\A未対応のモードです: (.+)\z/
        "Unsupported mode: #{Regexp.last_match(1)}"
      when "xMinはxMaxより小さくしてください"
        "xMin must be less than xMax"
      when "yMinはyMaxより小さくしてください"
        "yMin must be less than yMax"
      else
        msg
      end
    end

    def self.evaluate(params)
      lang = params["lang"].to_s == "en" ? "en" : "ja"
      mode = (params["mode"] || "function").to_s
      raise FormulaError, "未対応のモードです: #{mode}" unless mode == "function"

      expr = params["expr"].to_s.strip
      x_min = eval_scalar(params["xMin"], -6.2832)
      x_max = eval_scalar(params["xMax"], 6.2832)
      y_min = eval_scalar(params["yMin"], -1.5)
      y_max = eval_scalar(params["yMax"], 1.5)
      steps = [[params["steps"].to_i, 10].max, 600].min
      steps = 120 if params["steps"].to_i <= 0

      raise FormulaError, "xMinはxMaxより小さくしてください" if x_min >= x_max
      raise FormulaError, "yMinはyMaxより小さくしてください" if y_min >= y_max

      ast = parse(expr, allowed_vars: %w[x])
      ruby_expr = to_ruby_expr(ast)

      segments = []
      current_seg = []
      prev_ny = nil

      0.step(steps) do |k|
        x = x_min + (x_max - x_min) * k.to_f / steps
        y = eval_ast(ast, { "x" => x })
        if y.is_a?(Numeric) && y.finite?
          nx = (x - x_min) / (x_max - x_min)
          ny = (y_max - y) / (y_max - y_min)
          if ny >= -0.15 && ny <= 1.15
            if prev_ny && (ny - prev_ny).abs > 0.85
              segments << current_seg if current_seg.length >= 2
              current_seg = []
            end
            current_seg << { "x" => nx.round(5), "y" => ny.round(5) }
            prev_ny = ny
          else
            segments << current_seg if current_seg.length >= 2
            current_seg = []
            prev_ny = nil
          end
        else
          segments << current_seg if current_seg.length >= 2
          current_seg = []
          prev_ny = nil
        end
      end
      segments << current_seg if current_seg.length >= 2

      axis_x_ratio = (0.0 - x_min) / (x_max - x_min)
      axis_y_ratio = (y_max - 0.0) / (y_max - y_min)

      {
        success: true,
        mode: mode,
        rubyExpr: ruby_expr,
        xMin: x_min,
        xMax: x_max,
        yMin: y_min,
        yMax: y_max,
        steps: steps,
        axisXRatio: axis_x_ratio,
        axisYRatio: axis_y_ratio,
        segments: segments
      }
    rescue FormulaError => e
      { success: false, error: translate_error(e.message, lang) }
    end
  end
end
