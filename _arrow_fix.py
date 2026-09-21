import os
import re

TARGETS = [
    'frontend/src/pages/Login.jsx',
    'frontend/src/pages/asset-module/IntegrationLogs.jsx',
    'frontend/src/pages/asset-module/UsersList.jsx',
    'frontend/src/pages/asset-module/ReportsList.jsx',
    'frontend/src/pages/asset-module/ReportDetail.jsx',
]

root = os.path.dirname(os.path.abspath(__file__))
c1_pattern = '[' + ''.join(chr(c) for c in range(0x80, 0xA0)) + ']'
C1 = re.compile(c1_pattern)

for rel in TARGETS:
    full = os.path.join(root, rel)
    with open(full, 'r', encoding='utf-8') as f:
        text = f.read()
    original = text
    text = C1.sub('', text)
    text = text.replace('<-', chr(0x2190))
    text = text.replace('->', chr(0x2192))
    if text != original:
        with open(full, 'w', encoding='utf-8', newline='') as f:
            f.write(text)
        print('fixed:', rel)
    else:
        print('unchanged:', rel)
