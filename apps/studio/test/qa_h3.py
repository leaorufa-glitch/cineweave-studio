# Inspect locally persisted RunningHub MP4 via real Chrome media decoder.
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

file=os.environ.get("CINEWEAVE_TEST_CONTEXT")
if not file:
 print("SKIP: set CINEWEAVE_TEST_CONTEXT to a local JSON fixture with a real H3 runId")
 raise SystemExit(0)
info=json.loads(Path(file).read_text())
base=os.environ.get("CINEWEAVE_TEST_BASE_URL","http://127.0.0.1:32784")
source=base+"/api/runs/"+info["runId"]
import urllib.request
run=json.load(urllib.request.urlopen(source))
assert run["status"]=="completed" and run["media_id"], run
mp4=base+"/api/media/"+run["media_id"]+"/file"
with sync_playwright() as p:
 browser=p.chromium.launch(channel="chrome",headless=True)
 page=browser.new_page(viewport={"width":1280,"height":850})
 page.goto(base+"/approved/index.html",wait_until="domcontentloaded")
 metadata=page.evaluate("""async url=>{
   const v=document.createElement('video');v.src=url;v.muted=true;v.playsInline=true;
   v.style.cssText='position:fixed;inset:10px;max-width:1000px;width:1000px;z-index:999999;background:black';
   document.body.append(v);
   await new Promise((ok,no)=>{v.onloadedmetadata=ok;v.onerror=()=>no(new Error('Video decoder load failed'));});
   await v.play();return {duration:v.duration,width:v.videoWidth,height:v.videoHeight,readyState:v.readyState};
 }""",mp4)
 page.wait_for_timeout(1100)
 out=Path(__file__).resolve().parents[1]/".local-media"/"h3-qa-frame.png"
 page.locator("video").last.screenshot(path=str(out))
 print("Chrome decoded real H3 MP4:",metadata,"frame:",out)
 browser.close()
