"""Chrome main workspace; isolated DB, no model calls."""
import os, json, uuid
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
base=os.environ.get('CINEWEAVE_TEST_BASE_URL','http://127.0.0.1:32786')
out=Path(os.environ.get('CINEWEAVE_SCREENSHOT_DIR','/tmp/cineweave-workspace'));out.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
 browser=p.chromium.launch(channel='chrome',headless=True);ctx=browser.new_context(viewport={'width':1440,'height':1000});page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(base+'/approved/index.html');page.wait_for_function('window.CWWorkspace?.state.projects');name='主流程验收 '+str(uuid.uuid4())[:8]
 def click(name): page.get_by_role('button',name=name,exact=True).first.click()
 def fill(name,value): page.locator('#cw-form [name="'+name+'"]').fill(value)
 def nav(number): page.locator('.nav-link[data-id="'+str(number)+'"]').first.click()
 click('新建影视工程');fill('name',name);fill('idea','修表人面对父亲留下的停摆腕表，选择修复而不是丢弃。');click('保存');expect(page.locator('h1')).to_have_text('故事与剧本');film=page.evaluate('CWWorkspace.state.film')
 click('新增场景 / Beat');fill('title','夜间修表');fill('content','人物目标：修好腕表。冲突：零件损坏。行动：拆开机芯。对白：再试一次。情绪：从失落到坚定。');click('保存');expect(page.get_by_text('Scene · 夜间修表')).to_be_visible()
 click('编辑');fill('content','修表人握紧工具，迟疑后再次打开父亲的旧腕表。');click('保存');page.reload();expect(page.get_by_text('修表人握紧工具，迟疑后再次打开父亲的旧腕表。')).to_be_visible();click('版本 / 比较');expect(page.get_by_text('当前正式版本 V2')).to_be_visible();click('关闭')
 nav(2);click('新建资产');fill('name','修表人');fill('variant','工作服 Look');fill('description','短发，蓝灰棉布工作服，稳定面部与服装连续性。');click('保存');expect(page.get_by_role('heading',name='修表人 · 工作服 Look').first).to_be_visible()
 nav(3);click('创建 Director Shot');fill('title','开启腕表');page.locator('[name="sceneUnitId"]').select_option(label='夜间修表');fill('description','手部近景：稳稳打开表盖。');fill('intent','呈现重新尝试的决心。');fill('camera','固定侧面近景，保持动作方向。');click('添加对白');fill('speaker','修表人');fill('text','再试一次');fill('performanceRate','0.8');fill('pauseSeconds','1.5');click('保存');expect(page.get_by_text('开启腕表 · V2')).to_be_visible()
 nav(4);click('创建 Clip');fill('title','腕表段落');fill('prompt','固定侧面近景，修表人打开旧腕表，动作克制，工具声清晰。');click('添加 Shot');fill('start','0');fill('end','12');click('保存');expect(page.get_by_role('heading',name='腕表段落').first).to_be_visible();expect(page.get_by_text('开启腕表 · V2')).to_be_visible()
 click('编辑 Shot');fill('intent','同一个 Shot 从第四区更新');click('保存');nav(3);expect(page.get_by_text('同一个 Shot 从第四区更新')).to_be_visible()
 for i in range(7):
  page.evaluate('(i)=>{CWWorkspace.state.page=i;CWWorkspace.refresh()}',i);page.wait_for_timeout(400);page.screenshot(path=str(out/f'{i}.png'),full_page=True)
 click('项目管理');click('新建影视工程');fill('name',name+' 第二工程');click('保存');expect(page.get_by_text('Scene · 夜间修表')).to_have_count(0);page.locator('#cw-project-switch').select_option(film);expect(page.get_by_text('Scene · 夜间修表')).to_be_visible();page.reload();expect(page.get_by_text('Scene · 夜间修表')).to_be_visible()
 saved=ctx.storage_state();ctx.close();ctx=browser.new_context(storage_state=saved,viewport={'width':390,'height':844});page=ctx.new_page();page.goto(base+'/approved/index.html');expect(page.get_by_text('Scene · 夜间修表')).to_be_visible();assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),'Mobile overflow';page.screenshot(path=str(out/'mobile.png'),full_page=True);assert not errors,errors
 browser.close();print(json.dumps({'result':'passed','filmId':film,'screenshots':str(out),'browserErrors':errors},ensure_ascii=False))
