import {PrototypeExplorer} from './explorer.js';
import {el, button} from './dom.js';

const root=document.querySelector('#app');
async function start(){
  try{
    const configResponse=await fetch('./viewer.config.json');
    if(!configResponse.ok)throw new Error('无法读取 viewer.config.json');
    const config=await configResponse.json();
    const response=await fetch(config.initialProject);
    if(!response.ok)throw new Error('无法读取项目数据');
    new PrototypeExplorer({root,data:await response.json(),examples:config.examples??[]});
  }catch(error){root.replaceChildren(el('div',{class:'boot-state'},el('h1',{},'暂时无法打开项目'),el('p',{},error.message),el('p',{},'请在原型工作目录运行 python3 tools/serve.py，并访问终端打印的本地地址。'),button('重新加载','reset',start,'button button-accent')));}
}
start();
