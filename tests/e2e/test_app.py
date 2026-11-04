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


def test_player_without_url(page):
    open_new(page)
    assert 'URLを貼ると' in page.inner_text('.player-box')
    page.fill('#f-url', 'https://youtu.be/abcDEF12_-x')
    page.dispatch_event('#f-url', 'change')
    page.wait_for_selector('#player-frame[data-site=youtube]')


# ---------- Task 7 ----------
SEED = """(list) => Promise.all(list.map(f => App.save(Object.assign(newShort(f.kind), f)))).then(() => App.go('list'))"""


def test_list_filter_sort(page):
    page.evaluate(SEED, [
        {'kind': 'research', 'title': 'A研究', 'views': 500, 'tags': ['猫']},
        {'kind': 'posted', 'title': 'B投稿', 'views': 9000},
        {'kind': 'posted', 'title': 'C投稿', 'views': 100, 'memos': [{'title': 'x', 'body': '秘密の単語'}]},
        {'kind': 'plan', 'title': 'D企画'}])
    assert page.locator('#tab-list .card').count() == 4
    page.click('#tab-list [data-kind=posted]')
    assert page.locator('#tab-list .card').count() == 2
    page.select_option('#sort', 'views')
    assert page.locator('#tab-list .card .title').all_inner_texts() == ['B投稿', 'C投稿']
    page.click('#tab-list [data-kind=all]')
    page.fill('#search', '秘密')
    assert page.locator('#tab-list .card .title').all_inner_texts() == ['C投稿']
    page.fill('#search', '猫')
    assert page.locator('#tab-list .card .title').all_inner_texts() == ['A研究']
    page.fill('#search', '')
    page.click('#tab-list .card >> text=D企画')
    assert page.input_value('#f-title') == 'D企画'


def test_new_buttons(page):
    page.click('#new-research')
    page.wait_for_selector('#f-title')
    assert page.input_value('#f-kind') == 'research'


def test_template_flow(page):
    sid = open_new(page, title='元動画', duration=30, blocks=[{'type': 'フック', 'start': 0, 'end': 3, 'memo': '顔アップ'}])
    page.once('dialog', lambda d: d.accept('型A'))
    page.click('#save-template')
    page.wait_for_function('App.state.templates.length === 1')
    page.evaluate(f"App.remove('shorts', '{sid}')")
    page.click('nav [data-tab=templates]')
    assert page.input_value('.tpl .head input') == '型A'
    page.once('dialog', lambda d: d.accept('60'))
    page.click('.tpl .use-tpl')
    page.wait_for_selector('#f-title')
    assert page.input_value('#f-kind') == 'plan'
    assert page.input_value('.block-row .b-end') == '6'
    assert page.input_value('.block-row .b-memo') == '顔アップ'
    # 投稿として数字を入れると型の平均に反映
    page.select_option('#f-kind', 'posted')
    page.fill('#f-views', '4000')
    page.wait_for_timeout(700)
    page.click('nav [data-tab=templates]')
    assert page.inner_text('.tpl .tpl-avg') == '4,000'
    assert page.inner_text('.tpl .tpl-count') == '1'


def test_analyze_table(page):
    page.evaluate(SEED, [
        {'kind': 'posted', 'title': '尺なし', 'views': 10, 'duration': 0},
        {'kind': 'posted', 'title': '尺あり', 'views': 900, 'duration': 30,
         'blocks': [{'type': 'フック', 'start': 0, 'end': 2}, {'type': 'オチ', 'start': 24, 'end': 30}],
         'cuts': [{'t': 5}, {'t': 10}]}])
    page.click('nav [data-tab=analyze]')
    txt = page.inner_text('#tab-analyze')
    assert 'NaN' not in txt and 'Infinity' not in txt and 'null' not in txt
    rows = page.locator('#tab-analyze table.grid tbody tr')
    assert rows.count() == 2
    first = rows.nth(0).inner_text()
    assert '尺あり' in first and '80%' in first and '10' in first
    assert '—' in rows.nth(1).inner_text()
    assert page.locator('#tab-analyze .cmp-row').count() == 2


# ---------- Final review fixes ----------
def import_json(page, tmp_path, obj, mode):
    f = tmp_path / ('imp-%s.json' % mode)
    f.write_text(json.dumps(obj, ensure_ascii=False), encoding='utf-8')
    if not page.is_visible('#settings-panel'):
        page.click('#btn-settings')
    page.once('dialog', lambda d: d.accept())
    with page.expect_file_chooser() as fc:
        page.click('#import-' + mode)
    fc.value.set_files(str(f))


def test_replace_import_bad_records_keeps_data(page, tmp_path):
    page.evaluate("App.save(newShort('research'))")
    page.wait_for_timeout(200)
    import_json(page, tmp_path, {'app': 'short-kousei', 'shorts': [{'id': 'ok1', 'title': 'x'}],
                                 'templates': [{'name': 'no id'}], 'blockTypes': []}, 'replace')
    page.wait_for_timeout(500)
    reload(page)
    # 不完全なレコードは id を補って読み込まれ、データが消えることはない
    assert page.evaluate('App.state.templates.length') == 1
    assert page.evaluate('App.state.shorts.length') == 1


def test_db_error_during_import_rolls_back(page, tmp_path):
    orig = page.evaluate("App.save(newShort('research')).then(n=>n.id)")
    page.wait_for_timeout(200)
    page.evaluate("App.importData({shorts:[{id:'a',title:'a'}], templates:[{id:{bad:1}}], blockTypes:null}, 'replace').catch(e=>window.__impErr=String(e))")
    page.wait_for_function('window.__impErr')
    reload(page)
    assert page.evaluate('App.state.shorts.map(s=>s.id)') == [orig]


def test_add_import_keeps_newer_local(page, tmp_path):
    page.evaluate("(()=>{const s=newShort('research'); s.id='same'; s.title='NEW'; return App.save(s)})()")
    page.wait_for_timeout(200)
    import_json(page, tmp_path, {'app': 'short-kousei', 'templates': [],
                                 'shorts': [{'id': 'same', 'title': 'OLD', 'updatedAt': 1}]}, 'add')
    page.wait_for_selector('.toast:not(.error)')
    reload(page)
    assert page.evaluate("App.find('same').title") == 'NEW'


def test_save_failure_shows_error(page):
    open_new(page)
    page.evaluate("() => { window.put = () => Promise.reject(new Error('QuotaExceededError')); }")
    page.fill('#f-title', 'x')
    page.wait_for_selector('.toast.error')
    assert '保存' in page.inner_text('.toast.error')


def test_import_on_edit_tab_not_overwritten(page, tmp_path):
    sid = open_new(page, title='古い')
    page.fill('#f-channel', 'typing')   # 保存待ちの状態を作る
    import_json(page, tmp_path, {'app': 'short-kousei', 'templates': [],
                                 'shorts': [{'id': sid, 'title': 'IMPORTED', 'updatedAt': 9e15}]}, 'add')
    page.wait_for_selector('.toast:not(.error)')
    page.wait_for_timeout(900)
    assert page.evaluate(f"App.find('{sid}').title") == 'IMPORTED'
    assert page.input_value('#f-title') == 'IMPORTED'


def test_flush_on_pagehide(page):
    sid = open_new(page)
    page.fill('#f-title', '閉じる直前')
    page.evaluate("window.dispatchEvent(new Event('pagehide'))")
    page.wait_for_timeout(150)   # デバウンス(500ms)より前
    assert page.evaluate("new Promise(r=>{const q=indexedDB.open('short-kousei');q.onsuccess=()=>{const g=q.result.transaction('shorts').objectStore('shorts').get('%s');g.onsuccess=()=>r(g.result.title)}})" % sid) == '閉じる直前'




def test_youtube_embeds_in_tool(page):
    open_new(page, url='https://www.youtube.com/shorts/abcDEF12_-x')
    page.wait_for_selector('#player-frame')
    assert page.get_attribute('#player-frame', 'data-site') == 'youtube'
    assert page.is_visible('#player-fallback')


def test_add_images_from_file(page, tmp_path):
    import base64
    png = base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==')
    a = tmp_path / 'a.png'; a.write_bytes(png)
    b = tmp_path / 'b.png'; b.write_bytes(png)
    open_new(page)
    page.fill('#cur-t', '3')
    with page.expect_file_chooser() as fc:
        page.click('#add-images')
    fc.value.set_files([str(a), str(b)])
    page.wait_for_function("document.querySelectorAll('.shot').length === 2")
    assert page.locator('.shot .s-t').first.input_value() == '3'


def test_paste_image(page):
    open_new(page)
    page.evaluate("""() => { const c=document.createElement('canvas'); c.width=4; c.height=4;
      return new Promise(r => c.toBlob(b => { const dt = new DataTransfer();
        dt.items.add(new File([b], 'p.png', {type:'image/png'}));
        document.dispatchEvent(new ClipboardEvent('paste', {clipboardData: dt})); r(); })); }""")
    page.wait_for_selector('.shot img')
