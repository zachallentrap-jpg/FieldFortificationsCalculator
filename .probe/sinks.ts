import { readFileSync } from 'node:fs';
const ROOT = '/home/user/FieldFortificationsCalculator/';
const SIZE_KEYS = ['w','h','d','radius','radiusTop','height','outerR','innerR','heightFt','taperAmount','shearDrop'];
function stripNonCode(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g,(m)=>m.replace(/[^\n]/g,' ')).replace(/\/\/[^\n]*/g,'')
    .replace(/'(?:[^'\\]|\\.)*'/g,"''").replace(/"(?:[^"\\]|\\.)*"/g,'""').replace(/`(?:[^`\\]|\\.)*`/g,'``');
}
function feetSinks(file: string) {
  const code = stripNonCode(readFileSync(ROOT + file,'utf8'));
  const out: {line:number;expr:string}[] = [];
  const defs = new Map<string,string>();
  for (const m of code.matchAll(/\bconst\s+([A-Za-z_$][\w$]*)\s*=\s*([^;\n]+)/g)) defs.set(m[1]!, defs.has(m[1]!)?'':m[2]!.trim());
  const resolve = (e:string)=>{const b=/^[A-Za-z_$][\w$]*$/.exec(e.trim()); return b?(defs.get(e.trim())||e):e;};
  const lineOf=(i:number)=>code.slice(0,i).split('\n').length;
  for (const m of code.matchAll(/(?:proj\.)?lenPx\(/g)) {
    let i=m.index!+m[0].length,depth=1;const start=i;
    while(i<code.length&&depth>0){if(code[i]==='(')depth++;else if(code[i]===')')depth--;i++;}
    out.push({line:lineOf(m.index!),expr:code.slice(start,i-1).trim()});
  }
  if(!file.includes('render3d'))return out;
  for(const key of SIZE_KEYS){
    for(const m of code.matchAll(new RegExp('(?<![\\w.$])'+key+':','g'))){
      let i=m.index!+m[0].length,depth=0;const start=i;
      while(i<code.length){const c=code[i]!;if('([{'.includes(c))depth++;else if(')]}'.includes(c)){if(depth===0)break;depth--;}else if(c===','&&depth===0)break;i++;}
      const expr=code.slice(start,i).trim();
      if(/\bnumber\b|;/.test(expr))continue;
      out.push({line:lineOf(m.index!),expr:resolve(expr)});
    }
  }
  return out;
}
for (const f of ['src/render/drawSection.ts','src/render/drawPlan.ts','src/render/drawIso.ts','src/render3d/scene3d.ts']) {
  const s = feetSinks(f);
  console.log('=== ' + f + '  sinks=' + s.length);
  for (const x of s) console.log('   ', x.line, '|', x.expr);
}
