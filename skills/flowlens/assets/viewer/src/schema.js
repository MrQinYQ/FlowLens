const TYPES = new Set(['heading', 'text', 'stats', 'table', 'fields', 'callout', 'list', 'image']);
const TONES = new Set(['neutral', 'accent', 'success', 'warning', 'danger']);
const fail = (message) => { throw new Error(message); };
const object = (v, name) => v && typeof v === 'object' && !Array.isArray(v) ? v : fail(`${name}必须是对象`);
const text = (v, name, optional = false) => {
  if (optional && v == null) return '';
  if (typeof v !== 'string' || (!optional && !v.trim()) || v.length > 10000) fail(`${name}必须是有效文本（不超过 10000 字符）`);
  return v;
};
const id = (v, name) => {
  text(v,name);
  if(Object.hasOwn(Object.prototype,v)||v==='prototype')fail(`${name}不能使用对象保留字`);
  return /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,79}$/.test(v) ? v : fail(`${name}只能包含字母、数字、点、下划线和连字符`);
};
const array = (v, name, max) => Array.isArray(v) && v.length <= max ? v : fail(`${name}必须是数组，最多 ${max} 项`);
const tone = (v) => v == null ? 'neutral' : TONES.has(v) ? v : fail('无效的状态颜色');
const scalar = (v, name) => ['string', 'number', 'boolean'].includes(typeof v) && (typeof v !== 'number' || Number.isFinite(v)) ? String(v) : fail(`${name}必须是文本、数字或布尔值`);
const unique = (items, name) => {
  const seen = new Set();
  for (const item of items) { if (seen.has(item.id)) fail(`${name} ID 重复：${item.id}`); seen.add(item.id); }
  return seen;
};

export function safeImageURL(value) {
  const src = text(value, '图片地址');
  if(/[\u0000-\u0020\u007f-\u009f\\]/.test(src))fail('图片地址不能包含空白、控制字符或反斜杠');
  if (/^https:\/\//i.test(src)) {
    try { const url = new URL(src); if (!url.username && !url.password) return src; } catch { /* reject below */ }
  }
  if (!src.includes(':') && !src.startsWith('//') && !src.startsWith('#')) {
    try{if(new URL(src,'https://flowlens.local/').origin==='https://flowlens.local')return src;}catch{/* reject below */}
  }
  fail('图片地址只支持 HTTPS 或同源相对路径');
}

function component(input) {
  const c = object(input, '组件');
  if (!TYPES.has(c.type)) fail(`不支持的组件类型：${String(c.type)}`);
  const result = {type: c.type};
  if (['heading','text','callout'].includes(c.type)) {
    result.text = text(c.text, '组件文本');
    result.caption = text(c.caption, '组件补充说明', true);
    if (c.type === 'callout') result.tone = tone(c.tone);
  }
  if (c.type === 'stats') result.items = array(c.items, '指标', 8).map(i => ({label:text(i.label, '指标名称'),value:scalar(i.value, '指标值'),caption:text(i.caption,'指标说明',true)}));
  if (c.type === 'table') {
    result.columns = array(c.columns, '表格列', 12).map(v => text(v,'表格列名'));
    result.rows = array(c.rows, '表格数据', 100).map(row => {
      if (!Array.isArray(row) || row.length !== result.columns.length) fail('表格每行必须是与列数相同的数组');
      return row.map(v => scalar(v, '表格单元格'));
    });
  }
  if (c.type === 'fields') {
    result.fields = array(c.fields, '表单字段', 30).map(f => {
      object(f, '表单字段');
      const type = f.type ?? 'text';
      if (!['text','number','select','date','textarea','email','url'].includes(type)) fail(`不支持的字段类型：${type}`);
      const field = {id:id(f.id,'字段 ID'),label:text(f.label,'字段名称'),type,value:f.value == null ? '' : scalar(f.value,'字段值'),placeholder:text(f.placeholder,'字段占位',true)};
      if (type === 'select') {
        field.options = array(f.options, '下拉选项', 100).map(v => text(v, '下拉选项'));
        if(field.value && !field.options.includes(field.value))fail(`字段 ${field.label} 的默认值不在下拉选项中`);
      }
      if(type==='number'&&field.value&&(!/^-?(?:\d+(?:\.\d+)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(field.value)||!Number.isFinite(Number(field.value))))fail(`字段 ${field.label} 的数字默认值无效`);
      if(type==='date'&&field.value){
        const date=new Date(`${field.value}T00:00:00Z`);
        if(!/^\d{4}-\d{2}-\d{2}$/.test(field.value)||field.value.startsWith('0000')||!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==field.value)fail(`字段 ${field.label} 的日期默认值无效，请使用 YYYY-MM-DD`);
      }
      return field;
    });
  }
  if (c.type === 'list') result.items = array(c.items, '列表', 100).map(v => text(v, '列表文本'));
  if (c.type === 'image') {
    result.src = safeImageURL(c.src); result.alt = text(c.alt, '图片说明', true);
    result.hotspots=array(c.hotspots??[],'图片热点',30).map(h=>{
      object(h,'图片热点');
      if(![h.x,h.y,h.width,h.height].every(Number.isFinite)||h.x<0||h.y<0||h.width<=0||h.height<=0||h.x+h.width>100||h.y+h.height>100)fail('图片热点坐标必须在图片范围内，使用 0 到 100 的百分比');
      return {transition:id(h.transition,'热点交互 ID'),x:h.x,y:h.y,width:h.width,height:h.height};
    });
  }
  return result;
}

/** Validate and clone data before replacing a currently loaded project. */
export function validateProject(input) {
  if (typeof input === 'string') {
    if (new TextEncoder().encode(input).length > 2 * 1024 * 1024) fail('JSON 文件不能超过 2 MB');
    try { input = JSON.parse(input); } catch { fail('JSON 格式错误，请检查逗号、引号和括号'); }
  }
  object(input, '项目');
  let encoded;
  try { encoded = JSON.stringify(input); } catch { fail('项目必须是可序列化的 JSON 数据'); }
  if (new TextEncoder().encode(encoded).length > 2 * 1024 * 1024) fail('项目数据不能超过 2 MB');
  if (input.version !== 1) fail('不支持的数据版本，version 必须为 1');
  const project = {version:1,id:id(input.id,'项目 ID'),title:text(input.title,'项目名称'),description:text(input.description,'项目说明',true),demo:input.demo !== false};
  if (input.source != null) { object(input.source, '来源'); project.source = {label:text(input.source.label,'来源名称',true),status:text(input.source.status,'来源状态',true)}; }
  project.modules = array(input.modules, '模块', 30).map(m => ({id:id(m.id,'模块 ID'),title:text(m.title,'模块名称'),description:text(m.description,'模块说明',true)}));
  const modules = unique(project.modules,'模块');
  project.screens = array(input.screens, '页面', 100).map(s => {
    object(s, '页面');
    if (![s.x,s.y].every(n => Number.isFinite(n) && Math.abs(n) <= 100000)) fail('页面坐标必须是 -100000 到 100000 之间的有限数字');
    if (!modules.has(s.module)) fail(`页面 ${s.id} 的模块引用不存在`);
    const width = s.width ?? 320, height = s.height ?? 320;
    if (![width,height].every(n => Number.isFinite(n) && n >= 220 && n <= 1200)) fail('页面尺寸必须在 220 到 1200 之间');
    const screen = {id:id(s.id,'页面 ID'),module:s.module,title:text(s.title,'页面名称'),description:text(s.description,'页面说明',true),kind:text(s.kind ?? 'page','页面类型'),x:s.x,y:s.y,width,height,status:text(s.status,'页面状态',true),role:text(s.role,'操作角色',true),entry:s.entry === true,notes:array(s.notes ?? [],'页面说明',30).map(v=>text(v,'页面说明')),components:array(s.components,'页面组件',40).map(component)};
    unique(screen.components.filter(c=>c.type==='fields').flatMap(c=>c.fields),'表单字段');
    return screen;
  });
  if (!project.screens.length) fail('至少需要一个页面');
  const screens = unique(project.screens,'页面');
  project.transitions = array(input.transitions, '交互连线', 300).map(t => {
    object(t,'交互');
    if (!screens.has(t.from) || !screens.has(t.to)) fail(`交互 ${t.id} 的来源或目标页面不存在`);
    const requiredFields = array(t.requiredFields ?? [],'必填字段',30).map(v=>id(v,'必填字段'));
    const source = project.screens.find(s=>s.id===t.from);
    const fields = new Set(source.components.filter(c=>c.type==='fields').flatMap(c=>c.fields).map(f=>f.id));
    for (const field of requiredFields) if (!fields.has(field)) fail(`交互 ${t.id} 的必填字段 ${field} 不存在于来源页面`);
    return {id:id(t.id,'交互 ID'),from:t.from,to:t.to,label:text(t.label,'交互名称'),trigger:text(t.trigger,'触发方式',true) || '点击按钮',description:text(t.description,'交互说明',true),condition:text(t.condition,'前置条件',true),outcome:text(t.outcome,'反馈结果',true),tone:tone(t.tone),requiredFields,rules:array(t.rules ?? [],'交互规则',30).map(v=>text(v,'交互规则'))};
  });
  unique(project.transitions,'交互');
  for(const screen of project.screens)for(const image of screen.components.filter(c=>c.type==='image'))for(const hotspot of image.hotspots){
    if(!project.transitions.some(t=>t.id===hotspot.transition&&t.from===screen.id))fail(`图片热点 ${hotspot.transition} 必须引用从当前页面发起的交互`);
  }
  return project;
}

export function resolveInteraction(project, transitionId, values = {}) {
  const action = project.transitions.find(t=>t.id===transitionId);
  if (!action) fail('交互不存在');
  const source = project.screens.find(s=>s.id===action.from);
  const fields = source.components.filter(c=>c.type==='fields').flatMap(c=>c.fields);
  const errors = {};
  for (const key of action.requiredFields) {
    const field = fields.find(f=>f.id===key);
    if (!String(values[key] ?? field.value ?? '').trim()) errors[key] = `请填写${field.label}`;
  }
  return {ok:!Object.keys(errors).length,target:Object.keys(errors).length ? null : action.to,errors};
}
