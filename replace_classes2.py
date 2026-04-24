import os
import re

dir_path = '/home/goe/Test-Antigravity-Rebelein-Lager/src'

replacements = [
    # Backgrounds
    (r'\bbg-slate-[89]00(?:/50|/70|/90)?\b', 'bg-card'),
    (r'\bbg-slate-950(?:/50)?\b', 'bg-card'),
    (r'\bbg-gray-[789]00(?:/50)?\b', 'bg-card'),
    (r'\bbg-gray-950(?:/50)?\b', 'bg-card'),
    (r'\bbg-white/[1-9]0\b', 'bg-muted'),
    
    # Texts
    (r'\btext-white/[1-9]0\b', 'text-muted-foreground'),
    (r'\btext-gray-[456]00\b', 'text-muted-foreground'),
    (r'\btext-slate-[456]00\b', 'text-muted-foreground'),
    
    # Borders
    (r'\bborder-white/[1-9]0\b', 'border-border'),
    (r'\bborder-slate-[78]00(?:/50)?\b', 'border-border'),
    (r'\bborder-gray-[78]00\b', 'border-border'),

    # Modals / Overlays
    (r'\bbg-black/(?:60|80|90)\b', 'bg-black/30'),
    (r'\bbackdrop-blur-(?:md|lg|xl)\b', 'backdrop-blur-sm'),
]

for root, dirs, files in os.walk(dir_path):
    for file in files:
        if file.endswith(('.tsx', '.ts', '.jsx', '.js', '.css')):
            file_path = os.path.join(root, file)
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            new_content = content
            for old, new in replacements:
                new_content = re.sub(old, new, new_content)
                
            if new_content != content:
                print(f"Updated {file_path}")
                with open(file_path, 'w', encoding='utf-8') as f:
                    f.write(new_content)
