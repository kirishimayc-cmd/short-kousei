"""src/ を結合して dist/short-kousei.html を作る"""
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent
SRC = ROOT / 'src'
ORDER = ['model.js', 'analysis.js', 'backup.js', 'db.js', 'capture.js',
         'ui/band.js', 'ui/edit.js', 'ui/list.js', 'ui/templates.js', 'ui/analyze.js', 'ui/app.js']


def main():
    html = (SRC / 'index.html').read_text(encoding='utf-8')
    css = (SRC / 'style.css').read_text(encoding='utf-8')
    js = '\n'.join((SRC / f).read_text(encoding='utf-8') for f in ORDER if (SRC / f).exists())
    assert '</script' not in js.lower(), 'JSに </script が含まれています'
    html = html.replace('<!--CSS-->', '<style>\n' + css + '\n</style>')
    html = html.replace('<!--JS-->', '<script>\n' + js + '\n</script>')
    out = ROOT / 'dist' / 'short-kousei.html'
    out.parent.mkdir(exist_ok=True)
    out.write_text(html, encoding='utf-8')
    # GitHub Pages 用（main の / と /docs どちらを公開元にしても開けるように）
    (ROOT / 'index.html').write_text(html, encoding='utf-8')
    (ROOT / 'docs' / 'index.html').write_text(html, encoding='utf-8')
    print('built', out)


if __name__ == '__main__':
    main()
