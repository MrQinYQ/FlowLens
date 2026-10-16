import {el, icon, button} from './dom.js';

/** Custom renderers receive validated components and the same rendering context. */
export function renderPrototype(screen, project, {mini = false, values = {}, errors = {}, onAction, onChange, renderers = {}} = {}) {
  const body=el('div',{class:`prototype ${mini?'prototype-mini':''}`,'data-screen':screen.id});
  body.append(el('div',{class:'prototype-chrome'},el('div',{class:'prototype-wordmark'},icon('layers',15),'工作台'),el('div',{class:'prototype-chrome-right'},el('span',{class:'proto-dot'}),el('span',{},screen.role || '用户'))));
  const content=el('div',{class:'prototype-content'});
  const context={mini,values,errors,onAction,onChange,screen,project};
  for (const component of screen.components) {
    const renderer=renderers[component.type] ?? defaultRenderers[component.type];
    if (renderer) content.append(renderer(component,context));
  }
  const outgoing=project.transitions.filter(t=>t.from===screen.id);
  if (outgoing.length) content.append(el('div',{class:'prototype-actions'},...outgoing.map((t,i)=>{
    const btn=button(t.label,mini?null:'arrow',()=>onAction?.(t),`proto-button ${t.tone==='danger'?'proto-danger':i===0?'proto-primary':'proto-secondary'}`);
    btn.dataset.action=t.id; if(mini) btn.tabIndex=-1;
    return btn;
  })));
  else content.append(el('div',{class:'prototype-end'},icon('check',16),'已到达流程终点'));
  body.append(content);
  if(mini) {body.inert=true;body.setAttribute('aria-hidden','true');}
  return body;
}

const defaultRenderers={
  heading: c=>el('div',{class:'proto-heading'},el('h2',{},c.text),c.caption?el('p',{},c.caption):null),
  text:c=>el('p',{class:'proto-text'},c.text,c.caption?el('small',{},c.caption):null),
  stats:c=>el('div',{class:'proto-stats'},...c.items.map(i=>el('div',{class:'proto-stat'},el('span',{},i.label),el('strong',{},i.value),i.caption?el('small',{},i.caption):null))),
  table:c=>el('div',{class:'proto-table-wrap'},el('table',{class:'proto-table'},el('thead',{},el('tr',{},...c.columns.map(v=>el('th',{},v)))),el('tbody',{},...c.rows.map(row=>el('tr',{},...row.map(v=>el('td',{},/^(投放中|已完成|充足)$/.test(v)?el('span',{class:'proto-status'},v):v))))))),
  fields:(c,ctx)=>el('div',{class:'proto-fields'},...c.fields.map(f=>{
    const fieldId=`field-${ctx.mini?'mini-':''}${ctx.screen.id}-${f.id}`;
    const attrs={id:fieldId,name:f.id,'data-field':f.id,'aria-invalid':Boolean(ctx.errors[f.id]),placeholder:f.placeholder,tabindex:ctx.mini?-1:0};
    let input;
    if(f.type==='select') input=el('select',attrs,...f.options.map(v=>el('option',{value:v},v)));
    else if(f.type==='textarea') input=el('textarea',{...attrs,rows:3});
    else input=el('input',{...attrs,type:f.type});
    input.value=String(ctx.values[f.id] ?? f.value);
    input.addEventListener('input',()=>ctx.onChange?.(f.id,input.value));
    if(ctx.errors[f.id]) input.setAttribute('aria-describedby',`${fieldId}-error`);
    return el('div',{class:`proto-field ${ctx.errors[f.id]?'field-error':''}`},el('label',{for:fieldId},f.label),input,ctx.errors[f.id]?el('span',{id:`${fieldId}-error`,class:'field-message',role:'alert'},ctx.errors[f.id]):null);
  })),
  callout:c=>el('div',{class:`proto-callout tone-${c.tone}`},icon(c.tone==='success'?'check':'info',18),el('div',{},el('strong',{},c.text),c.caption?el('p',{},c.caption):null)),
  list:c=>el('ul',{class:'proto-list'},...c.items.map(v=>el('li',{},el('span',{class:'list-tick'},icon('check',12)),v))),
  image:(c,ctx)=>{
    const stage=el('div',{class:'image-stage'},el('img',{src:c.src,alt:c.alt,loading:'lazy',referrerpolicy:'no-referrer'}));
    for(const spot of c.hotspots){
      const transition=ctx.project.transitions.find(t=>t.id===spot.transition);
      const hotspot=el('button',{type:'button',class:'image-hotspot','aria-label':`${transition.label}（图片热点）`,title:transition.label,onClick:()=>ctx.onAction?.(transition)},el('span',{},transition.label,icon('arrow',13)));
      Object.assign(hotspot.style,{left:`${spot.x}%`,top:`${spot.y}%`,width:`${spot.width}%`,height:`${spot.height}%`});
      stage.append(hotspot);
    }
    return el('figure',{class:'proto-image'},stage,c.alt?el('figcaption',{},c.alt):null);
  },
};
