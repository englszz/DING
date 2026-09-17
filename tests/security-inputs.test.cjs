/* eslint-disable @typescript-eslint/no-require-imports */
const {test}=require('node:test'),assert=require('node:assert/strict'),ts=require('typescript'),fs=require('node:fs');
function load(file){const m={exports:{}};new Function('require','module','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(require,m,m.exports);return m.exports;}
const {safeProfileUrl,profileUrlForDisplay,escapeSearchTerm}=load('lib/security/validation.ts');
const {boundedJson}=load('lib/security/request.ts');
test('profile links reject active schemes and filter punctuation stays quoted',()=>{
 for(const value of ['javascript:alert(1)','data:text/html,bad','https://user:password@example.com']){assert.throws(()=>safeProfileUrl(value));assert.equal(profileUrlForDisplay(value),undefined);}
 assert.equal(safeProfileUrl('https://example.com'),'https://example.com/');
 assert.equal(escapeSearchTerm('a,b).or(id.eq.x'),'"%a,b).or(id.eq.x%"');
 assert.equal(escapeSearchTerm('a"%_'),'"%a\\"\\%\\_%"');
});
test('request body limit also applies to chunked requests without content-length',async()=>{
 const body=new ReadableStream({start(c){c.enqueue(new TextEncoder().encode(' '.repeat(5000)));c.enqueue(new TextEncoder().encode(' '.repeat(5000)));c.close();}});
 assert.equal(await boundedJson(new Request('http://localhost',{method:'POST',body,duplex:'half'})),null);
 assert.deepEqual(await boundedJson(new Request('http://localhost',{method:'POST',body:'{"ok":true}'})),{ok:true});
});
