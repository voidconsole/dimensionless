import sys, os
p = sys.argv[1] if len(sys.argv) > 1 else "eas-build-342c2d51-log.txt"
p = os.path.abspath(p)
print("Log path:", p)
try:
    b = open(p, "rb").read()
except Exception as e:
    print("Failed to read file:", e)
    sys.exit(2)

print("File size:", len(b))

def try_decode(data):
    try:
        s = data.decode("utf-8")
        print("\n--- utf-8 decode success (last 8000 chars) ---\n")
        print(s[-8000:])
        return True
    except Exception as e:
        print("utf-8 decode failed:", e)
        return False

if try_decode(b):
    sys.exit(0)

import gzip, bz2, lzma, zlib

# try brotli first
try:
    import brotli
except Exception:
    brotli = None

if brotli:
    try:
        data = brotli.decompress(b)
        print("brotli decompressed")
        try_decode(data)
        open(p + ".dec", "wb").write(data)
        sys.exit(0)
    except Exception as e:
        print("brotli failed:", e)

# try gzip
try:
    data = gzip.decompress(b)
    print("gzip decompressed")
    try_decode(data)
    open(p + ".dec", "wb").write(data)
    sys.exit(0)
except Exception as e:
    print("gzip failed:", e)

# try zlib
try:
    data = zlib.decompress(b)
    print("zlib decompressed")
    try_decode(data)
    open(p + ".dec", "wb").write(data)
    sys.exit(0)
except Exception as e:
    print("zlib failed:", e)

# try bz2
try:
    data = bz2.decompress(b)
    print("bz2 decompressed")
    try_decode(data)
    open(p + ".dec", "wb").write(data)
    sys.exit(0)
except Exception as e:
    print("bz2 failed:", e)

# try lzma (xz)
try:
    data = lzma.decompress(b)
    print("lzma decompressed")
    try_decode(data)
    open(p + ".dec", "wb").write(data)
    sys.exit(0)
except Exception as e:
    print("lzma failed:", e)

# try zstd
try:
    import zstandard as zstd
    dctx = zstd.ZstdDecompressor()
    data = dctx.decompress(b)
    print("zstd decompressed")
    try_decode(data)
    open(p + ".dec", "wb").write(data)
    sys.exit(0)
except Exception as e:
    print("zstd failed:", e)

# fallback: print ascii-run snippets
print("\n--- ASCII sample (first 4000 bytes shown with non-printables replaced) ---\n")
sample = ''.join(chr(ch) if 32 <= ch < 127 else '.' for ch in b[:4000])
print(sample)
print("\nNo decompression method succeeded.")
sys.exit(3)
