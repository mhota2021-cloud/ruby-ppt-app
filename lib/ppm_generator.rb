# frozen_string_literal: true

module PPTApp
  class PPMGenerator
    # format: :p6 (binary) or :p3 (ascii text)
    # rgb_bytes: binary string of RGB bytes (length == width * height * 3)
    def self.generate_from_raw_rgb(width, height, rgb_bytes, format: :p6)
      expected_len = width * height * 3
      if rgb_bytes.bytesize < expected_len
        raise ArgumentError, "rgb_bytes size (#{rgb_bytes.bytesize}) does not match dimensions #{width}x#{height}*3 (#{expected_len})"
      end

      case format
      when :p6
        header = "P6\n#{width} #{height}\n255\n"
        # Ensure binary encoding
        (header.encode(Encoding::ASCII_8BIT) + rgb_bytes[0, expected_len]).force_encoding(Encoding::BINARY)
      when :p3
        lines = ["P3", "#{width} #{height}", "255"]
        bytes = rgb_bytes[0, expected_len].bytes
        # 1行あたり適度な数（約15〜20値）で改行
        bytes.each_slice(15) do |slice|
          lines << slice.join(" ")
        end
        lines.join("\n") + "\n"
      else
        raise ArgumentError, "Unknown PPM format: #{format} (expected :p6 or :p3)"
      end
    end

    # RGBA bytes (4 bytes per pixel) to PPM
    def self.generate_from_rgba(width, height, rgba_bytes, bg_color: [255, 255, 255], format: :p6)
      expected_len = width * height * 4
      rgb_data = String.new(capacity: width * height * 3, encoding: Encoding::BINARY)

      bytes = rgba_bytes[0, expected_len].bytes
      (0...bytes.length).step(4) do |i|
        r = bytes[i]
        g = bytes[i + 1]
        b = bytes[i + 2]
        a = bytes[i + 3] / 255.0

        # Alpha composite with background
        out_r = ((1.0 - a) * bg_color[0] + a * r).round.clamp(0, 255)
        out_g = ((1.0 - a) * bg_color[1] + a * g).round.clamp(0, 255)
        out_b = ((1.0 - a) * bg_color[2] + a * b).round.clamp(0, 255)

        rgb_data << out_r.chr << out_g.chr << out_b.chr
      end

      generate_from_raw_rgb(width, height, rgb_data, format: format)
    end
  end
end
