/* eslint-disable @typescript-eslint/no-require-imports */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {PGlite}=require('@electric-sql/pglite');
test('song migration preserves original text, reruns, owner isolation, privacy and valid top three',async()=>{
 const db=new PGlite();
 try {
 await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY); CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; GRANT USAGE ON SCHEMA auth TO authenticated,anon;`);
 await db.exec(fs.readFileSync('supabase/schema.sql','utf8').split('-- AUTOMATIC PROFILE CREATION TRIGGER')[0].replace('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";','').replaceAll('uuid_generate_v4()','gen_random_uuid()'));
 await db.exec(fs.readFileSync('supabase/migrations/20260908_library_and_stability.sql','utf8'));
 const a='00000000-0000-4000-8000-000000000001', b='00000000-0000-4000-8000-000000000002';
 await db.exec(`INSERT INTO auth.users VALUES('${a}'),('${b}'); INSERT INTO profiles(id,username) VALUES('${a}','alice'),('${b}','bob'); GRANT SELECT ON profiles,tracks TO authenticated,anon;`);
 const album=(await db.query("INSERT INTO albums(external_id,title,artist_name) VALUES('test','BULLY','Kanye West') RETURNING id")).rows[0].id;
 const tracks=[];
 for(let i=1;i<=4;i++) tracks.push((await db.query('INSERT INTO tracks(album_id,title,track_number) VALUES($1,$2,$3) RETURNING id',[album,'Song '+i,i])).rows[0].id);
 const original='  Mi opinión 🎵\nSegunda línea  ';
 await db.query("INSERT INTO track_comments(user_id,track_id,content,created_at,updated_at) VALUES($1,$2,$3,'2026-01-01T00:00:00Z','2026-01-02T00:00:00Z')",[a,tracks[0],original]);
 const migration=fs.readFileSync('supabase/migrations/20260917_song_reviews_and_top_three.sql','utf8');
 await db.exec(migration); await db.exec(migration);
 const r=(await db.query('SELECT * FROM song_reviews')).rows[0];
 assert.equal(r.content,original); assert.equal(new Date(r.created_at).toISOString(),'2026-01-01T00:00:00.000Z');
 async function asUser(id){await db.exec(`RESET ROLE; SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','${id}',false);`);}
 await asUser(b); await db.exec("UPDATE song_reviews SET content='hacked'"); assert.equal((await db.query('SELECT content FROM song_reviews')).rows[0].content,original);
 await db.query('INSERT INTO song_review_comments(review_id,user_id,content) VALUES($1,$2,$3)',[r.id,b,'Discussion']);
 await asUser(a); await db.query('INSERT INTO album_top_three(user_id,album_id,first_track_id,second_track_id,third_track_id) VALUES($1,$2,$3,$4,$5)',[a,album,...tracks.slice(0,3)]);
 await assert.rejects(db.query('UPDATE album_top_three SET third_track_id=first_track_id'),/three different|check constraint/);
 await db.exec("UPDATE song_reviews SET content=''");
 await db.exec('RESET ROLE'); await db.exec(migration);
 assert.equal((await db.query('SELECT content FROM song_reviews')).rows[0].content,''); assert.equal((await db.query('SELECT content FROM track_comments')).rows[0].content,original);
 await asUser(b); assert.equal((await db.query('SELECT * FROM song_review_comments')).rows.length,0);
 await db.exec(`RESET ROLE; UPDATE profiles SET privacy='private' WHERE id='${a}';`);
 await asUser(b); assert.equal((await db.query('SELECT * FROM song_reviews')).rows.length,0); assert.equal((await db.query('SELECT * FROM album_top_three')).rows.length,0);
 await asUser(a); assert.equal((await db.query('SELECT * FROM song_reviews')).rows.length,1);
 }finally{await db.close();}
});
