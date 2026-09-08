/* eslint-disable @typescript-eslint/no-require-imports */
const { test, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
function load(file, deps = {}) {
  const m = { exports: {} };
  new Function(
    "require",
    "module",
    "exports",
    ts.transpileModule(fs.readFileSync(file, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
  )((name) => deps[name] ?? require(name), m, m.exports);
  return m.exports;
}
const search = load("lib/musicbrainz/search.ts");
const api = load("lib/itunes/api.ts", { "@/lib/musicbrainz/search": search, "@/lib/images/itunes":load("lib/images/itunes.ts") });
const { withMusicFallback } = load("lib/catalog/fallback.ts");
const oldFetch = global.fetch;
after(() => {
  global.fetch = oldFetch;
});
function mock(items) {
  global.dingItunes.cache.clear();
  global.dingItunes.starts = [];
  global.fetch = async () => new Response(JSON.stringify({ results: items }));
}
test("backup searches album and artist together and excludes unrelated singles", async () => {
  mock([
    {
      wrapperType: "collection",
      collectionId: 123,
      collectionName: "UTOPIA",
      artistName: "Travis Scott",
      releaseDate: "2023-01-01",
    },
    {
      wrapperType: "collection",
      collectionId: 124,
      collectionName: "UTOPIA",
      artistName: "Another artist",
    },
    {
      wrapperType: "collection",
      collectionId: 125,
      collectionName: "UTOPIA - Single",
      artistName: "Travis Scott",
    },
  ]);
  const results = await api.searchItunesAlbums("Utopia de Travis Scott");
  assert.equal(results.length, 1);
  assert.equal(results[0].entityType, "itunes");
  assert.equal(results[0].mbid, "123");
  assert.equal(api.matchesItunesKind("Test - EP", "ep"), true);
});
test("backup lookup keeps ordered songs across discs and refuses partial albums", async () => {
  const album = {
    wrapperType: "collection",
    collectionId: 123,
    collectionName: "Test",
    artistName: "Artist",
    trackCount: 2,
  };
  mock([
    album,
    {
      kind: "song",
      collectionId: 123,
      discNumber: 2,
      trackNumber: 1,
      trackName: "Second",
    },
    {
      kind: "song",
      collectionId: 123,
      discNumber: 1,
      trackNumber: 1,
      trackName: "First",
    },
  ]);
  assert.deepEqual(
    (await api.itunesAlbum("123")).tracks.map((t) => t.title),
    ["First", "Second"],
  );
  mock([album, { kind: "song", collectionId: 123, trackName: "First" }]);
  await assert.rejects(api.itunesAlbum("123"), /todas las canciones/);
});
test("backup artist identifiers open their own discography", async () => {
  mock([{ wrapperType: "artist", artistId: 789, artistName: "Artist" }]);
  const artists = await api.searchItunesArtists("Artist");
  assert.equal(artists[0].source, "itunes");
  assert.equal(artists[0].id, "789");
});
test("healthy primary is preferred; slow and failed primaries switch to backup", async () => {
  global.dingCatalogCircuit.retryAt = 0;
  assert.equal(
    await withMusicFallback(
      async () => "primary",
      async () => {
        throw Error("Must not run");
      },
      5,
    ),
    "primary",
  );
  global.dingCatalogCircuit.retryAt = 0;
  assert.equal(
    await withMusicFallback(
      () => new Promise(() => {}),
      async () => "backup",
      5,
    ),
    "backup",
  );
  assert.equal(
    await withMusicFallback(
      async () => {
        throw Error("Primary unavailable");
      },
      async () => "backup",
      5,
    ),
    "backup",
  );
  global.dingCatalogCircuit.retryAt = 0;
  await assert.rejects(
    withMusicFallback(
      async () => {
        throw Error("Primary failed");
      },
      async () => {
        throw Error("Backup failed");
      },
      5,
    ),
  );
});
test("iTunes import reuses a known reference without contacting either provider", async () => {
  const route = load("app/api/album/import/route.ts", {
    "@/lib/images/itunes": load("lib/images/itunes.ts"),
  "@/lib/musicbrainz/search": search,
    "@/lib/itunes/api": {
      itunesAlbum: () => {
        throw Error("Unnecessary lookup");
      },
    },
    "@/lib/musicbrainz/api": {},
    "@/lib/supabase/server": {
      createClient: async () => ({
        auth: { getUser: async () => ({ data: { user: { id: "user" } } }) },
        from(table) {
          assert.equal(table, "album_external_refs");
          return {
            select() {
              return this;
            },
            eq() {
              return this;
            },
            maybeSingle: async () => ({ data: { album_id: "existing-id" } }),
          };
        },
      }),
    },
  });
  const response = await route.POST(
    new Request("http://localhost/api/album/import", {
      method: "POST",
      body: JSON.stringify({ mbid: "123", entityType: "itunes" }),
    }),
  );
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { albumId: "existing-id" });
});
test("opening a local catalog result never reimports it", async () => {
  const { openAlbum } = load("lib/albums/open.ts");
  global.fetch = async () => {
    throw Error("Must not contact importer");
  };
  assert.equal(
    await openAlbum({ mbid: "123", entityType: "itunes", albumId: "local-id" }),
    "local-id",
  );
});

test('a failed MusicBrainz group import opens a unique backup without inventing an MB alias',async()=>{
 const calls=[];
 const route=load('app/api/album/import/route.ts',{
  '@/lib/musicbrainz/search':search,
  '@/lib/musicbrainz/api':{getGroupEditions:async()=>{throw Error('MusicBrainz unavailable');}},
  '@/lib/itunes/api':{searchItunesAlbums:async()=>[{mbid:'123',entityType:'itunes',title:'UTOPIA',artist:'Travis Scott',year:'2023'}],itunesAlbum:async()=>({title:'UTOPIA',artist:'Travis Scott',year:'2023',tracks:[{title:'Song',position:1}]})},
  '@/lib/supabase/server':{createClient:async()=>({auth:{getUser:async()=>({data:{user:{id:'user'}}})},from(){return {select(){return this;},eq(){return this;},maybeSingle:async()=>({data:null})};},rpc:async(name)=>{calls.push(name);if(name==='ding_claim_import')return {data:'token'};if(name==='ding_import_itunes')return {data:'backup-album'};return {};}})}
 });
 const response=await route.POST(new Request('http://localhost/api/album/import',{method:'POST',body:JSON.stringify({mbid:'eac07d92-86b1-4fa7-906d-ec3177f8ebc2',entityType:'release-group',title:'UTOPIA',artist:'Travis Scott',year:'2023'})}));
 assert.equal(response.status,200);assert.deepEqual(await response.json(),{albumId:'backup-album'});assert.ok(calls.includes('ding_import_itunes'));assert.ok(!calls.includes('ding_finish_import'));
});

test("mixed-media albums accept complete audio discs but reject missing or duplicated songs", async () => {
  const album = { wrapperType: "collection", collectionId: 1443160553, collectionName: "My Beautiful Dark Twisted Fantasy", artistName: "Kanye West", trackCount: 15 };
  const songs = Array.from({length:13}, (_,i) => ({kind:"song", collectionId:1443160553, discNumber:1, discCount:2, trackCount:13, trackNumber:i+1, trackName:`Song ${i+1}`}));
  songs.push({kind:"song", collectionId:1443160553, discNumber:2, discCount:2, trackCount:1, trackNumber:1, trackName:"See Me Now"});
  mock([album,...songs]);
  assert.equal((await api.itunesAlbum("1443160553")).tracks.length,14);
  mock([{...album,trackCount:16},...songs,{kind:"music-video",collectionId:1443160553,discNumber:2,trackNumber:2}]);
  assert.equal((await api.itunesAlbum("1443160553")).tracks.length,14);
  for (const incomplete of [songs.slice(1),songs.slice(0,13),[...songs.slice(0,12),songs[0],songs[13]],songs.map(s=>({...s,discCount:undefined}))]) {
    mock([album,...incomplete]);
    await assert.rejects(api.itunesAlbum("1443160553"), {name:"IncompleteItunesAlbumError"});
  }
});

