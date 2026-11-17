# 단색 배경 + 흰 글씨 "토" 아이콘 PNG 생성 (Pillow 필요)
import sys
from PIL import Image, ImageDraw, ImageFont
out = sys.argv[1]
fonts = ["C:/Windows/Fonts/malgunbd.ttf", "C:/Windows/Fonts/malgun.ttf"]
for size, name in [(192, "icon-192.png"), (512, "icon-512.png"), (180, "apple-touch-icon.png")]:
    img = Image.new("RGB", (size, size), "#1f6feb")
    d = ImageDraw.Draw(img)
    font = None
    for f in fonts:
        try:
            font = ImageFont.truetype(f, int(size * 0.55)); break
        except OSError:
            pass
    d.text((size / 2, size / 2), "토", fill="white", font=font, anchor="mm")
    img.save(f"{out}/{name}")
print("ok")
