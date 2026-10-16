import {el, icon, button, iconButton} from './dom.js';
import {validateProject, resolveInteraction} from './schema.js';
import {FlowCanvas} from './canvas.js';
import {renderPrototype} from './prototype.js';

/** Business-agnostic viewer. The host owns the supplied root and data. */
export class PrototypeExplorer {
  constructor({root, data, renderers = {}, examples = []}) {
    if (!(root instanceof HTMLElement)) throw new Error('root 必须是一个 HTML 元素');
    this.root=root;this.renderers=renderers;this.examples=examples;this.load(data);
  }

  load(data) {
    const project=validateProject(data);
    this.exampleToken=(this.exampleToken??0)+1;
    this.canvas?.destroy();this.appAbort?.abort();clearTimeout(this.toastTimer);
    this.project=project;this.values={};this.errors={};this.history=[];this.mode='flow';this.module='all';
    this.selection={type:'screen',id:(project.screens.find(s=>s.entry)||project.screens[0]).id};
    this.appAbort=new AbortController();this.build();
  }

  build() {
    const p=this.project;
    const brand=el('div',{class:'brand'},el('div',{class:'brand-symbol'},icon('flow',23)),el('strong',{},'FlowLens'),el('span',{class:'brand-divider'}),el('span',{class:'brand-caption'},'让产品逻辑，看得见'));
    const header=el('header',{class:'app-header'},brand,
      el('div',{class:'header-actions'},el('span',{class:'local-badge'},el('i'),'仅本地处理'),
        iconButton('使用帮助','help',()=>this.helpDialog()),button('导出 JSON','download',()=>this.exportData(),'button button-quiet'),button('导入项目','upload',()=>this.importDialog(),'button button-outline'),button('演示原型','play',()=>this.openPreview(),'button button-dark')));
    this.sidebar=el('aside',{class:'sidebar','aria-label':'页面目录'});
    this.inspector=el('aside',{class:'inspector','aria-label':'页面与交互详情'});
    this.canvasRoot=el('div',{class:'canvas-surface'});
    this.previewRoot=el('div',{class:'preview-surface',hidden:true});
    const projectBadge=el('span',{class:`project-badge ${p.demo?'is-demo':''}`},el('i'),p.demo?'示例项目':'已导入项目');
    const titleRow=el('div',{class:'project-heading'},el('div',{},el('div',{class:'project-eyebrow'},icon('layers',13),'产品体验地图',projectBadge),el('h1',{},p.title),el('p',{},p.description)),
      el('div',{class:'project-summary'},el('div',{},el('strong',{},String(p.screens.length).padStart(2,'0')),el('span',{},'页面原型')),el('span',{class:'summary-divider'}),el('div',{},el('strong',{},String(p.transitions.length).padStart(2,'0')),el('span',{},'交互连线'))));
    this.flowTab=button('流程总览','flow',()=>this.setMode('flow'),'view-tab active');this.flowTab.setAttribute('role','tab');
    this.previewTab=button('原型演示','play',()=>this.openPreview(),'view-tab');this.previewTab.setAttribute('role','tab');
    this.scope=el('select',{'aria-label':'筛选模块',class:'scope-select',onChange:()=>{this.module=this.scope.value;this.canvas.filter(this.module);}},el('option',{value:'all'},'全部模块'),...p.modules.map(m=>el('option',{value:m.id},m.title)));
    this.viewHint=el('div',{class:'view-hint'},el('span',{class:'legend-dot'}),'主流程',el('span',{class:'legend-dot legend-danger'}),'异常分支');
    const toolbar=el('div',{class:'workspace-toolbar'},el('div',{class:'view-tabs',role:'tablist','aria-label':'查看模式'},this.flowTab,this.previewTab),el('div',{class:'workspace-toolbar-right'},this.viewHint,this.scope));
    this.workspace=el('main',{class:'workspace'},titleRow,toolbar,el('div',{class:'workspace-content'},this.canvasRoot,this.previewRoot));
    const footer=el('footer',{class:'app-footer'},el('div',{},icon('check',12),'浏览器内运行 · 数据不会上传'),el('div',{},'FlowLens',el('span',{},' / '),'原型与交互工作空间',el('kbd',{},'?'),'快捷帮助'));
    this.toastRoot=el('div',{class:'toast-region','aria-live':'polite'});
    this.root.replaceChildren(el('div',{class:'app-shell'},header,el('div',{class:'app-body'},this.sidebar,this.workspace,this.inspector),footer),this.toastRoot);
    this.renderSidebar();
    this.canvas=new FlowCanvas(this.canvasRoot,p,{onSelect:s=>this.select(s),onOpen:id=>this.openPreview(id),renderers:this.renderers});
    this.select(this.selection);this.setMode('flow');
    this.bindKeys();
  }

  renderSidebar() {
    const p=this.project;
    this.search=el('input',{type:'search',placeholder:'搜索页面或交互…','aria-label':'搜索页面或交互',onInput:()=>this.renderPageList()});
    this.pageList=el('nav',{class:'page-list','aria-label':'页面导航'});
    const examples=el('select',{'aria-label':'切换示例项目',class:'example-select',onChange:async e=>{
      const value=e.target.value;if(!value)return;
      const token=(this.exampleToken??0)+1;this.exampleToken=token;
      try {
        const example=this.examples.find(e=>e.id===value);if(!example)throw new Error('示例不存在');
        let data=example.data;
        if(!data){const response=await fetch(example.url);if(!response.ok)throw new Error('示例读取失败');data=await response.json();}
        if(this.exampleToken!==token)return;this.load(data);this.toast('已切换示例，页面和流程已一起更新');
      }
      catch(error){this.toast(error.message,'error');}
    }},el('option',{value:''},'切换另一套示例'),...this.examples.map(example=>el('option',{value:example.id},example.title)));
    this.sidebar.replaceChildren(
      el('div',{class:'sidebar-top'},el('div',{class:'workspace-label'},el('span',{class:'workspace-avatar'},'F'),el('div',{},el('strong',{},'我的工作空间'),el('small',{},'LOCAL WORKSPACE'))),el('div',{class:'sidebar-section-title'},el('span',{},'页面目录'),el('span',{class:'count-badge'},p.screens.length)),el('div',{class:'search-box'},icon('search',15),this.search,el('kbd',{},'/'))),
      this.pageList,
      el('div',{class:'sidebar-bottom'},el('div',{class:'data-source'},el('div',{class:'data-source-title'},icon('info',15),p.demo?'示例数据说明':'项目数据来源'),el('p',{},p.demo?'当前为通用示例，可通过 JSON 替换为你的产品。':p.source?.label||'内容来自你导入的 JSON 项目。'),el('span',{class:'source-status'},p.source?.status||'内容由项目数据提供')),this.examples.length?el('label',{class:'example-label'},'探索不同的业务流程',examples):null,button('数据格式与导入','code',()=>this.importDialog(),'sidebar-data-button'))
    );
    this.renderPageList();
  }

  renderPageList() {
    const query=this.search.value.trim().toLowerCase();
    let count=0;this.pageList.replaceChildren();
    for(const m of this.project.modules) {
      const pages=this.project.screens.filter(s=>s.module===m.id && (!query||`${s.title} ${s.description} ${this.project.transitions.filter(t=>t.from===s.id||t.to===s.id).map(t=>t.label).join(' ')}`.toLowerCase().includes(query)));
      if(!pages.length)continue;count+=pages.length;
      const group=el('details',{class:'page-group',open:true},el('summary',{},el('span',{class:'group-label'},icon('down',12),m.title),el('span',{},String(pages.length).padStart(2,'0'))));
      for(const s of pages){
        const index=this.project.screens.findIndex(page=>page.id===s.id)+1;
        const btn=button(s.title,s.kind==='form'?'page':s.kind==='detail'?'branches':'grid',()=>this.navigate(s.id),'page-nav-button');
        btn.dataset.page=s.id;btn.append(el('small',{},String(index).padStart(2,'0')));group.append(btn);
      }
      this.pageList.append(group);
    }
    if(!count)this.pageList.append(el('div',{class:'search-empty'},icon('search',24),el('strong',{},'没有找到相关页面'),el('p',{},'试试页面名称或操作关键词')));
    this.syncPageSelection();
  }

  syncPageSelection() {
    const selectedId=this.selection.type==='screen'?this.selection.id:this.project.transitions.find(t=>t.id===this.selection.id)?.from;
    for(const item of this.pageList.querySelectorAll('[data-page]')){const active=item.dataset.page===selectedId;item.classList.toggle('active',active);item.setAttribute('aria-current',active?'page':'false');}
  }

  select(selection) {
    this.selection=selection;this.canvas?.select(selection);this.syncPageSelection();this.renderInspector();
  }

  navigate(id) {
    if(this.mode==='preview'){this.goTo(id,'目录定位');return;}
    if(this.module!=='all'&&!this.project.screens.some(s=>s.id===id&&s.module===this.module)){this.module='all';this.scope.value='all';this.canvas.filter('all');}
    this.select({type:'screen',id});this.canvas.focus(id);
  }

  renderInspector() {
    const p=this.project, isEdge=this.selection.type==='transition';
    const item=(isEdge?p.transitions:p.screens).find(v=>v.id===this.selection.id);
    if(!item)return;
    const section=(title,content)=>el('section',{class:'detail-section'},el('h3',{},title),content);
    const detail=el('div',{class:'inspector-scroll'},
      el('div',{class:'detail-hero'},el('div',{class:`detail-symbol ${isEdge?'is-edge':''}`},icon(isEdge?'branches':item.kind==='form'?'page':'grid',23)),el('span',{class:'detail-eyebrow'},isEdge?'INTERACTION DETAIL':'PAGE DETAIL'),el('h2',{},isEdge?item.label:item.title),el('p',{},item.description||(isEdge?'查看这次操作如何连接两个页面。':'查看页面结构和相关操作。'))));
    if(isEdge){
      const from=p.screens.find(s=>s.id===item.from),to=p.screens.find(s=>s.id===item.to);
      detail.append(section('页面流转',el('div',{class:'transition-route'},button(from.title,'page',()=>this.navigate(from.id),'route-page'),el('div',{class:'route-arrow'},icon('arrow',15),el('span',{},item.trigger)),button(to.title,'page',()=>this.navigate(to.id),'route-page'))));
      if(item.condition)detail.append(section('前置条件',el('p',{class:'detail-copy'},item.condition)));
      if(item.outcome)detail.append(section('操作后的反馈',el('div',{class:`outcome-box tone-${item.tone}`},icon('check',15),item.outcome)));
      const fields=p.screens.find(s=>s.id===item.from).components.filter(c=>c.type==='fields').flatMap(c=>c.fields);
      const rules=[...item.requiredFields.map(id=>`必填校验：${fields.find(f=>f.id===id).label}`),...item.rules];
      if(rules.length)detail.append(section('交互规则',el('ul',{class:'detail-rules'},...rules.map((v,i)=>el('li',{},el('span',{},String(i+1).padStart(2,'0')),v)))));
      detail.append(el('div',{class:'detail-tip'},icon('info',14),'条件与反馈是流程说明；演示只执行显式配置的必填校验和页面跳转。'));
    }else{
      const module=p.modules.find(m=>m.id===item.module),outgoing=p.transitions.filter(t=>t.from===item.id),incoming=p.transitions.filter(t=>t.to===item.id);
      detail.append(section('页面信息',el('dl',{class:'detail-properties'},el('div',{},el('dt',{},'所属模块'),el('dd',{},module.title)),el('div',{},el('dt',{},'操作角色'),el('dd',{},item.role||'未指定')),el('div',{},el('dt',{},'页面状态'),el('dd',{},el('span',{class:'state-pill'},item.status||'页面原型'))),el('div',{},el('dt',{},'关联交互'),el('dd',{},`${incoming.length} 个入口 / ${outgoing.length} 个出口`)))));
      if(outgoing.length)detail.append(section('从这里可以…',el('div',{class:'interaction-list'},...outgoing.map(t=>el('button',{type:'button',class:`interaction-card tone-${t.tone}`,onClick:()=>this.select({type:'transition',id:t.id})},el('div',{},el('strong',{},t.label),el('span',{},'前往 ',p.screens.find(s=>s.id===t.to).title)),icon('arrow',16))))));
      else detail.append(section('流程状态',el('div',{class:'outcome-box tone-success'},icon('check',15),'已到达流程终点')));
      if(item.notes.length)detail.append(section('理解这个页面',el('ul',{class:'detail-notes'},...item.notes.map(n=>el('li',{},n)))));
    }
    const previewId=isEdge?item.from:item.id;
    this.inspector.replaceChildren(el('div',{class:'inspector-title'},el('span',{},isEdge?'交互说明':'页面详情'),el('span',{class:'inspector-live'},el('i'),'已选中')),detail,el('div',{class:'inspector-bottom'},button(isEdge?'体验这段交互':'从此页开始演示','play',()=>this.openPreview(previewId),'button button-accent'),el('span',{},'点击按钮，亲自走一遍流程')));
  }

  setMode(mode) {
    this.mode=mode;this.canvasRoot.hidden=mode!=='flow';this.previewRoot.hidden=mode!=='preview';
    this.flowTab.classList.toggle('active',mode==='flow');this.previewTab.classList.toggle('active',mode==='preview');
    this.flowTab.setAttribute('aria-selected',String(mode==='flow'));this.previewTab.setAttribute('aria-selected',String(mode==='preview'));
    this.scope.hidden=mode!=='flow';this.viewHint.hidden=mode!=='flow';
    if(mode==='flow')requestAnimationFrame(()=>this.canvas.applyView());
  }

  openPreview(id) {
    if(!id && this.mode==='preview')return;
    if(!id)id=this.selection.type==='screen'?this.selection.id:this.project.transitions.find(t=>t.id===this.selection.id).from;
    this.history=[{id,via:'演示起点'}];this.errors={};this.setMode('preview');this.select({type:'screen',id});this.renderPreview();
  }

  goTo(id,via) {
    this.history.push({id,via});this.errors={};this.select({type:'screen',id});this.renderPreview();
  }

  renderPreview() {
    const current=this.history.at(-1),screen=this.project.screens.find(s=>s.id===current.id);
    const back=iconButton('返回上一步','back',()=>{if(this.history.length>1){this.history.pop();this.errors={};this.select({type:'screen',id:this.history.at(-1).id});this.renderPreview();}});back.disabled=this.history.length<=1;
    const trail=el('div',{class:'preview-trail'},...this.history.flatMap((step,index)=>{
      const btn=el('button',{type:'button',class:index===this.history.length-1?'current':'',title:step.via,onClick:()=>{this.history=this.history.slice(0,index+1);this.errors={};this.select({type:'screen',id:step.id});this.renderPreview();}},this.project.screens.find(s=>s.id===step.id).title);
      return index?[icon('chevron',12),btn]:[btn];
    }));
    const prototype=renderPrototype(screen,this.project,{values:this.values[screen.id]??{},errors:this.errors,renderers:this.renderers,onChange:(field,value)=>{this.values[screen.id]??={};this.values[screen.id][field]=value;},onAction:transition=>{
      const result=resolveInteraction(this.project,transition.id,this.values[screen.id]??{});
      if(!result.ok){this.errors=result.errors;this.renderPreview();this.previewRoot.querySelector('[aria-invalid="true"]')?.focus();return;}
      this.goTo(result.target,transition.label);this.toast(transition.outcome||`已进入${this.project.screens.find(s=>s.id===result.target).title}`);
    }});
    this.previewRoot.replaceChildren(el('div',{class:'preview-navigation'},back,trail,button('重新开始','reset',()=>this.openPreview(this.history[0].id),'restart-button')),el('div',{class:'preview-stage'},el('div',{class:'preview-window'},el('div',{class:'browser-bar'},el('div',{class:'window-dots'},el('i'),el('i'),el('i')),el('span',{},icon('link',12),`prototype.local / ${screen.id}`),el('span',{class:'prototype-label'},'交互原型')),prototype),el('div',{class:'preview-caption'},el('span',{class:'live-dot'}),'演示模式 · 操作按钮体验跳转与校验',el('span',{},'表单内容仅保留在本次会话'))));
    requestAnimationFrame(()=>trail.scrollLeft=trail.scrollWidth);
  }

  importDialog() {
    const textarea=el('textarea',{'aria-label':'项目 JSON',class:'json-input',spellcheck:false,placeholder:'将完整的项目 JSON 粘贴到这里，或选择一个 .json 文件…'});
    const error=el('p',{class:'import-error',role:'alert'});
    const fileName=el('span',{class:'file-name'},'支持 .json · 最大 2 MB');
    const input=el('input',{type:'file',accept:'.json,application/json','aria-label':'选择 JSON 文件',class:'file-input',onChange:async()=>{
      const file=input.files[0];if(!file)return;
      if(file.size>2*1024*1024){error.textContent='文件不能超过 2 MB';return;}
      try{textarea.value=await file.text();fileName.textContent=file.name;error.textContent='';}catch{error.textContent='无法读取文件，请重试。';}
    }});
    const sample=JSON.stringify({version:1,id:'my-project',title:'我的产品',description:'产品说明',demo:false,modules:[{id:'main',title:'主流程'}],screens:[{id:'home',module:'main',title:'首页',kind:'page',x:0,y:0,entry:true,components:[{type:'heading',text:'你好，新的产品'}]}],transitions:[]},null,2);
    const body=el('div',{class:'import-body'},el('p',{class:'dialog-intro'},'页面、原型内容和交互连线由同一份 JSON 驱动。导入另一份数据，即可切换为新的产品。'),el('div',{class:'import-upload'},icon('upload',24),el('div',{},el('strong',{},'选择项目数据文件'),fileName),el('label',{class:'button button-outline file-picker'},'选择文件',input)),
      el('div',{class:'json-label'},el('label',{},'或者粘贴 JSON'),el('button',{type:'button',onClick:()=>{textarea.value=sample;error.textContent='';}},'填入最小示例')),textarea,error,
      el('div',{class:'import-note'},icon('info',15),'导入内容仅在浏览器内处理。格式有误时会保留当前项目。'));
    const dialog=this.dialog('导入原型与流程',body,()=>{
      try{const data=validateProject(textarea.value);dialog.close();this.load(data);this.toast(`已载入「${data.title}」`);}catch(e){error.textContent=e.message;}
    },'加载到画布');
  }

  dialog(title,body,onConfirm,confirmLabel='知道了') {
    this.root.querySelector('dialog')?.remove();
    const dialog=el('dialog',{class:'modal','aria-label':title},el('div',{class:'modal-header'},el('div',{},el('span',{class:'modal-eyebrow'},'FLOWLENS WORKSPACE'),el('h2',{},title)),iconButton('关闭对话框','close',()=>dialog.close())),body,el('div',{class:'modal-footer'},button('取消',null,()=>dialog.close(),'button button-quiet'),button(confirmLabel,onConfirm?'arrow':'check',()=>onConfirm?onConfirm():dialog.close(),'button button-accent')));
    dialog.addEventListener('close',()=>dialog.remove(),{once:true});this.root.append(dialog);dialog.showModal();return dialog;
  }

  helpDialog() {
    const rows=[['拖动画布','在空白区域按住鼠标拖动；按住空格可从页面上方拖动画布。'],['缩放与定位','滚轮缩放，工具栏 + / − 调整。点击小地图快速定位，F 或 0 适应全图。'],['移动页面','拖动页面卡片顶部，重新安排位置。导出 JSON 可保留当前布局。'],['查看交互','点击页面或连线查看说明；双击页面进入演示，点击按钮体验跳转。'],['替换内容','导入符合 v1 格式的 JSON；也可以先导出当前示例作为模板。']];
    this.dialog('用一张画布，理解整个产品',el('div',{class:'help-body'},...rows.map(([title,desc],i)=>el('div',{class:'help-row'},el('span',{},String(i+1).padStart(2,'0')),el('div',{},el('h3',{},title),el('p',{},desc)))),el('div',{class:'shortcut-row'},...['/ 搜索','P 演示','G 总览','F 适应','? 帮助'].map(v=>el('kbd',{},v)))));
  }

  exportData() {
    const url=URL.createObjectURL(new Blob([JSON.stringify(this.project,null,2)+'\n'],{type:'application/json'}));
    const link=el('a',{href:url,download:`${this.project.id}.json`});document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);this.toast('项目已导出，包含页面、交互和当前布局');
  }

  toast(message,type='success') {
    clearTimeout(this.toastTimer);this.toastRoot.replaceChildren(el('div',{class:`toast ${type==='error'?'toast-error':''}`},icon(type==='error'?'info':'check',16),message));this.toastTimer=setTimeout(()=>this.toastRoot.replaceChildren(),3500);
  }

  bindKeys() {
    document.addEventListener('keydown',e=>{
      if(e.ctrlKey||e.metaKey||e.altKey||e.target.closest('input,textarea,select,[contenteditable],dialog'))return;
      if(this.root.querySelector('dialog[open]'))return;
      if(e.key==='/'){e.preventDefault();this.search.focus();}
      else if(e.key==='?'){e.preventDefault();this.helpDialog();}
      else if(e.key.toLowerCase()==='p')this.openPreview();
      else if(e.key.toLowerCase()==='g'||e.key==='Escape')this.setMode('flow');
      else if(this.mode==='flow'){
        if(['f','F','0'].includes(e.key)){e.preventDefault();this.canvas.fit();}
        if(['+','='].includes(e.key)){e.preventDefault();this.canvas.zoom(1.2);}
        if(e.key==='-'){e.preventDefault();this.canvas.zoom(1/1.2);}
      }
    },{signal:this.appAbort.signal});
  }

  destroy(){this.exampleToken=(this.exampleToken??0)+1;this.canvas.destroy();this.appAbort.abort();clearTimeout(this.toastTimer);this.root.querySelector('dialog')?.close();this.root.replaceChildren();}
}
