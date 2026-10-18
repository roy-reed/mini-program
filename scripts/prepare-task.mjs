// Build a bounded, reviewable prompt. Does not modify files or run application commands.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const plan = JSON.parse(read('specs/execution-plan.json'));
const args = process.argv.slice(2);
const id = args[0];
const role = args.length === 1 ? 'implement' : args[1] === '--role' && args.length === 3 ? args[2] : null;
assert.ok(['implement','review'].includes(role), 'Usage: node scripts/prepare-task.mjs S00 --role implement|review');
const task = plan.tasks.find(t => t.id === id);
assert.ok(task, `Unknown task ${id}; use S00–S43`);
const out = [`# ${id} ${role === 'review' ? '复核' : '实现'}任务包`, '', `指定模型：${plan.models[role === 'review' ? task.reviewer : task.executor]}。本轮只处理 ${id}。`, '',
  role === 'review' ? '只读审查当前基线与diff，不自行重构。要求实际命令结果；按卡片检查输出 PASS/CHANGES_REQUIRED/BLOCKED。问题需有位置、复现、影响和修复要求。' : '核对基线与实际依赖状态后执行卡片。缺能力/外部输入如实记录；不伪造命令、微信或审核结果。先列实现步骤，再改文件、运行检查、交给指定复核者。',
  '', '共同规则：生产操作遵循已有授权与平台权限。只在卡片范围内实现；遇到跨契约冲突交Codex裁决。相同问题两次失败转Grok拆解，第三次停止试错并交Codex。',
  '', '状态文件中的依赖必须实证完成，下面的命令只是要求，不代表已经执行。纯聊天模型返回unified diff，由有终端的一方验证；不能把未执行测试标DONE。'];
function section(file, prefix) {
  const body = read(file);
  if (!prefix) return body;
  const lines = body.split('\n');
  const matches = lines.map((l,i) => ({m:l.match(/^(#{1,6})\s+(.+)$/),i})).filter(x => x.m && x.m[2].startsWith(prefix));
  assert.equal(matches.length, 1, `Expected exactly one heading ${prefix} in ${file}`);
  const {m,i} = matches[0]; let end = lines.length;
  for (let n=i+1;n<lines.length;n++) { const next=lines[n].match(/^(#{1,6})\s+/); if(next && next[1].length<=m[1].length){end=n;break;} }
  return lines.slice(i,end).join('\n');
}
for(const file of ['AGENTS.md','IMPLEMENTATION_STATUS.md',`docs/tasks/${id}.md`]) out.push('',`<!-- ${file} -->`,read(file));
for(const s of task.readSections) out.push('',`<!-- ${s.path}${s.headingPrefix?' # '+s.headingPrefix:''} -->`,section(s.path,s.headingPrefix));
if(task.operationIds.length){
 const api=JSON.parse(read('specs/openapi.json'));
 const subset={openapi:api.openapi,info:api.info,servers:api.servers,security:api.security,paths:{},components:{},'x-error-catalog':api['x-error-catalog']};
 const refs=new Set();
 function scan(v){if(!v||typeof v!=='object')return;if(v.$ref)refs.add(v.$ref);for(const x of Object.values(v))scan(x);}
 for(const [url,methods] of Object.entries(api.paths))for(const [method,op] of Object.entries(methods))if(task.operationIds.includes(op.operationId)){(subset.paths[url]??={})[method]=op;scan(op);}
 // Authentication schemes are small and provide the context for selected operations.
 subset.components.securitySchemes=api.components.securitySchemes;
 for(const pointer of refs){
  assert.ok(pointer.startsWith('#/components/'), `Unexpected ref ${pointer}`);
  const [,kind,key]=pointer.slice(2).split('/');
  const item=api.components[kind]?.[key];assert.ok(item,`Missing ${pointer}`);
  (subset.components[kind]??={})[key]=item;scan(item);
 }
 out.push('','## 本卡 HTTP 契约（只抽取所需操作及传递引用）','','```json',JSON.stringify(subset,null,2),'```');
}
out.push('','## 交付格式','',`提交 ${task.evidence}：基线SHA/实现SHA、修改文件、实际命令/退出码/测试数量、人工证据、复核结论、未验证项与下一卡。更新 IMPLEMENTATION_STATUS。`, '', '没有终端时明确写“未执行”，交付补丁和待执行命令，禁止虚构PASS。');
const result=out.join('\n')+'\n';
assert.ok(result.length<85000, `Task packet ${id} is ${result.length} chars; split the task instead of truncating it`);
process.stdout.write(result);
