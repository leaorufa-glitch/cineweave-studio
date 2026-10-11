# Browser regression smoke for the approved seven-page prototype + functional bridge.
# Requires a locally running Next.js app and installed Playwright/Chrome.
import os
import uuid
from pathlib import Path
from playwright.sync_api import sync_playwright

base=os.environ.get("CINEWEAVE_TEST_BASE_URL","http://127.0.0.1:32784")
files=Path(__file__).resolve().parents[1]/".local-media"
files.mkdir(exist_ok=True)
with sync_playwright() as p:
    browser=p.chromium.launch(channel="chrome",headless=True,args=["--no-sandbox"])
    page=browser.new_page(viewport={"width":1440,"height":900},device_scale_factor=1)
    errors=[]
    page.on("pageerror",lambda e: errors.append(str(e)))
    page.goto(base,wait_until="networkidle",timeout=30000)
    page.wait_for_function("window.CWPrototype && window.CWRuntime",timeout=20000)
    assert page.locator("#home-idea").count()==1
    page.screenshot(path=str(files/"ui-home.png"))
    idea="雨夜车站的父女和解 "+str(uuid.uuid4())[:8]
    page.locator("#home-idea").fill(idea)
    page.locator("[data-action=start-project]").click()
    page.wait_for_function("window.CWRuntime.s.project && window.CWPrototype.state.page===1",timeout=18000)
    assert page.locator("#cw-panel").is_visible()
    page.locator("#cw-unit-title").fill("真实场景：雨夜车站")
    page.locator("#cw-script").fill("雨声不断。父亲犹豫，将黄铜钥匙递给女儿。女儿深呼吸。")
    page.locator("#cw-new-scene").click()
    page.wait_for_function("window.CWRuntime.s.unit && window.CWRuntime.s.unit.id",timeout=14000)
    page.locator("#cw-mock").click()
    page.wait_for_function("window.CWRuntime.s.proposal && !document.getElementById('cw-proposal').hidden",timeout=14000)
    page.locator("#cw-adopt").click()
    page.wait_for_function("window.CWRuntime.s.unit.version===2",timeout=14000)
    assert page.locator("[data-cw-action=real-script]").count()>0
    page.screenshot(path=str(files/"ui-story.png"))
    page.locator("[data-page='2']").first.click()
    page.wait_for_function("window.CWPrototype.state.page===2",timeout=14000)
    assert page.locator("[data-cw-action=real-image]").count()>0
    page.screenshot(path=str(files/"ui-assets.png"))
    page.locator("[data-page='5']").first.click()
    page.wait_for_function("window.CWPrototype.state.page===5",timeout=14000)
    assert page.locator("[data-cw-action=real-video]").count()>0
    assert page.locator("[data-cw-action=show-runs]").count()>0
    page.screenshot(path=str(files/"ui-production.png"))
    page.locator("[data-page='6']").first.click()
    page.wait_for_function("window.CWPrototype.state.page===6",timeout=14000)
    assert page.locator("[data-cw-action=real-export]").count()>0
    assert page.locator("[data-cw-action=show-timeline]").count()>0
    assert page.locator("[data-cw-action=show-renders]").count()>0
    page.screenshot(path=str(files/"ui-finishing.png"))
    assert not errors, errors
    print("PASS browser flow: approved homepage -> real project -> scene -> Mock review/adopt -> assets -> production -> finishing")
    print("Screenshots:",*[str(files/("ui-"+n+".png")) for n in ("home","story","assets","production","finishing")])
    browser.close()
