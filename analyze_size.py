import os

ROOT = os.path.abspath(".")
top_n = 50

files = []
for dirpath, _, filenames in os.walk(ROOT):
    # 跳过常见无关目录
    if any(x in dirpath for x in ["\\.git", "\\node_modules", "\\funnelLogs", "\\logs", "\\dist"]):
        continue
    for fn in filenames:
        p = os.path.join(dirpath, fn)
        try:
            s = os.path.getsize(p)
            files.append((s, p))
        except:
            pass

files.sort(reverse=True)
print(f"ROOT = {ROOT}")
print(f"Top {top_n} largest files:")
for s, p in files[:top_n]:
    print(f"{s/1024:.1f} KB  {os.path.relpath(p, ROOT)}")
