"""Chrome + real FFmpeg technical media. Uses an isolated database, no paid models."""
import os,json,subprocess,hashlib
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
os.chdir(Path(__file__).resolve().parent.parent)
base=os.environ.get('CINEWEAVE_TEST_BASE_URL','http://127.0.0.1:32786');url=os.environ['CINEWEAVE_TEST_DATABASE_URL'];assert url.endswith('_test')
ctx_file='.local-media/finishing-browser-context.json';env={**os.environ,'DATABASE_URL':url,'DARL_API_KEY':''};out=Path(os.environ.get('CINEWEAVE_SCREENSHOT_DIR','/tmp/cineweave-finishing'));out.mkdir(parents=True,exist_ok=True)
subprocess.run(['node','test/review-fixture.mjs','--create',ctx_file],env=env,check=True);fixture=json.loads(Path(ctx_file).read_text());source=Path(fixture['directory'])/'take-0.mp4';original=hashlib.sha256(source.read_bytes()).hexdigest()
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(channel='chrome',headless=True);page=browser.new_page(viewport={'width':1440,'height':1000});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(base+'/approved/index.html');page.wait_for_function('window.CWWorkspace');page.evaluate('(f)=>CWWorkspace.openFilm(f)',fixture['filmId']);expect(page.locator('h1')).to_have_text('故事与剧本')
  page.locator('.nav-link[data-id="6"]').click();page.locator('[data-cw="select-take"][data-id="'+fixture['takeIds'][0]+'"]').click();page.wait_for_function('document.querySelector("#cw-player").duration>0');assert 3.9<page.locator('#cw-player').evaluate('v=>v.duration')<4.2
  def click(name):page.get_by_role('button',name=name,exact=True).first.click()
  click('时间码批注 / 问题');dialog=page.get_by_role('dialog');dialog.locator('[name="time"]').fill('1.25');dialog.locator('[name="target"]').select_option('take:'+fixture['takeIds'][0]);dialog.locator('[name="reason"]').fill('技术夹具示例反馈：验证时间码与Take返工记录，不是影视艺术审片结论。');click('记录时间码问题');expect(dialog.get_by_text('1.25s · 拍摄结果 · 待处理')).to_be_visible();click('关闭');page.reload();expect(page.locator('h1')).to_have_text('审片与成片');click('时间码批注 / 问题');expect(page.get_by_role('dialog').get_by_text('1.25s · 拍摄结果 · 待处理')).to_be_visible()
  dialog=page.get_by_role('dialog');dialog.locator('[name^="resolution-"]').fill('已核验真实四秒音视频及定位记录，技术问题闭环。');click('解决此问题');expect(dialog.get_by_text('1.25s · 拍摄结果 · 已解决')).to_be_visible();dialog.locator('[name="reviewNote"]').fill('色块与正弦音技术夹具通过；不代表模型成片质量。');click('通过审阅');click('采用 Take');expect(page.get_by_text('已采用',exact=True)).to_be_visible();click('加入时间线');expect(page.get_by_text('正式时间线 · V1')).to_be_visible()
  click('编辑时间线');dialog=page.get_by_role('dialog');dialog.locator('[name="in"]').fill('0.25');dialog.locator('[name="out"]').fill('3.5');dialog.locator('[name="volume"]').fill('0.8');dialog.locator('[name="fadeIn"]').fill('0.2');dialog.locator('[name="fadeOut"]').fill('0.3');click('保存');expect(page.get_by_text('正式时间线 · V2')).to_be_visible();click('FFmpeg 导出 MP4')
  subprocess.run(['node','--experimental-strip-types','--input-type=module','-e',"const {renderOneIfWaiting}=await import('./src/lib/render-worker.ts');const {db}=await import('./src/lib/db.ts');await renderOneIfWaiting();await db().end();"],env={**env,'MEDIA_ROOT':fixture['directory']},check=True,timeout=60)
  click('刷新');expect(page.get_by_role('link',name='下载 MP4')).to_be_visible();link=page.get_by_role('link',name='下载 MP4');response=page.request.get(base+link.get_attribute('href'));assert response.status==200;output=out/'technical-trimmed.mp4';output.write_bytes(response.body());probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_format','-show_streams','-of','json',str(output)]));assert 3.2<float(probe['format']['duration'])<3.6;assert any(s['codec_type']=='audio' for s in probe['streams']);assert hashlib.sha256(source.read_bytes()).hexdigest()==original
  page.screenshot(path=str(out/'review-render.png'),full_page=True);assert not errors,errors;browser.close();print(json.dumps({'result':'passed','duration':probe['format']['duration'],'originalHashUnchanged':True,'screenshots':str(out)},ensure_ascii=False))
finally:subprocess.run(['node','test/review-fixture.mjs','--cleanup',ctx_file],env=env,check=True)
