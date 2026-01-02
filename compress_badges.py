# compress_badges.py
# 目标：压缩小程序 images/badges 下的图片，解决预览/上传 2MB 卡死问题
# 运行：py compress_badges.py

import time
import shutil
from pathlib import Path
from PIL import Image

BADGES_DIR = Path("images") / "badges"

# 你要“最稳+有效”，建议先用这一组参数：
MAX_SIDE = 512        # 徽章/图标类资源一般 512 足够
PNG_COLORS = 128      # 128 基本肉眼无感但体积降很多
OVERWRITE = True      # 覆盖原图（会自动备份）

def human(n: int) -> str:
    units = ["B", "KB", "MB", "GB"]
    x = float(n)
    for u in units:
        if x < 1024:
            return f"{x:.1f}{u}"
        x /= 1024
    return f"{x:.1f}TB"

def ensure_dir(p: Path):
    p.mkdir(parents=True, exist_ok=True)

def resize_if_needed(img: Image.Image) -> Image.Image:
    w, h = img.size
    m = max(w, h)
    if m <= MAX_SIDE:
        return img
    ratio = MAX_SIDE / float(m)
    nw, nh = int(w * ratio), int(h * ratio)
    return img.resize((nw, nh), Image.LANCZOS)

def compress_png(src: Path, dst: Path):
    img = Image.open(src)

    # 统一 RGBA（保透明）
    if img.mode != "RGBA":
        img = img.convert("RGBA")

    img = resize_if_needed(img)

    # 量化（对徽章类 PNG 体积下降最明显）
    q = img.quantize(colors=PNG_COLORS, method=Image.FASTOCTREE, dither=Image.NONE)

    q.save(dst, format="PNG", optimize=True, compress_level=9)

def compress_jpg(src: Path, dst: Path):
    img = Image.open(src).convert("RGB")
    img = resize_if_needed(img)
    img.save(dst, format="JPEG", quality=82, optimize=True, progressive=True)

def main():
    if not BADGES_DIR.exists():
        print(f"[ERROR] 找不到目录：{BADGES_DIR.resolve()}")
        print("请确认脚本放在小程序项目根目录（与 app.js 同级），且 images/badges 存在。")
        return

    ts = time.strftime("%Y%m%d_%H%M%S")
    bak_dir = BADGES_DIR / f"_bak_{ts}"
    ensure_dir(bak_dir)

    # 收集文件
    exts = {".png", ".jpg", ".jpeg"}
    files = [p for p in BADGES_DIR.rglob("*") if p.is_file() and p.suffix.lower() in exts]
    files = [p for p in files if "_bak_" not in str(p)]  # 跳过历史备份

    if not files:
        print("[INFO] 未找到可压缩图片（png/jpg/jpeg）。")
        return

    before_total = 0
    after_total = 0
    changed = 0

    print(f"[INFO] 待处理：{len(files)} 个文件")
    print(f"[INFO] 备份目录：{bak_dir}")

    for p in files:
        before = p.stat().st_size
        before_total += before

        rel = p.relative_to(BADGES_DIR)
        bak_path = bak_dir / rel
        ensure_dir(bak_path.parent)
        shutil.copy2(p, bak_path)

        dst = p if OVERWRITE else (BADGES_DIR / f"_out_{ts}" / rel)

        try:
            if p.suffix.lower() == ".png":
                compress_png(p, dst)
            else:
                compress_jpg(p, dst)
        except Exception as e:
            print(f"[WARN] 处理失败：{p.name} -> {e}")
            continue

        after = dst.stat().st_size
        after_total += after
        if after != before:
            changed += 1

        print(f" - {p.name}: {human(before)} -> {human(after)}")

    print("\n========== 汇总 ==========")
    print(f"处理文件数：{changed}/{len(files)}")
    print(f"总大小：{human(before_total)} -> {human(after_total)}（节省 {human(before_total - after_total)}）")
    print("下一步：微信开发者工具 清缓存 → 重新编译 → 再预览/上传。")

if __name__ == "__main__":
    main()
