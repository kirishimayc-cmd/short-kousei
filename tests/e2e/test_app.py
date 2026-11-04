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


# ---------- Task 5 ----------
def open_new(page, kind='research', **fields):
    sid = page.evaluate("""(f) => { const s = Object.assign(newShort(f.kind), f.fields);
        return App.save(s).then(n => { App.go('edit', n.id); return n.id; }); }""",
        {'kind': kind, 'fields': fields})
    page.wait_for_selector('#f-title')
    return sid


def reopen(page, sid):
    reload(page)
    page.evaluate('id => App.go("edit", id)', sid)
    page.wait_for_selector('#f-title')


def test_edit_persists(page):
    sid = open_new(page)
    page.fill('#f-title', 'テスト動画')
    page.fill('#f-duration', '30')
    page.fill('#f-views', '12000')
    page.fill('#f-tags', '猫, 料理')
    page.fill('#cur-t', '2')
    page.click('.blockbtn[data-type="フック"]')
    for t in ['1', '3.5', '7']:
        page.fill('#cur-t', t)
        page.click('#add-cut')
    page.click('#add-telop')
    page.fill('.telop-row .r-text', 'え、これ何？')
    page.fill('.telop-row .r-font', 'けいふぉんと')
    page.fill('.telop-row .r-size', '大')
    page.click('#add-se')
    page.fill('.se-row .r-kind', 'ドン')
    page.click('#add-memo')
    page.fill('.memo .m-title', '気づき')
    page.fill('.memo .m-body', '最初の1秒で顔アップ')
    assert page.inner_text('#cut-count') == '3'
    page.wait_for_timeout(900)
    reopen(page, sid)
    assert page.input_value('#f-title') == 'テスト動画'
    assert page.input_value('#f-views') == '12000'
    assert page.inner_text('#cut-count') == '3'
    assert page.input_value('.block-row .b-end') == '2'
    assert page.input_value('.telop-row .r-font') == 'けいふぉんと'
    assert page.input_value('.se-row .r-kind') == 'ドン'
    assert page.input_value('.memo .m-body') == '最初の1秒で顔アップ'
    assert page.evaluate(f'App.find("{sid}").tags') == ['猫', '料理']
    assert page.locator('#tab-edit .band .seg-b').count() == 1


def test_block_swap(page):
    sid = open_new(page, duration=30)
    page.fill('#cur-t', '5')
    page.click('.blockbtn[data-type="展開"]')
    page.fill('.block-row .b-start', '12')
    page.fill('.block-row .b-end', '4')
    page.wait_for_timeout(900)
    reopen(page, sid)
    assert page.input_value('.block-row .b-start') == '4'
    assert page.input_value('.block-row .b-end') == '12'


def test_zero_duration_band(page):
    open_new(page)
    assert '尺未入力' in page.inner_text('#tab-edit .band')


def test_custom_block_type(page):
    open_new(page, duration=20)
    page.click('#manage-types')
    page.fill('#new-type-name', '回収')
    page.click('#add-type')
    page.wait_for_selector('.blockbtn[data-type="回収"]')
    page.wait_for_timeout(300)
    reload(page)
    assert '回収' in page.evaluate('App.state.blockTypes.map(b=>b.name)')


# ---------- Task 6 ----------
def test_capture_saves_shot(page):
    sid = open_new(page, url='https://www.youtube.com/shorts/abc', duration=20)
    page.fill('#cur-t', '4.5')
    page.click('#shot-btn')            # 1回目：共有開始
    page.wait_for_selector('#share-state.on')
    assert page.locator('.shot').count() == 0
    page.click('#shot-btn')            # 2回目：撮影
    page.wait_for_selector('.shot img')
    assert page.input_value('.shot .s-t') == '4.5'
    page.click('.shot .add-note')
    page.click('.shot .add-note')
    page.locator('.shot .note textarea').nth(1).fill('右下に小さくロゴ')
    page.wait_for_timeout(900)
    reopen(page, sid)
    dims = page.evaluate("""() => new Promise(r => { const i = new Image();
        i.onload = () => r([i.naturalWidth, i.naturalHeight]); i.src = App.find('%s').shots[0].img; })""" % sid)
    assert max(dims) <= 1080 and min(dims) > 0
    assert page.locator('.shot .note').count() == 2
    assert page.locator('.shot .note textarea').nth(1).input_value() == '右下に小さくロゴ'
    assert page.evaluate("App.find('%s').shots[0].img.startsWith('data:image/jpeg')" % sid)


def test_share_end_resets(page):
    open_new(page)
    page.click('#shot-btn')
    page.wait_for_selector('#share-state.on')
    page.evaluate("window.__fakeStream.getVideoTracks().forEach(t => { t.stop(); t.dispatchEvent(new Event('ended')); })")
    page.wait_for_function("document.querySelector('#shot-btn').textContent.includes('共有をやり直す')")


def test_shot_zoom_and_delete(page):
    open_new(page)
    page.click('#shot-btn'); page.wait_for_selector('#share-state.on')
    page.click('#shot-btn'); page.wait_for_selector('.shot img')
    page.click('.shot img')
    assert page.is_visible('#overlay img')
    page.click('#overlay')
    assert not page.is_visible('#overlay')
    page.on('dialog', lambda d: d.accept())
    page.click('.shot .del-shot')
    assert page.locator('.shot').count() == 0


def test_open_player_without_url(page):
    open_new(page)
    page.click('#open-player')
    page.wait_for_selector('.toast.error')
