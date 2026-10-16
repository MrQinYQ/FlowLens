import {el, icon, iconButton, svgEl} from './dom.js';
import {bounds, fitViewport, zoomAt, edgePath} from './geometry.js';
import {renderPrototype} from './prototype.js';

export class FlowCanvas {
  constructor(root, project, {onSelect, onOpen, renderers = {}}) {
    this.root=root;this.project=project;this.onSelect=onSelect;this.onOpen=onOpen;this.renderers=renderers;
    this.nodes=project.screens;this.visible=this.nodes;this.view={x:0,y:0,scale:1};this.abort=new AbortController();
    this.initialPositions=new Map(this.nodes.map(s=>[s.id,{x:s.x,y:s.y}]));
    this.cards=new Map();this.space=false;this.suppressClick=false;
    this.build();this.bind();
    this.resize=new ResizeObserver(()=>{if(!this.fitted){this.fit();this.fitted=true;}else this.applyView();});
    this.resize.observe(this.viewport);
  }

  build() {
    this.viewport=el('div',{class:'canvas-viewport',tabindex:0,'aria-label':'流程画布。拖动空白平移，滚轮缩放，双击页面进入演示。'});
    this.world=el('div',{class:'canvas-world'});
    this.edges=svgEl('svg',{class:'flow-edges','aria-label':'页面之间的交互连线'});
    this.world.append(this.edges);
    this.viewport.append(this.world);
    const moduleNames=new Map(this.project.modules.map(m=>[m.id,m.title]));
    for(const [index,s] of this.nodes.entries()) {
      const mini=renderPrototype(s,this.project,{mini:true,renderers:this.renderers});
      mini.style.width='680px'; mini.style.transform=`scale(${(s.width-2)/680})`;
      const card=el('article',{class:`flow-node ${s.entry?'node-entry':''}`,'data-node':s.id,role:'button',tabindex:0,'aria-label':`页面：${s.title}。双击进入原型演示。`},
        el('div',{class:'node-header'},el('span',{class:'node-number'},String(index+1).padStart(2,'0')),el('div',{class:'node-title'},el('strong',{},s.title),el('small',{},moduleNames.get(s.module))),icon('expand',15)),
        el('div',{class:'node-preview'},mini),
        el('div',{class:'node-footer'},el('span',{class:`node-kind kind-${s.kind==='form'?'form':s.entry?'entry':'page'}`},icon(s.kind==='form'?'page':s.kind==='detail'?'branches':'grid',12),s.status||'页面原型'),el('span',{class:'node-open-hint'},'双击演示',icon('arrow',12)))
      );
      card.style.width=`${s.width}px`;card.style.height=`${s.height}px`;
      this.positionCard(s,card);
      card.addEventListener('click',()=>this.onSelect({type:'screen',id:s.id}));
      card.addEventListener('dblclick',()=>this.onOpen(s.id));
      card.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();this.onOpen(s.id);}});
      this.cards.set(s.id,card);this.world.append(card);
    }
    this.zoomValue=el('button',{class:'zoom-value',type:'button',title:'重置为 100%','aria-label':'重置缩放为100%',onClick:()=>this.zoom(1/this.view.scale)},'100%');
    this.tools=el('div',{class:'canvas-controls'},
      iconButton('缩小','minus',()=>this.zoom(1/1.2)),this.zoomValue,iconButton('放大','plus',()=>this.zoom(1.2)),el('span',{class:'tool-divider'}),iconButton('适应全图','fit',()=>this.fit()),iconButton('恢复初始布局','reset',()=>this.resetLayout()));
    this.map=svgEl('svg',{viewBox:'0 0 180 106',class:'minimap-svg',role:'img','aria-label':'流程小地图'});
    this.minimap=el('div',{class:'minimap',title:'点击小地图快速定位'},el('div',{class:'minimap-title'},icon('flow',12),'全局导航'),this.map);
    this.hint=el('div',{class:'canvas-hint'},icon('hand',14),el('span',{},'拖动画布'),el('i'),el('span',{},'滚轮缩放'),el('i'),el('span',{},'双击页面演示'));
    this.root.replaceChildren(this.viewport,this.tools,this.minimap,this.hint);
    this.drawEdges();this.drawMap();
  }

  positionCard(s,card=this.cards.get(s.id)) {card.style.left=`${s.x}px`;card.style.top=`${s.y}px`;}

  bind() {
    const options={signal:this.abort.signal};
    this.viewport.addEventListener('wheel',e=>{
      e.preventDefault();const r=this.viewport.getBoundingClientRect();
      this.view=zoomAt(this.view,{x:e.clientX-r.left,y:e.clientY-r.top},Math.exp(-e.deltaY*0.0015));this.applyView();
    },{...options,passive:false});
    this.viewport.addEventListener('pointerdown',e=>{
      if(e.button!==0 && e.button!==1)return;
      const card=e.target.closest('.flow-node');
      const edge=e.target.closest('.edge-group');
      const dragNode=card && e.target.closest('.node-header') && !this.space && e.button===0;
      if((card || edge) && !dragNode && !this.space && e.button!==1)return;
      e.preventDefault();this.viewport.focus({preventScroll:true});
      this.drag={pointer:e.pointerId,startX:e.clientX,startY:e.clientY,view:{...this.view},node:dragNode?this.nodes.find(s=>s.id===card.dataset.node):null,moved:false};
      if(this.drag.node){this.drag.pos={x:this.drag.node.x,y:this.drag.node.y};card.classList.add('dragging');}
      this.viewport.setPointerCapture(e.pointerId);this.viewport.classList.add('is-dragging');
    },options);
    this.viewport.addEventListener('pointermove',e=>{
      if(!this.drag || e.pointerId!==this.drag.pointer)return;
      const dx=e.clientX-this.drag.startX,dy=e.clientY-this.drag.startY;
      if(Math.hypot(dx,dy)>4)this.drag.moved=true;
      if(!this.drag.moved)return;
      if(this.drag.node){
        this.drag.node.x=Math.max(-100000,Math.min(100000,Math.round(this.drag.pos.x+dx/this.view.scale)));
        this.drag.node.y=Math.max(-100000,Math.min(100000,Math.round(this.drag.pos.y+dy/this.view.scale)));
        this.positionCard(this.drag.node);this.drawEdges();this.drawMap();
      }else {this.view.x=this.drag.view.x+dx;this.view.y=this.drag.view.y+dy;this.applyView();}
    },options);
    const finish=e=>{
      if(!this.drag)return;
      const moved=this.drag.moved,node=this.drag.node;
      if(node)this.cards.get(node.id).classList.remove('dragging');
      this.drag=null;this.viewport.classList.remove('is-dragging');
      if(this.viewport.hasPointerCapture(e.pointerId))this.viewport.releasePointerCapture(e.pointerId);
      if(moved){this.suppressClick=true;clearTimeout(this.clickTimer);this.clickTimer=setTimeout(()=>this.suppressClick=false,100);}
    };
    this.viewport.addEventListener('pointerup',finish,options);
    this.viewport.addEventListener('pointercancel',finish,options);
    this.viewport.addEventListener('click',e=>{if(this.suppressClick){e.preventDefault();e.stopPropagation();this.suppressClick=false;}}, {...options,capture:true});
    document.addEventListener('keydown',e=>{
      if(e.code==='Space'&&!e.target.closest('input,textarea,select,button,dialog')) {e.preventDefault();this.space=true;this.viewport.classList.add('space-pan');}
    },options);
    document.addEventListener('keyup',e=>{if(e.code==='Space'){this.space=false;this.viewport.classList.remove('space-pan');}},options);
    window.addEventListener('blur',()=>{this.space=false;this.viewport.classList.remove('space-pan');},options);
    this.map.addEventListener('pointerdown',e=>{
      e.preventDefault();const rect=this.map.getBoundingClientRect(), b=this.mapBounds;
      const wx=(e.clientX-rect.left)/rect.width*180/b.scale+b.x-10/b.scale;
      const wy=(e.clientY-rect.top)/rect.height*106/b.scale+b.y-10/b.scale;
      this.view.x=this.viewport.clientWidth/2-wx*this.view.scale;
      this.view.y=this.viewport.clientHeight/2-wy*this.view.scale;this.applyView();
    },options);
  }

  drawEdges() {
    const defs=svgEl('defs');
    for(const [name,color] of [['neutral','#b5b0c2'],['accent','#8b76db'],['success','#5ca28c'],['danger','#d2959a'],['warning','#cba05d'],['selected','#795de0']]){
      const marker=svgEl('marker',{id:`arrow-${name}`,markerWidth:8,markerHeight:8,refX:7,refY:4,orient:'auto',markerUnits:'userSpaceOnUse'});
      marker.append(svgEl('path',{d:'M1 1L7 4L1 7',fill:'none',stroke:color,'stroke-width':1.5}));defs.append(marker);
    }
    this.edges.replaceChildren(defs);
    this.edgeExtents=[];
    const visibleIds=new Set(this.visible.map(s=>s.id));
    const pairs=new Map();
    for(const t of this.project.transitions){const key=[t.from,t.to].sort().join('|');if(!pairs.has(key))pairs.set(key,[]);pairs.get(key).push(t.id);}
    for(const transition of this.project.transitions) {
      if(!visibleIds.has(transition.from)||!visibleIds.has(transition.to))continue;
      const from=this.nodes.find(s=>s.id===transition.from),to=this.nodes.find(s=>s.id===transition.to);
      const siblings=pairs.get([transition.from,transition.to].sort().join('|'));
      const offset=(siblings.indexOf(transition.id)-(siblings.length-1)/2)*32;
      const path=edgePath(from,to,this.visible,offset),selected=this.selection?.type==='transition'&&this.selection.id===transition.id;
      const g=svgEl('g',{class:`edge-group tone-${transition.tone} ${selected?'selected':''}`,'data-edge':transition.id,role:'button',tabindex:0,'aria-label':`交互：${transition.label}，${from.title}到${to.title}`});
      const line=svgEl('path',{class:'edge-line',d:path.d,fill:'none','marker-end':`url(#arrow-${selected?'selected':transition.tone})`});
      const hit=svgEl('path',{class:'edge-hit',d:path.d,fill:'none',stroke:'transparent','stroke-width':22});
      const labelWidth=Math.min(222,transition.label.length*11+22);
      this.edgeExtents.push({x:path.label.x-labelWidth/2,y:path.label.y-12,width:labelWidth,height:24});
      const label=svgEl('g',{class:'edge-label',transform:`translate(${path.label.x},${path.label.y})`});
      if(path.leader)g.append(svgEl('path',{class:'edge-line edge-leader',d:`M ${path.leader.from.x} ${path.leader.from.y} L ${path.leader.to.x} ${path.leader.to.y}`,fill:'none','stroke-dasharray':'2 3','pointer-events':'none'}));
      label.append(svgEl('rect',{x:-labelWidth/2,y:-12,width:labelWidth,height:24,rx:7}));
      const text=svgEl('text',{'text-anchor':'middle','dominant-baseline':'central'});text.textContent=transition.label;label.append(text);
      g.append(line,hit,label);g.addEventListener('click',()=>this.onSelect({type:'transition',id:transition.id}));
      g.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();this.onSelect({type:'transition',id:transition.id});}});
      this.edges.append(g);
    }
  }

  drawMap() {
    const b=bounds(this.visible),scale=Math.min(160/Math.max(1,b.width),86/Math.max(1,b.height));
    this.mapBounds={...b,scale};this.map.replaceChildren();
    const group=svgEl('g',{transform:`translate(10 10) scale(${scale}) translate(${-b.x} ${-b.y})`});
    for(const s of this.visible)group.append(svgEl('rect',{x:s.x,y:s.y,width:s.width,height:s.height,rx:20,fill:this.selection?.id===s.id?'#9884ed':'#dcd7ee'}));
    const view=svgEl('rect',{x:-this.view.x/this.view.scale,y:-this.view.y/this.view.scale,width:this.viewport.clientWidth/this.view.scale,height:this.viewport.clientHeight/this.view.scale,fill:'#8a71e41a',stroke:'#8972db','stroke-width':1.2/scale,rx:5/scale});
    group.append(view);this.map.append(group);
  }

  applyView() {
    const {x,y,scale}=this.view;
    this.world.style.transform=`translate(${x}px,${y}px) scale(${scale})`;
    this.viewport.style.backgroundPosition=`${x}px ${y}px`;
    this.viewport.style.backgroundSize=`${24*scale}px ${24*scale}px`;
    this.zoomValue.textContent=`${Math.round(scale*100)}%`;this.drawMap();
  }

  zoom(factor) {this.view=zoomAt(this.view,{x:this.viewport.clientWidth/2,y:this.viewport.clientHeight/2},factor);this.applyView();}
  fit(){this.view=fitViewport([...this.visible,...(this.edgeExtents??[])],this.viewport.clientWidth,this.viewport.clientHeight,48);this.applyView();}
  focus(id){const s=this.nodes.find(s=>s.id===id);if(!s)return;this.view={scale:Math.max(0.65,this.view.scale),x:0,y:0};this.view.x=this.viewport.clientWidth/2-(s.x+s.width/2)*this.view.scale;this.view.y=this.viewport.clientHeight/2-(s.y+s.height/2)*this.view.scale;this.applyView();}
  select(selection){this.selection=selection;for(const [id,card]of this.cards){const selected=selection.type==='screen'&&id===selection.id;card.classList.toggle('selected',selected);card.setAttribute('aria-pressed',String(selected));}this.drawEdges();this.drawMap();}
  filter(module){this.visible=this.nodes.filter(s=>module==='all'||s.module===module);for(const s of this.nodes)this.cards.get(s.id).hidden=!this.visible.includes(s);this.drawEdges();this.fit();}
  resetLayout(){for(const s of this.nodes){Object.assign(s,this.initialPositions.get(s.id));this.positionCard(s);}this.drawEdges();this.fit();}
  destroy(){this.abort.abort();this.resize.disconnect();clearTimeout(this.clickTimer);this.root.replaceChildren();}
}
