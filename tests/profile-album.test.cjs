/* eslint-disable @typescript-eslint/no-require-imports */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const ts=require('typescript');
const fs=require('node:fs');
let viewer={id:'visitor'},privacy='public';
const queried=[];
const db={auth:{getUser:async()=>({data:{user:viewer}})},from(table){
 const filters={};
 const result=()=>{
 queried.push({table,filters:{...filters}});
 const rows={profiles:{id:'author',username:'alice',privacy},album_groups:null,album_top_three:{first_track_id:'a',second_track_id:'b',third_track_id:'c'},song_reviews:[{id:'review',track_id:'a',content:'Author opinion'}],track_ratings:[{track_id:'a',rating:9}],album_ratings:filters.user_id ? {id:'rating',rating:8,review:'Author album review'}:[]};
 return {data:rows[table],error:null};
 };
 const q={select(){return q},eq(k,v){filters[k]=v;return q},in(){return q},limit(){return q},order(){return q},single:async()=>result(),maybeSingle:async()=>result(),then(resolve,reject){return Promise.resolve(result()).then(resolve,reject)}};
 return q;
}};
const m={exports:{}};
const deps={
 'next/navigation':{notFound(){throw Error('NOT_FOUND')}},
 '@/lib/supabase/server':{createClient:async()=>db},
 '@/lib/supabase/queries':{getAlbumWithTracks:async()=>({album:{id:'album',title:'BULLY',external_id:'itunes:1'},tracks:[{id:'a',title:'Song'}]})},
};
new Function('require','module','exports',ts.transpileModule(fs.readFileSync('app/(app)/album/[id]/page.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText)(name=>{
 if(deps[name])return deps[name];
 if(name.startsWith('@/components/')){const key=name.split('/').pop();return {[key]:key};}
 if(name==='next/link'||name==='next/image')return {default:'div'};
 return require(name);
},m,m.exports);
function find(node,type){if(!node||typeof node!=='object')return null;if(node.type===type)return node;for(const child of [node.props?.children].flat(Infinity)){const hit=find(child,type);if(hit)return hit;}return null;}
test('album opened from profile shows author reviews and ratings for visitors and guests',async()=>{
 for(const current of [{id:'visitor'},null]){
 viewer=current;privacy='public';queried.length=0;
 const tree=await m.exports.default({params:Promise.resolve({id:'album'}),searchParams:Promise.resolve({profile:'alice'})});
 const list=find(tree,'TrackList');assert.equal(list.props.isOwner,false);assert.equal(list.props.reviews.a.content,'Author opinion');assert.equal(list.props.initialTrackRatings.a,9);
 assert.equal(find(tree,'AlbumActions'),null);
 assert.equal(find(tree,'AlbumTopThree').props.userId,'author');
 assert.equal(find(tree,'AlbumTopThree').props.editable,false);
 for(const query of queried.filter(q=>['song_reviews','track_ratings','album_top_three'].includes(q.table)))assert.equal(query.filters.user_id,'author');
 }
});
test('private profile is rejected before loading opinions or ratings',async()=>{
 viewer={id:'visitor'};privacy='private';queried.length=0;
 await assert.rejects(m.exports.default({params:Promise.resolve({id:'album'}),searchParams:Promise.resolve({profile:'alice'})}),/NOT_FOUND/);
 assert.deepEqual(queried.map(q=>q.table),['profiles']);
});
