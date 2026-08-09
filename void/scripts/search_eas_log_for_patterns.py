import sys, os, re
p = os.path.abspath(r"eas-build-342c2d51-log.txt")
print("Log path:", p)
try:
    b = open(p, 'rb').read()
except Exception as e:
    print('Failed to read file:', e)
    sys.exit(2)
patterns = [b'FAILURE', b'Exception', b'ERROR', b'FAIL', b'Caused by', b'BUILD FAILED', b'compileKotlin', b'gradle', b'Run gradlew', b'ERROR:' , b'Compilation error', b'Build failed']
found_any = False
for pat in patterns:
    idx = 0
    while True:
        idx = b.find(pat, idx)
        if idx == -1:
            break
        found_any = True
        start = max(0, idx-200)
        end = min(len(b), idx+400)
        snippet = b[start:end]
        # make printable
        s = ''.join((chr(c) if 32 <= c < 127 else '.') for c in snippet)
        print('\n--- Found pattern: {} at byte {} (context) ---\n'.format(pat.decode('latin1',errors='ignore'), idx))
        print(s)
        idx += len(pat)

if not found_any:
    print('\nNo common patterns found. Searching for longest ASCII runs...\n')
    txt = ''.join((chr(c) if 32 <= c < 127 else '\n') for c in b)
    runs = [r for r in re.split('\n+', txt) if len(r) >= 40]
    runs = runs[:20]
    for i, r in enumerate(runs):
        print('\n--- ASCII run {} (len={}) ---\n'.format(i, len(r)))
        print(r[:1000])

print('\nSearch complete')
