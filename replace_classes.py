import os
import re

dir_path = '/home/goe/Test-Antigravity-Rebelein-Lager/src'

replacements = [
    (r'\bglass-panel\b', 'bg-card text-card-foreground shadow-sm rounded-xl border border-border'),
    (r'\bglass-button\b', 'bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-1 focus-visible:ring-ring'),
    (r'\bbg-emerald-500 hover:bg-emerald-600 text-white\b', 'bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-1 focus-visible:ring-ring'),
    (r'\bbg-emerald-600 hover:bg-emerald-500 text-white\b', 'bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-1 focus-visible:ring-ring'),
    (r'\bbg-emerald-[456]00\b', 'bg-primary'),
    (r'\bbg-white/5\b', 'bg-muted'),
    (r'\bbg-white/10\b', 'bg-muted'),
    (r'\bbg-gray-800\b', 'bg-card'),
    (r'\bbg-gray-900\b', 'bg-background'), 
    (r'\btext-white/50\b', 'text-muted-foreground'),
    (r'\btext-white/70\b', 'text-muted-foreground'),
    (r'\btext-gray-400\b', 'text-muted-foreground'),
    (r'\bborder-white/10\b', 'border-border'),
    # Modals
    (r'bg-black/\d+\s+backdrop-blur-(sm|md|lg|xl)', 'bg-black/30 backdrop-blur-sm'),
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
