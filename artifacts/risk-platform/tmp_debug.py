from pathlib import Path
lines = Path('app.py').read_text().splitlines()
for i,line in enumerate(lines, start=1):
    if 'reports_download' in line or 'source' in line:
        print(f'{i:04d}: {line}')
