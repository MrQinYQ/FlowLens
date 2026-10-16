import test from 'node:test';
import assert from 'node:assert/strict';
import { validateProject, resolveInteraction } from '../src/schema.js';
import { fitViewport, zoomAt, edgePath } from '../src/geometry.js';

const fixture = () => ({
  version: 1, id: 'sample', title: '示例', description: '示例说明', demo: true,
  modules: [{ id: 'm', title: '模块' }],
  screens: [
    { id: 'a', module: 'm', title: '创建', kind: 'form', x: 0, y: 0, components: [{ type: 'fields', fields: [{ id: 'name', label: '名称', value: '' }] }] },
    { id: 'b', module: 'm', title: '完成', kind: 'result', x: 500, y: 0, components: [] },
  ],
  transitions: [{ id: 'submit', from: 'a', to: 'b', label: '提交', requiredFields: ['name'] }],
});

test('valid import is independent of caller mutation', () => {
  const input = fixture(); const result = validateProject(input);
  input.screens[0].title = 'changed';
  assert.equal(result.screens[0].title, '创建');
  assert.ok(result.screens[0].width > 0);
});
test('duplicate screen IDs are rejected', () => {
  const input = fixture(); input.screens[1].id = 'a';
  assert.throws(() => validateProject(input), /重复/);
});
test('dangling transition endpoints are rejected', () => {
  const input = fixture(); input.transitions[0].to = 'absent';
  assert.throws(() => validateProject(input), /目标|引用|不存在/);
});
test('non-finite coordinates are rejected', () => {
  const input = fixture(); input.screens[0].x = Infinity;
  assert.throws(() => validateProject(input), /坐标/);
});
test('unsupported versions do not silently render', () => {
  const input = fixture(); input.version = 2;
  assert.throws(() => validateProject(input), /version|版本/);
});
test('oversized projects are rejected before rendering', () => {
  const input = fixture(); input.screens = Array.from({length: 101}, (_, i) => ({...input.screens[0], id: `s${i}`}));
  assert.throws(() => validateProject(input), /100/);
});
test('unsafe image URLs and raw HTML components are rejected', () => {
  for (const component of [{type:'image', src:'javascript:alert(1)'}, {type:'image', src:'data:image/svg+xml,<svg/>'}, {type:'html', html:'<script/>'}]) {
    const input = fixture(); input.screens[0].components = [component];
    assert.throws(() => validateProject(input), /图片|组件|类型/);
  }
});
test('control characters cannot turn an image path into an external HTTP request', () => {
  for(const src of ['\u0000//example.com/x.png','\u0001//example.com/x.png','https://example.com/\u007f.png']){
    const input=fixture();input.screens[0].components.push({type:'image',src});
    assert.throws(()=>validateProject(input),/图片/);
  }
});
test('default select value must be one of its visible options', () => {
  const input=fixture();input.screens[0].components[0].fields[0]={id:'name',label:'选择',type:'select',options:['A','B'],value:'C'};
  assert.throws(()=>validateProject(input), /默认值|选项/);
});
test('number and date defaults cannot be invisible browser-invalid values', () => {
  for(const [type,value]of [['number','hello'],['number','1.'],['date','2026-02-30'],['date','not-a-date']]){
    const input=fixture();input.screens[0].components[0].fields[0]={id:'name',label:'字段',type,value};
    assert.throws(()=>validateProject(input), /默认值/);
  }
});
test('malformed nested table data is rejected before replacing project', () => {
  const input = fixture(); input.screens[0].components = [{type:'table', columns:['名称'], rows:[{name:'wrong'}]}];
  assert.throws(() => validateProject(input), /表格/);
});
test('required interaction fields must exist in source screen', () => {
  const input = fixture(); input.transitions[0].requiredFields = ['absent'];
  assert.throws(() => validateProject(input), /字段/);
});
test('reserved object keys cannot break project state dictionaries', () => {
  const input = fixture(); input.screens[0].id='constructor';input.transitions[0].from='constructor';
  assert.throws(()=>validateProject(input), /保留/);
});
test('image hotspots must reference an interaction originating on the same page', () => {
  const input=fixture();input.screens[1].components=[{type:'image',src:'./screen.png',hotspots:[{transition:'submit',x:20,y:40,width:30,height:10}]}];
  assert.throws(()=>validateProject(input), /热点/);
});
test('image hotspots retain valid percentage coordinates for rendering', () => {
  const input=fixture();input.screens[0].components.push({type:'image',src:'./screen.png',hotspots:[{transition:'submit',x:20,y:40,width:30,height:10}]});
  const output=validateProject(input);
  assert.deepEqual(output.screens[0].components[1].hotspots,[{transition:'submit',x:20,y:40,width:30,height:10}]);
});
test('hotspots cannot extend beyond the prototype image', () => {
  const input=fixture();input.screens[0].components.push({type:'image',src:'./screen.png',hotspots:[{transition:'submit',x:90,y:40,width:30,height:10}]});
  assert.throws(()=>validateProject(input), /热点/);
});
test('blank field blocks navigation with field-specific error', () => {
  const p = validateProject(fixture()); const result = resolveInteraction(p, 'submit', {name:'   '});
  assert.equal(result.ok, false); assert.equal(result.target, null);
  assert.deepEqual(Object.keys(result.errors), ['name']);
});
test('valid field advances to the specified page', () => {
  const p = validateProject(fixture());
  assert.deepEqual(resolveInteraction(p, 'submit', {name:'计划 A'}), {ok:true, target:'b', errors:{}});
});
test('unknown interaction cannot navigate', () => {
  assert.throws(() => resolveInteraction(validateProject(fixture()), 'unknown', {}), /不存在/);
});
test('zoom keeps the world point under cursor stationary', () => {
  const result = zoomAt({x:100,y:50,scale:1}, {x:300,y:150}, 2);
  assert.deepEqual(result, {x:-100,y:-50,scale:2});
});
test('zoom limits still preserve anchor', () => {
  const result = zoomAt({x:0,y:0,scale:1}, {x:100,y:80}, 100);
  assert.equal(result.scale, 2); assert.equal(result.x, -100);
});
test('fit centers an offset diagram and stays inside viewport', () => {
  const result = fitViewport([{x:500,y:100,width:400,height:200}], 1000, 600, 50);
  assert.equal(result.scale, 1);
  assert.equal(result.x, -200); assert.equal(result.y, 100);
});
test('empty and zero-sized canvas produce finite viewports', () => {
  for (const result of [fitViewport([], 0, 0), fitViewport([{x:0,y:0,width:300,height:200}],0,0)]) {
    assert.ok(Number.isFinite(result.x)); assert.ok(Number.isFinite(result.y)); assert.ok(result.scale > 0);
  }
});
test('edge endpoints attach to the appropriate card sides', () => {
  const path = edgePath({x:0,y:0,width:100,height:100}, {x:300,y:0,width:100,height:100});
  assert.ok(path.d.startsWith('M 100 50')); assert.ok(path.d.endsWith('300 50'));
});

test('long edges route around an intervening page', () => {
  const a={x:0,y:0,width:100,height:100}, b={x:400,y:0,width:100,height:100};
  const obstacle={x:200,y:0,width:100,height:100};
  const path=edgePath(a,b,[a,obstacle,b]);
  assert.ok(path.points, 'routing exposes the orthogonal path for collision checks');
  for(let i=1;i<path.points.length;i++){
    const p=path.points[i-1],q=path.points[i];
    const horizontal=p.y===q.y&&p.y>obstacle.y&&p.y<obstacle.y+obstacle.height&&Math.max(p.x,q.x)>obstacle.x&&Math.min(p.x,q.x)<obstacle.x+obstacle.width;
    const vertical=p.x===q.x&&p.x>obstacle.x&&p.x<obstacle.x+obstacle.width&&Math.max(p.y,q.y)>obstacle.y&&Math.min(p.y,q.y)<obstacle.y+obstacle.height;
    assert.equal(horizontal||vertical,false);
  }
});

test('routing finds an interior corridor when outer routes are blocked', () => {
  const a={x:0,y:0,width:220,height:220},b={x:1000,y:0,width:220,height:220};
  const middle={x:440,y:-100,width:220,height:420};
  const top={x:-40,y:-400,width:1200,height:220};
  const bottom={x:-40,y:400,width:1200,height:220};
  const path=edgePath(a,b,[a,b,middle,top,bottom]);
  assert.ok(path.points,'a corridor route must be found rather than a direct fallback');
  assert.ok(path.points.some(p=>p.y < -100 && p.y > -180));
});
test('parallel interactions have visibly separated paths and labels', () => {
  const a={x:0,y:0,width:320,height:320},b={x:500,y:0,width:320,height:320};
  const first=edgePath(a,b,[a,b],-16),second=edgePath(a,b,[a,b],16);
  assert.notEqual(first.d,second.d);
  assert.ok(Math.hypot(first.label.x-second.label.x,first.label.y-second.label.y)>=30);
});
test('parallel interactions remain distinct beyond the card port range', () => {
  for(const [size,count]of [[220,8],[320,10]]){
    const a={x:0,y:0,width:size,height:size},b={x:size+180,y:0,width:size,height:size};
    const paths=Array.from({length:count},(_,i)=>edgePath(a,b,[a,b],(i-(count-1)/2)*32));
    assert.equal(new Set(paths.map(p=>p.d)).size,count);
    assert.equal(new Set(paths.map(p=>`${p.label.x},${p.label.y}`)).size,count);
  }
});
test('parallel fallback labels stay outside obstructing cards', () => {
  const a={x:0,y:0,width:320,height:320},b={x:1000,y:0,width:320,height:320},obstacle={x:440,y:0,width:320,height:640};
  const paths=[-144,-112,112,144].map(offset=>edgePath(a,b,[a,b,obstacle],offset));
  assert.equal(new Set(paths.map(p=>`${p.label.x},${p.label.y}`)).size,4);
  for(const path of paths)assert.ok(path.label.y+12<0,'fallback labels should remain above every page');
});
