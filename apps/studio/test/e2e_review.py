"""Real local test media; requires review-browser-context.json from review-fixture.mjs.
No model calls. Tests persisted timecode feedback, comparison, QA gates and routing.
"""
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

source = os.environ.get("CINEWEAVE_TEST_CONTEXT")
if not source:
    print("SKIP Take review UI: CINEWEAVE_TEST_CONTEXT not provided")
    raise SystemExit(0)
data = json.loads(Path(source).read_text())
base = os.environ.get("CINEWEAVE_TEST_BASE_URL", "http://127.0.0.1:32785")

with sync_playwright() as p:
    browser = p.chromium.launch(channel="chrome", headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 1000})
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))

    def open_review():
        page.wait_for_function("window.CWRuntime && window.CWPrototype")
        page.locator("#cw-toggle").click()
        page.locator("#cw-refresh").click()
        page.locator("#cw-project-select").select_option(data["projectId"])
        page.wait_for_function("window.CWPrototype.state.page===1")
        page.locator("#cw-close").click()
        page.locator("[data-page='6']").first.click()
        page.locator("[data-cw-action=review-takes]").click()
        page.locator("#cw-review-take").select_option(data["takeIds"][0])
        page.wait_for_function("document.querySelector('#cw-review-video')?.readyState>=1")

    page.goto(base + "/approved/index.html", wait_until="networkidle")
    open_review()
    page.locator("#cw-review-compare").select_option(data["takeIds"][1])
    page.wait_for_function("document.querySelector('#cw-compare-video')?.readyState>=1")
    assert page.locator("#cw-review-compare option").count() == 2
    page.locator("#cw-review-video").evaluate("async v=>{v.muted=true;await v.play();}")
    page.wait_for_function("document.querySelector('#cw-review-video').currentTime>0.1")
    page.locator("#cw-review-video").evaluate("v=>v.pause()")
    page.locator("#cw-review-time").fill("1.25")
    page.locator("#cw-review-target").select_option("asset:" + data["assetId"])
    page.locator("#cw-review-reason").fill("自动浏览器验收：1.25 秒钥匙变形，返回资产核对")
    page.locator("#cw-review-save").click()
    page.wait_for_function("document.querySelector('#cw-review-status')?.textContent.includes('1 个未解决问题')")
    page.locator("#cw-review-note").fill("不能绕过未解决问题")
    page.locator("[data-review-state=accepted]").click()
    page.wait_for_function("document.querySelector('#cw-review-status')?.textContent.includes('Resolve open issues')")
    page.reload(wait_until="networkidle")
    open_review()
    assert "1.25 秒钥匙变形" in page.locator("#cw-review-issues").inner_text()
    item = page.locator("#cw-review-issues .qa-item").last
    item.get_by_role("button", name="定位播放时间", exact=True).click()
    page.wait_for_function("Math.abs(document.querySelector('#cw-review-video').currentTime-1.25)<0.1")
    item.get_by_role("button", name="返回返工工作区", exact=True).click()
    page.wait_for_function("window.CWPrototype.state.page===2")
    assert "黄铜钥匙" in page.locator("#cw-preview").inner_text()
    assert data["assetId"] in page.locator("#cw-preview").inner_text()
    page.locator("#cw-close").click()
    page.locator("[data-page='6']").first.click()
    page.locator("[data-cw-action=review-takes]").click()
    page.locator("#cw-review-take").select_option(data["takeIds"][0])
    item = page.locator("#cw-review-issues .qa-item").last
    item.get_by_label("问题处理结果").fill("重新核对素材后确认；保留处理依据")
    item.get_by_role("button", name="标记已解决", exact=True).click()
    page.wait_for_function("document.querySelector('#cw-review-status')?.textContent.includes('0 个未解决问题')")
    page.locator("#cw-review-note").fill("实际播放测试音画并核对问题后，通过人工审片")
    page.locator("[data-review-state=accepted]").click()
    page.wait_for_function("document.querySelector('#cw-review-status')?.textContent.includes('人工审片通过')")
    page.locator("#cw-review-adopt").click()
    page.wait_for_function("document.querySelector('#cw-review-status')?.textContent.endsWith('已采用')")
    page.locator("#cw-review-compare").select_option(data["takeIds"][1])
    page.wait_for_function("document.querySelector('#cw-compare-video')?.readyState>=1")
    page.locator("#cw-take-review").scroll_into_view_if_needed()
    screenshot = Path(__file__).resolve().parents[1] / ".local-media" / "ui-take-review.png"
    page.screenshot(path=str(screenshot))
    assert not errors, errors
    print("PASS Take review UI: comparison, real playback, persisted timecode, QA guard, asset feedback, resolution, review and adoption")
    print("Screenshot:", screenshot)
    browser.close()
