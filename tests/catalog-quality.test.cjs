/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
function load(file, deps = {}) {
  const compiled = { exports: {} };
  new Function("require", "module", "exports", ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText)(name => deps[name] ?? require(name), compiled, compiled.exports);
  return compiled.exports;
}
const search = load("lib/musicbrainz/search.ts");
const { mergeCatalogAlbums } = load("lib/catalog/merge.ts", { "@/lib/musicbrainz/search": search });
const { editionKind, filterAlbums, defaultAlbumFilters } = load("lib/albums/search-filters.ts", { "@/lib/musicbrainz/search": search });
const { approvedFronts, archiveImageUrl } = load("lib/images/album.ts");

test("digital editions win equivalent relevance without merging unrelated ratings or releases", () => {
  const archived = { mbid: "group", entityType: "release-group", title: "BULLY", artist: "Kanye West", albumId: "old-album" };
  const digital = { mbid: "1888707282", entityType: "itunes", title: "BULLY", artist: "Kanye West", trackCount: 18 };
  const other = { ...digital, mbid: "unrelated", artist: "Other Artist" };
  const result = mergeCatalogAlbums("Bully Kanye West", [archived], [other, digital], [{ ...digital, albumId: "digital-album" }]);
  assert.equal(result.length, 3);
  assert.equal(result[0].mbid, digital.mbid);
  assert.equal(result[0].albumId, "digital-album");
  assert.equal(result[1].albumId, "old-album");
  assert.equal(result[2].artist, "Other Artist");
});

test("edition labels do not claim unspecified releases are originals; missing years sort last", () => {
  assert.equal(editionKind("BULLY"), "unspecified");
  assert.equal(editionKind("BULLY - DELUXE"), "deluxe");
  assert.equal(editionKind("Album", "2026 remastered anniversary edition"), "reissue");
  const albums = [{ title: "Unknown", artist: "A" }, { title: "Old", artist: "A", year: "2000" }, { title: "New", artist: "A", year: "2026" }];
  assert.deepEqual(filterAlbums(albums, { ...defaultAlbumFilters, sort: "newest" }).map(a => a.title), ["New", "Old", "Unknown"]);
  assert.deepEqual(filterAlbums(albums, { ...defaultAlbumFilters, sort: "oldest" }).map(a => a.title), ["Old", "New", "Unknown"]);
  assert.equal(filterAlbums(albums, { ...defaultAlbumFilters, artist: "Another A" }).length, 0);
});

test("cover recovery uses approved fronts, rejecting backs, unreviewed art and unsafe hosts", () => {
  const cover = "https://archive.org/download/mbid-123/front_thumb500.jpg";
  assert.deepEqual(approvedFronts({ images: [
    { front: false, approved: true, thumbnails: { 500: cover } },
    { front: true, approved: false, thumbnails: { 500: cover } },
    { front: true, approved: true, thumbnails: { 500: "https://evil.example/cover.jpg" } },
    { front: true, approved: true, thumbnails: { 500: cover } },
  ] }), [cover]);
  assert.equal(archiveImageUrl("http://archive.org/download/mbid-123/front.jpg"), "https://archive.org/download/mbid-123/front.jpg");
  assert.equal(archiveImageUrl("https://archive.org.evil.example/download/mbid-123/x.jpg"), undefined);
  assert.equal(archiveImageUrl("https://archive.org/download/unrelated/x.jpg"), undefined);
});

function searchRoute({ primary, digital, local = [] }) {
  return load("app/api/search/route.ts", {
    "@/lib/catalog/merge": { mergeCatalogAlbums },
    "@/lib/musicbrainz/search": search,
    "@/lib/catalog/local": { localAlbums: async () => local },
    "@/lib/catalog/fallback": { withMusicFallback: async (main, backup) => { try { return await main(); } catch { return backup(); } } },
    "@/lib/itunes/api": { searchItunesAlbums: digital },
    "@/lib/musicbrainz/api": { searchAlbums: primary },
    "@/lib/supabase/server": { createClient: async () => { throw Error("Not used for album search"); } },
  });
}
test("healthy MusicBrainz does not hide the matching digital album", async () => {
  const route = searchRoute({
    primary: async () => [{ id: "group", entityType: "release-group", title: "BULLY", artist: "Kanye West" }],
    digital: async () => [{ mbid: "1888707282", entityType: "itunes", title: "BULLY", artist: "Kanye West", trackCount: 18 }],
  });
  const response = await route.GET(new Request("http://localhost/api/search?q=Bully%20Kanye%20West"));
  const { albums } = await response.json();
  assert.equal(albums[0].entityType, "itunes");
  assert.equal(albums[0].trackCount, 18);
  assert.equal(albums[1].entityType, "release-group");
});
test("failed catalogs produce an error, while a successful empty catalog stays empty", async () => {
  const fail = async () => { throw Error("Offline"); };
  const failed = await searchRoute({ primary: fail, digital: fail }).GET(new Request("http://localhost/api/search?q=Bully"));
  assert.equal(failed.status, 502);
  const empty = await searchRoute({ primary: fail, digital: async () => [] }).GET(new Request("http://localhost/api/search?q=Unknown"));
  assert.equal(empty.status, 200);
  assert.deepEqual((await empty.json()).albums, []);
});
