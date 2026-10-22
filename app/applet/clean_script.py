with open('/app/applet/src/components/QCManagement.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

print(f"Total lines: {len(lines)}")
# Let's inspect lines around 1550, 2520, 3270
for idx in [1554, 2526, 2577, 3273, 3551, 4696]:
    if idx < len(lines):
        print(f"Line {idx+1}: {repr(lines[idx])}")
