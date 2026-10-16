import {readFileSync,statSync} from 'node:fs';
import {validateProject} from '../src/schema.js';

try {
  const path=process.argv[2];
  if(!path)throw new Error('用法：node tools/validate.mjs /path/to/project.json');
  if(statSync(path).size>2*1024*1024)throw new Error('项目 JSON 不能超过 2 MB');
  const project=validateProject(readFileSync(path,'utf8'));
  console.log(JSON.stringify({valid:true,id:project.id,title:project.title,screens:project.screens.length,transitions:project.transitions.length}));
} catch(error) {
  console.error(`数据校验失败：${error.message}`);process.exitCode=1;
}
