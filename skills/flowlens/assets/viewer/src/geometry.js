export const MIN_SCALE = 0.15;
export const MAX_SCALE = 2;
const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

export function bounds(nodes) {
  if (!nodes.length) return {x:0,y:0,width:1,height:1};
  const x = Math.min(...nodes.map(n=>n.x)), y = Math.min(...nodes.map(n=>n.y));
  return {x,y,width:Math.max(...nodes.map(n=>n.x+n.width))-x,height:Math.max(...nodes.map(n=>n.y+n.height))-y};
}

export function fitViewport(nodes, width, height, padding = 60) {
  if (!nodes.length || width <= 0 || height <= 0) return {x:0,y:0,scale:1};
  const b = bounds(nodes);
  const scale = clamp(Math.min((width-padding*2)/Math.max(1,b.width),(height-padding*2)/Math.max(1,b.height),1),MIN_SCALE,MAX_SCALE);
  return {x:(width-b.width*scale)/2-b.x*scale,y:(height-b.height*scale)/2-b.y*scale,scale};
}

export function zoomAt(view, point, factor) {
  const scale = clamp(view.scale*factor,MIN_SCALE,MAX_SCALE);
  return {x:point.x-(point.x-view.x)*scale/view.scale,y:point.y-(point.y-view.y)*scale/view.scale,scale};
}

function orthogonalRoute(a,b,nodes,offset) {
  const ports=n=>{
    const ox=clamp(offset,-n.width*.35,n.width*.35),oy=clamp(offset,-n.height*.35,n.height*.35);
    return [
      [{x:n.x+n.width,y:n.y+n.height/2+oy},{x:n.x+n.width+32,y:n.y+n.height/2+oy}],
      [{x:n.x,y:n.y+n.height/2+oy},{x:n.x-32,y:n.y+n.height/2+oy}],
      [{x:n.x+n.width/2+ox,y:n.y},{x:n.x+n.width/2+ox,y:n.y-32}],
      [{x:n.x+n.width/2+ox,y:n.y+n.height},{x:n.x+n.width/2+ox,y:n.y+n.height+32}],
    ];
  };
  const area=bounds(nodes),xs=[...new Set([Math.min(a.x,b.x)-44,Math.max(a.x+a.width,b.x+b.width)+44,area.x-48,area.x+area.width+48,...nodes.flatMap(n=>[n.x-32,n.x+n.width+32])])];
  const ys=[...new Set([Math.min(a.y,b.y)-44,Math.max(a.y+a.height,b.y+b.height)+44,area.y-48,area.y+area.height+48,...nodes.flatMap(n=>[n.y-32,n.y+n.height+32])])];
  const candidates=[];
  // Fan out in the gap between cards. Endpoints stay on the card even when
  // many parallel interactions require lanes outside its vertical/horizontal span.
  if(offset){
    let source,target,label,middle;
    if(b.x>=a.x+a.width+64||a.x>=b.x+b.width+64){
      const right=b.x>a.x;[source,target]=[ports(a)[right?0:1],ports(b)[right?1:0]];
      const y=(a.y+a.height/2+b.y+b.height/2)/2+offset;
      middle=[source[1],{x:source[1].x,y},{x:target[1].x,y},target[1]];label={x:(source[1].x+target[1].x)/2,y};
    }else if(b.y>=a.y+a.height+64||a.y>=b.y+b.height+64){
      const below=b.y>a.y;[source,target]=[ports(a)[below?3:2],ports(b)[below?2:3]];
      const x=(a.x+a.width/2+b.x+b.width/2)/2+offset;
      middle=[source[1],{x,y:source[1].y},{x,y:target[1].y},target[1]];label={x,y:(source[1].y+target[1].y)/2};
    }
    if(source){const points=[source[0],...middle,target[0]].filter((p,i,all)=>!i||p.x!==all[i-1].x||p.y!==all[i-1].y);candidates.push({points,score:-1,preferred:true,label});}
  }
  for(const [start,s]of ports(a))for(const [end,t]of ports(b)){
    const variants=[
      [s,{x:t.x,y:s.y},t],[s,{x:s.x,y:t.y},t],
      ...xs.map(x=>[s,{x,y:s.y},{x,y:t.y},t]),
      ...ys.map(y=>[s,{x:s.x,y},{x:t.x,y},t]),
    ];
    for(const middle of variants){
      const points=[start,...middle,end].filter((p,i,all)=>i===0||p.x!==all[i-1].x||p.y!==all[i-1].y);
      const length=points.slice(1).reduce((sum,p,i)=>sum+Math.abs(p.x-points[i].x)+Math.abs(p.y-points[i].y),0);
      candidates.push({points,score:length+(points.length-2)*14});
    }
  }
  candidates.sort((a,b)=>a.score-b.score);
  const obstacles=nodes.map(n=>{const margin=n===a||n===b?0:14;return {x:n.x-margin,y:n.y-margin,width:n.width+margin*2,height:n.height+margin*2};});
  const crosses=(p,q,r)=>p.y===q.y
    ?p.y>r.y+.01&&p.y<r.y+r.height-.01&&Math.max(p.x,q.x)>r.x+.01&&Math.min(p.x,q.x)<r.x+r.width-.01
    :p.x>r.x+.01&&p.x<r.x+r.width-.01&&Math.max(p.y,q.y)>r.y+.01&&Math.min(p.y,q.y)<r.y+r.height-.01;
  const route=candidates.find(c=>c.points.slice(1).every((p,i)=>!obstacles.some(r=>crosses(c.points[i],p,r))));
  if(!route)return null;
  const points=route.points.filter((p,i,all)=>!i||i===all.length-1||!((all[i-1].x===p.x&&p.x===all[i+1].x)||(all[i-1].y===p.y&&p.y===all[i+1].y)));
  let d=`M ${points[0].x} ${points[0].y}`;
  for(let i=1;i<points.length-1;i++){
    const p=points[i],prev=points[i-1],next=points[i+1];
    const radius=Math.min(12,(Math.abs(p.x-prev.x)+Math.abs(p.y-prev.y))/2,(Math.abs(next.x-p.x)+Math.abs(next.y-p.y))/2);
    const before={x:p.x+Math.sign(prev.x-p.x)*radius,y:p.y+Math.sign(prev.y-p.y)*radius};
    const after={x:p.x+Math.sign(next.x-p.x)*radius,y:p.y+Math.sign(next.y-p.y)*radius};
    d+=` L ${before.x} ${before.y} Q ${p.x} ${p.y} ${after.x} ${after.y}`;
  }
  const end=points.at(-1);d+=` L ${end.x} ${end.y}`;
  const segments=points.slice(1).map((p,i)=>({length:Math.abs(p.x-points[i].x)+Math.abs(p.y-points[i].y),a:points[i],b:p})).sort((a,b)=>b.length-a.length);
  const longest=segments[0],anchor={x:(longest.a.x+longest.b.x)/2,y:(longest.a.y+longest.b.y)/2};
  const label=route.label??{...anchor};
  if(offset&&!route.preferred){
    // A blocked fan-out must never move its labels back inside an obstacle.
    // Separate signed lanes into unique slots above the whole diagram instead.
    const slot=Math.abs(offset)*2+(offset>=0?32:0);
    label.y=area.y-48-slot;
  }
  return {d,points,label,leader:!route.preferred&&offset?{from:anchor,to:label}:null};
}

export function edgePath(a, b, nodes = [], offset = 0) {
  if(nodes.length && a!==b){const routed=orthogonalRoute(a,b,nodes,offset);if(routed)return routed;}
  const ac = {x:a.x+a.width/2,y:a.y+a.height/2}, bc = {x:b.x+b.width/2,y:b.y+b.height/2};
  let start, end, c1, c2;
  if (a === b || (a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height)) {
    start = {x:a.x+a.width,y:ac.y-30+offset}; end={x:start.x,y:ac.y+30+offset}; c1={x:start.x+110+Math.abs(offset),y:start.y-90};c2={x:start.x+110+Math.abs(offset),y:end.y+90};
  } else if (Math.abs(bc.x-ac.x) >= Math.abs(bc.y-ac.y)*0.8) {
    const direction = Math.sign(bc.x-ac.x) || 1;
    start={x:direction>0?a.x+a.width:a.x,y:ac.y}; end={x:direction>0?b.x:b.x+b.width,y:bc.y};
    const gap = Math.max(65,Math.abs(end.x-start.x)*0.5);
    c1={x:start.x+gap*direction,y:start.y};c2={x:end.x-gap*direction,y:end.y};
  } else {
    const direction = Math.sign(bc.y-ac.y) || 1;
    start={x:ac.x,y:direction>0?a.y+a.height:a.y};end={x:bc.x,y:direction>0?b.y:b.y+b.height};
    const gap = Math.max(65,Math.abs(end.y-start.y)*0.5);
    c1={x:start.x,y:start.y+gap*direction};c2={x:end.x,y:end.y-gap*direction};
  }
  return {d:`M ${start.x} ${start.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${end.x} ${end.y}`,label:{x:(start.x+3*c1.x+3*c2.x+end.x)/8,y:(start.y+3*c1.y+3*c2.y+end.y)/8}};
}
