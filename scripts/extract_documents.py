"""Estrae tutte le pagine dei PDF sorgente; non modifica gli originali."""
from pathlib import Path
from pypdf import PdfReader

root = Path(__file__).resolve().parent.parent
target = root / 'docs' / 'sources'
target.mkdir(parents=True, exist_ok=True)
for source in root.glob('*.pdf'):
    reader = PdfReader(source)
    content = '\n\n'.join(f'--- Pagina {i + 1} ---\n{page.extract_text()}' for i, page in enumerate(reader.pages))
    (target / f'{source.stem}.txt').write_text(content, encoding='utf-8')
    print(f'{source.name}: {len(reader.pages)} pagine estratte')
