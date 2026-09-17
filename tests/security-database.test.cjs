/* eslint-disable @typescript-eslint/no-require-imports */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {PGlite}=require('@electric-sql/pglite');
test('privacy, admin escalation, catalog isolation, and database write limits',async()=>{
 const db=new PGlite();
 try{
 await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE SCHEMA auth; CREATE SCHEMA storage;
 CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,raw_user_meta_data jsonb);
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT current_user::text $$;
 CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 CREATE TABLE storage.objects(id uuid,name text,bucket_id text);
 CREATE FUNCTION storage.foldername(text) RETURNS text[] LANGUAGE sql AS $$ SELECT string_to_array($1,'/') $$;
 GRANT USAGE ON SCHEMA auth TO authenticated,anon,service_role;`);
 const base=fs.readFileSync('supabase/schema.sql','utf8').replace('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";','').replaceAll('uuid_generate_v4()','gen_random_uuid()');
 await db.exec(base);
 // Model Supabase's default broad table grants, so tests cannot pass by missing grants.
 await db.exec('GRANT ALL ON ALL TABLES IN SCHEMA public TO anon,authenticated;');
 for(const f of ['20260908_library_and_stability.sql','20260908_itunes_fallback.sql','20260908_itunes_artwork.sql','20260917_song_reviews_and_top_three.sql'])await db.exec(fs.readFileSync('supabase/migrations/'+f,'utf8'));
 const a='00000000-0000-4000-8000-000000000001', b='00000000-0000-4000-8000-000000000002';
 await db.exec(`INSERT INTO auth.users VALUES('${a}','a@example.test','{"name":"alice"}'),('${b}','b@example.test','{"name":"bob"}'); UPDATE profiles SET privacy='private' WHERE id='${a}';`);
 const album=(await db.query("INSERT INTO albums(external_id,title,artist_name) VALUES('test','BULLY','Artist') RETURNING id")).rows[0].id;
 const track=(await db.query("INSERT INTO tracks(album_id,title,track_number) VALUES($1,'Song',1) RETURNING id",[album])).rows[0].id;
 const rating=(await db.query('INSERT INTO album_ratings(user_id,album_id,rating) VALUES($1,$2,9) RETURNING id',[a,album])).rows[0].id;
 await db.query('INSERT INTO track_ratings(user_id,track_id,rating) VALUES($1,$2,9)',[a,track]);
 await db.query('INSERT INTO listen_log(user_id,album_id) VALUES($1,$2)',[a,album]);
 await db.query("INSERT INTO review_comments(user_id,album_rating_id,content) VALUES($1,$2,'Hidden')",[a,rating]);
 for(let i=0;i<2;i++)for(const f of ['20260918_privacy_and_permissions.sql','20260918_server_catalog.sql'])await db.exec(fs.readFileSync('supabase/migrations/'+f,'utf8'));
 // Reproduce the explicit anon grant found in the exported live report.
 await db.exec('GRANT EXECUTE ON FUNCTION ding_save_album(text,text,text,text,text,text) TO anon; ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY; GRANT USAGE ON SCHEMA storage TO authenticated,anon; GRANT SELECT,UPDATE ON storage.objects TO authenticated,anon;');
 await db.query("INSERT INTO storage.objects(id,name,bucket_id) VALUES(gen_random_uuid(),$1,'avatars'),(gen_random_uuid(),$2,'avatars')",[a+'/avatar.webp',b+'/avatar.webp']);
 const advisor=fs.readFileSync('supabase/migrations/20260918_advisor_permissions.sql','utf8');
 await db.exec(advisor);await db.exec(advisor);
 assert.equal((await db.query("SELECT has_function_privilege('anon','ding_save_album(text,text,text,text,text,text)','EXECUTE') AS allowed")).rows[0].allowed,false);
 assert.equal((await db.query("SELECT has_function_privilege('authenticated','ding_remove_rated_saved()','EXECUTE') AS allowed")).rows[0].allowed,false);
 async function as(id,role='authenticated'){await db.exec(`RESET ROLE; SET ROLE ${role}; SELECT set_config('request.jwt.claim.sub','${id}',false);`);}
 await as(b);
 assert.deepEqual((await db.query('SELECT name FROM storage.objects')).rows.map(r=>r.name),[b+'/avatar.webp']);
 await db.exec("UPDATE storage.objects SET name=name WHERE bucket_id='avatars'");
 // Saving and the automatic removal on rating must still work after EXECUTE revocation.
 await db.query("SELECT ding_save_album('123','itunes','Verified','Provider',NULL,NULL)");
 await db.query('INSERT INTO album_ratings(user_id,album_id,rating) VALUES($1,$2,8)',[b,album]);
 await db.query('DELETE FROM album_ratings WHERE user_id=$1',[b]);
 for(const table of ['album_ratings','track_ratings','listen_log','review_comments'])assert.equal((await db.query('SELECT * FROM '+table)).rows.length,0,table);
 assert.equal((await db.query("SELECT * FROM profiles WHERE username='alice'")).rows.length,0);
 await assert.rejects(db.exec('UPDATE profiles SET is_admin=true'),/permission denied/);
 await db.exec("UPDATE profiles SET bio='Allowed'");
 await assert.rejects(db.query('INSERT INTO review_comments(user_id,album_rating_id,content) VALUES($1,$2,$3)',[b,rating,'Unauthorized']),/row-level security/);
 await assert.rejects(db.query('SELECT ding_import_itunes($1,$2)',['123','{}']),/permission denied/);
 await assert.rejects(db.query('SELECT ding_catalog_write($1,$2,$3)',[a,'ding_import_itunes','{}']),/permission denied/);
 await assert.rejects(db.exec("INSERT INTO albums(external_id,title,artist_name) VALUES('bad','bad','bad')"),/permission denied/);
 await as(a);assert.equal((await db.query('SELECT * FROM album_ratings')).rows.length,1);
 await as('', 'anon');assert.equal((await db.query('SELECT * FROM storage.objects')).rows.length,0);assert.equal((await db.query('SELECT * FROM album_ratings')).rows.length,0);
 await as('', 'service_role');
 const details={title:'Verified',artist:'Provider',year:'2026',tracks:[{title:'Track',position:1,durationMs:10000}]};
 const imported=(await db.query('SELECT ding_catalog_write($1,$2,$3) AS id',[b,'ding_import_itunes',{p_external_id:'123',p_details:details}])).rows[0].id;assert.ok(imported);
 await as(b);for(let i=0;i<116;i++)await db.exec("UPDATE profiles SET bio='Rate test'");
 await assert.rejects(db.exec("UPDATE profiles SET bio='Flood'"),/Too many writes/);
 }finally{await db.close();}
});
