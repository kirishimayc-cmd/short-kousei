import pathlib, subprocess
import pytest
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[2]
DIST = ROOT / 'dist' / 'short-kousei.html'

FAKE_SHARE = """
(() => {
  navigator.mediaDevices.getDisplayMedia = async () => {
    const c = document.createElement('canvas'); c.width = 1080; c.height = 1920;
    const g = c.getContext('2d');
    setInterval(() => { g.fillStyle = '#' + Math.floor(Math.random()*0xffffff).toString(16).padStart(6,'0'); g.fillRect(0,0,1080,1920); }, 50);
    g.fillStyle = '#c33'; g.fillRect(0,0,1080,1920);
    const st = c.captureStream(30);
    window.__fakeStream = st;
    return st;
  };
})();
"""


@pytest.fixture(scope='session', autouse=True)
def build():
    subprocess.run(['python3', str(ROOT / 'build.py')], check=True)


@pytest.fixture(scope='session')
def browser():
    with sync_playwright() as p:
        b = p.chromium.launch()
        yield b
        b.close()


@pytest.fixture
def page(browser):
    ctx = browser.new_context(viewport={'width': 1280, 'height': 900})
    ctx.add_init_script(FAKE_SHARE)
    pg = ctx.new_page()
    errors = []
    pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.goto(DIST.as_uri())
    pg.wait_for_function('window.App && App.ready')
    yield pg
    assert errors == [], errors
    ctx.close()
