# Smoke test: a completed Render is presented inside the approved review player's existing layout.
# Set CINEWEAVE_TEST_CONTEXT to a JSON file containing projectId, filmId, renderId.
import os,json
from pathlib import Path
from playwright.sync_api import sync_playwright
source=os.environ.get("CINEWEAVE_TEST_CONTEXT")
if not source:
 print("SKIP real-render UI: CINEWEAVE_TEST_CONTEXT not provided")
 raise SystemExit(0)
context=json.loads(Path(source).read_text())
base=os.environ.get("CINEWEAVE_TEST_BASE_URL","http://127.0.0.1:32784")
with sync_playwright() as p:
 browser=p.chromium.launch(channel="chrome",headless=True)
 page=browser.new_page(viewport={"width":1440,"height":900})
 errors=[]
 page.on("pageerror",lambda error: errors.append(str(error)))
 page.goto(base+"/approved/index.html",wait_until="networkidle",timeout=30000)
 page.wait_for_function("window.CWRuntime && window.CWPrototype",timeout=15000)
 page.locator("#cw-toggle").click()
 page.locator("#cw-project-select").select_option(context["projectId"])
 page.wait_for_function("window.CWRuntime.s.project && window.CWPrototype.state.page===1",timeout=13000)
 page.locator("[data-page='6']").first.click()
 page.wait_for_function("window.CWPrototype.state.page===6",timeout=15000)
 page.locator("#cw-close").click()
 page.locator("[data-cw-action=show-renders]").first.click()
 page.wait_for_function("document.querySelector('#demo-video')?.src?.includes('/api/media/')",timeout=15000)
 preview=page.locator("#demo-video")
 detail=preview.evaluate("""async v=>{
  await new Promise((resolve,reject)=>{if(v.readyState>=1)return resolve();
   v.onloadedmetadata=resolve;v.onerror=()=>reject(new Error('Failed to load rendered MP4'));});
  return {duration:v.duration,width:v.videoWidth,height:v.videoHeight,src:v.src};
 }""")
 assert 8<detail["duration"]<10,detail
 assert detail["width"]==1280 and detail["height"]==720,detail
 assert "真实 H3 Take" in page.locator("#review-player .player-label").inner_text()
 page.locator("#cw-close").click()
 page.locator("#demo-video").evaluate("""async v=>{
  v.muted=true;
  await v.play();
 }""")
 page.wait_for_timeout(850)
 screenshot=Path(__file__).resolve().parents[1]/".local-media"/"ui-real-finished-movie.png"
 page.screenshot(path=str(screenshot))
 assert not errors,errors
 print("PASS real finished-movie UI",detail,"screenshot",screenshot)
 browser.close()
