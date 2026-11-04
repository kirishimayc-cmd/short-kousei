import json


def reload(page):
    page.reload()
    page.wait_for_function('window.App && App.ready')


# ---------- Task 4 ----------
def test_tabs_switch(page):
    for tab in ['edit', 'templates', 'analyze', 'list']:
        page.click(f'nav [data-tab={tab}]')
        assert page.is_visible(f'#tab-{tab}')
        others = [t for t in ['list', 'edit', 'templates', 'analyze'] if t != tab]
        for o in others:
            assert not page.is_visible(f'#tab-{o}')


def test_import_broken_keeps_data(page, tmp_path):
    page.evaluate("App.save(newShort('research'))")
    reload(page)
    assert page.evaluate('App.state.shorts.length') == 1
    bad = tmp_path / 'bad.json'
    bad.write_text('{broken', encoding='utf-8')
    page.click('#btn-settings')
    with page.expect_file_chooser() as fc:
        page.click('#import-replace')
    fc.value.set_files(str(bad))
    page.wait_for_selector('.toast.error')
    reload(page)
    assert page.evaluate('App.state.shorts.length') == 1


def test_export_import_roundtrip(page, tmp_path):
    page.evaluate("(()=>{const s=newShort('posted'); s.title='往復'; s.views=50; return App.save(s)})()")
    page.click('#btn-settings')
    with page.expect_download() as dl:
        page.click('#export')
    path = tmp_path / 'b.json'
    dl.value.save_as(path)
    data = json.loads(path.read_text(encoding='utf-8'))
    assert data['app'] == 'short-kousei' and data['shorts'][0]['title'] == '往復'
    page.evaluate("App.remove('shorts', App.state.shorts[0].id)")
    with page.expect_file_chooser() as fc:
        page.click('#import-add')
    fc.value.set_files(str(path))
    page.wait_for_selector('.toast:not(.error)')
    reload(page)
    assert page.evaluate('App.state.shorts.map(s=>s.title)') == ['往復']
