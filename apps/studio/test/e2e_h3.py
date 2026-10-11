"""H3 planning/production browser acceptance on an isolated database; no paid submit."""
import json, os, uuid
from playwright.sync_api import sync_playwright, expect
base=os.environ['CINEWEAVE_TEST_BASE_URL']
assert os.environ['CINEWEAVE_TEST_DATABASE_URL'].endswith('_test')
with sync_playwright() as p:
 browser=p.chromium.launch(channel='chrome',headless=True)
 page=browser.new_page(viewport={'width':1440,'height':1000});errors=[]
 page.on('pageerror',lambda error:errors.append(str(error)))
 def post(path,body):
  result=page.request.post(base+'/api/'+path,data=body)
  assert result.status in (200,201),(path,result.status,result.text())
  return result.json()
 project=post('projects',{'name':'H3 UI '+str(uuid.uuid4()),'idea':'A watchmaker chooses to try again'})
 film=project['filmId'];unit=post(f'films/{film}/units',{'kind':'scene','title':'Workbench','content':'The stopped watch makes her hesitate.'})
 shot=post(f'films/{film}/shots',{'sceneUnitId':unit['id'],'title':'Held decision','description':'One uninterrupted camera view'})
 clip=post(f'films/{film}/clips',{'title':'Decision','prompt':'Legacy director brief','seconds':8})
 post(f'clips/{clip["id"]}/shots',{'shotId':shot['id'],'clipStartSeconds':0,'clipEndSeconds':8})
 plan={'version':1,'style':'Restrained live action under a warm desk lamp','opening':'A watchmaker studies the stopped watch','beats':[{'id':'first','shotId':shot['id'],'startSeconds':0,'endSeconds':3,'composition':'A medium close view holds her face and hands','cause':'The watch has stopped','action':'She lifts the watch toward her ear','effect':'She hears no tick','camera':'The camera holds still','performance':'Her eyes narrow','sound':'Only room tone is heard'},{'id':'second','shotId':shot['id'],'startSeconds':3,'endSeconds':8,'composition':'The same uncut frame holds her and the watch','cause':'The silence confirms the failure','action':'She sets the watch down and takes up tweezers','effect':'She chooses another attempt','camera':'The camera pushes forward slowly','performance':'Her breath settles','sound':'A small metal click marks the decision'}],'soundscape':'Room tone, breathing and one soft metal click.','music':'N/A','directorConstraints':['Preserve one uncut Director Shot'],'referenceUses':[]}
 page.goto(base+'/approved/index.html');page.wait_for_function('window.CWWorkspace')
 page.evaluate('(film)=>CWWorkspace.openFilm(film)',film)
 page.locator('.nav-link[data-id="4"]').click()
 page.get_by_role('button',name='编辑视听执行计划 / 引用 / Shot 映射').click()
 page.locator('#cw-form [name="executionPlan"]').fill(json.dumps(plan))
 page.get_by_role('button',name='保存',exact=True).click()
 expect(page.get_by_role('dialog')).to_have_count(0)
 expect(page.get_by_role('heading',name='Decision').first).to_be_visible()
 saved=page.request.get(base+f'/api/films/{film}/workspace').json()['clips'][0]
 assert saved['plan']['executionPlan']==plan
 page.get_by_role('button',name='H3 只读编译预览').click()
 page.get_by_role('button',name='生成预览并检查').click()
 dialog=page.get_by_role('dialog')
 expect(dialog.get_by_text('只允许离线预览')).to_be_visible()
 assert dialog.get_by_role('button',name='确认并冻结此输入').count()==0
 assert '[Shot 2]' not in dialog.locator('[name="compiledPrompt"]').input_value()
 page.get_by_role('button',name='关闭').click()
 page.locator('.nav-link[data-id="5"]').click()
 page.get_by_role('button',name='编译 / 审阅 H3 输入').click()
 page.get_by_role('button',name='生成预览并检查').click()
 dialog=page.get_by_role('dialog');expect(dialog.get_by_text('可提交')).to_be_visible()
 dialog.get_by_role('button',name='确认并冻结此输入').click()
 page.get_by_role('button',name='选择已冻结输入').click()
 expect(page.get_by_role('dialog').get_by_text('当前版本')).to_be_visible()
 page.get_by_role('button',name='选用此输入').click()
 frozen=page.request.get(base+f'/api/clips/{clip["id"]}/h3-compilations').json()
 assert len(frozen)==1 and frozen[0]['mode']=='T2VA'
 assert not errors,errors
 print(json.dumps({'result':'passed','filmId':film,'compilationId':frozen[0]['id'],'pageErrors':errors},ensure_ascii=False))
 browser.close()
