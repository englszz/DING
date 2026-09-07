/* eslint-disable @typescript-eslint/no-require-imports */
const { test, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

function load(file, dependencies = {}) {
  const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, "..", file), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const compiledModule = { exports: {} };
  new Function("require", "module", "exports", source)(
    name => dependencies[name] ?? require(name), compiledModule, compiledModule.exports);
  return compiledModule.exports;
}
const search = load("lib/musicbrainz/search.ts");
const api = load("lib/musicbrainz/api.ts", { "./search": search });
const originalFetch = global.fetch;
after(() => { global.fetch = originalFetch; });
function mockFetch(handler) {
  global.dingMusicBrainz.cache.clear();
  global.dingMusicBrainz.nextRequest = 0;
  global.fetch = async url => {
    const result = handler(new URL(url));
    global.dingMusicBrainz.nextRequest = 0;
    return new Response(JSON.stringify(result), { status: 200 });
  };
}
const group = (id, title, extra = {}) => ({ id, title, "primary-type": "Album",
  "artist-credit": [{ name: "Travis Scott" }], ...extra });

test("title and artist work in either order, with connectors and escaped input", () => {
  for (const query of ["Utopia Travis Scott", "Travis Scott Utopia", "Utopia de Travis Scott"]) {
    const expression = search.albumQuery(query, "album");
    for (const word of ["utopia", "travis", "scott"]) {
      assert.ok(expression.includes(`releasegroup:"${word}" OR artist:"${word}"`));
    }
    assert.match(expression, /status:official/);
  }
  assert.ok(search.albumQuery('Album "OR" artist:*', "all").includes('\\"OR\\"'));
  assert.equal(search.albumQuery("!!!", "album"), "");
  assert.ok(search.relevance("Utopia Travis Scott", "UTOPIA", "Travis Scott", 90) >
    search.relevance("Utopia Travis Scott", "Utopia", "Other artist", 100));
});

test("album results group duplicates, preserve missing dates, and exclude singles/live", async () => {
  mockFetch(url => {
    assert.equal(url.pathname, "/ws/2/release-group");
    return { "release-groups": [group("1", "UTOPIA"), group("1", "UTOPIA"),
      group("2", "Song", { "primary-type": "Single" }),
      group("3", "Live", { "secondary-types": ["Live"] })] };
  });
  const results = await api.searchAlbums("Utopia Travis Scott");
  assert.equal(results.length, 1);
  assert.equal(results[0].entityType, "release-group");
  assert.equal(results[0].year, undefined);
});

test("filters include EP, singles and secondary types without changing the title query", () => {
  assert.equal(search.matchesKind("EP", [], "ep"), true);
  assert.equal(search.matchesKind("Single", [], "single"), true);
  assert.equal(search.matchesKind("Album", ["Live"], "live"), true);
  assert.equal(search.matchesKind("Album", ["Compilation"], "album"), false);
  assert.equal(search.matchesKind("Other", [], "all"), true);
});

test("discography loads later pages and keeps undated albums", async () => {
  const offsets = [];
  mockFetch(url => {
    const offset = Number(url.searchParams.get("offset")); offsets.push(offset);
    assert.equal(url.searchParams.get("inc"), "artist-credits");
    return { "release-group-count": 101, "release-groups": offset === 0
      ? Array.from({ length: 100 }, (_, i) => group(String(i), `Album ${i}`))
      : [group("utopia", "UTOPIA", { "first-release-date": "2023-07-28" })] };
  });
  const albums = await api.getArtistReleases("artist");
  assert.deepEqual(offsets, [0, 100]);
  assert.equal(albums.length, 101);
  assert.equal(albums[0].title, "UTOPIA");
});

test("service errors reject instead of pretending no albums exist", async () => {
  global.dingMusicBrainz.cache.clear(); global.dingMusicBrainz.nextRequest = 0;
  global.fetch = async () => new Response("error", { status: 500 });
  await assert.rejects(api.searchAlbums("Utopia"), /500/);
});

test("official standard editions rank first", async () => {
  mockFetch(() => ({ "release-count": 3, releases: [
    { id: "bootleg", title: "UTOPIA", status: "Bootleg" },
    { id: "deluxe", title: "UTOPIA deluxe", status: "Official" },
    { id: "standard", title: "UTOPIA", status: "Official" },
  ] }));
  assert.equal((await api.getGroupEditions("utopia"))[0].id, "standard");
});

test("documented albums break title ties without overriding a specified artist", async () => {
  const wellDocumented = group("travis", "UTOPIA", { count: 31, score: 80, tags: [{ name: "rap", count: 8 }] });
  const other = group("other", "Utopia", { count: 1, score: 100, "artist-credit": [{ name: "Other Artist" }] });
  mockFetch(() => ({ "release-groups": [other, wellDocumented] }));
  assert.equal((await api.searchAlbums("Utopia"))[0].id, "travis");
  assert.equal((await api.searchAlbums("Utopia Other Artist"))[0].id, "other");
});

test("multi-disc track positions stay unique", async () => {
  mockFetch(() => ({ id: "release", title: "Double", media: [
    { tracks: [{ position: 1, title: "First" }] },
    { tracks: [{ position: 1, title: "Second" }] },
  ] }));
  assert.deepEqual((await api.getAlbumDetails("release")).tracks.map(track => track.position), [1, 2]);
});

test("opening a group reuses a saved legacy edition without changing albums or tracks", async () => {
  const groupId = "eac07d92-86b1-4fa7-906d-ec3177f8ebc2";
  const seen = [];
  const builder = {
    select() { return this; },
    in(column, ids) { seen.push(...ids); return this; },
    order() { return this; },
    limit() { return Promise.resolve({ data: [{ id: "saved-album" }], error: null }); },
  };
  const route = load("app/api/album/import/route.ts", {
    "@/lib/supabase/server": { createClient: async () => ({
      auth: { getUser: async () => ({ data: { user: { id: "user" } } }) },
      from(table) { assert.equal(table, "albums"); return builder; },
    }) },
    "@/lib/musicbrainz/api": {
      getGroupEditions: async () => [{ id: "standard", status: "Official" }, { id: "legacy" }],
      getAlbumDetails: () => { throw new Error("Must reuse saved album"); },
    },
  });
  const response = await route.POST(new Request("http://localhost/api/album/import", {
    method: "POST", body: JSON.stringify({ mbid: groupId, entityType: "release-group" }),
  }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { albumId: "saved-album" });
  assert.deepEqual(seen, ["standard", "legacy"]);
});

test("recovery handles missing spaces, typos and scoped spoken aliases", () => {
  assert.match(search.approximateAlbumQuery("x100pre Bad Bunny", "album"), /releasegroup:"x"/);
  assert.match(search.approximateAlbumQuery("x100pre Bad Bunny", "album"), /releasegroup:"100pre"/);
  assert.match(search.approximateAlbumQuery("Utoipa Travis Scott", "album"), /releasegroup:utoipa~1/);
  assert.match(search.approximateAlbumQuery("porsiempre Bad Bunny", "album"), /releasegroup:100pre~1/);
  assert.doesNotMatch(search.approximateAlbumQuery("por siempre Otro Artista", "album"), /100pre/);
  assert.match(search.approximateAlbumQuery("randomaccess memories", "ep"), /primarytype:ep/);
  assert.equal(search.approximateAlbumQuery("!!!", "album"), "");
});

test("precise results do not trigger a second request", async () => {
  let calls = 0;
  mockFetch(() => { calls++; return { "release-groups": [group("utopia", "UTOPIA", { score: 100 })] }; });
  const albums = await api.searchAlbums("Utopia Travis Scott");
  assert.equal(calls, 1);
  assert.equal(albums[0].approximate, false);
});

test("empty results trigger recovery with filters and mark suggestions", async () => {
  let calls = 0;
  mockFetch(url => {
    calls++;
    assert.match(url.searchParams.get("query"), /primarytype:album/);
    return { "release-groups": calls === 1 ? [] : [group("utopia", "UTOPIA", { score: 100 })] };
  });
  const albums = await api.searchAlbums("Utoipa Travis Scott");
  assert.equal(calls, 2);
  assert.equal(albums[0].approximate, true);
});

test("low-scoring suggestions are excluded and an empty search stays empty", async () => {
  let calls = 0;
  mockFetch(() => ({ "release-groups": ++calls === 1 ? [] : [group("weak", "Unrelated", { score: 30 })] }));
  assert.deepEqual(await api.searchAlbums("Unrelated typo"), []);
  assert.equal(calls, 2);
});
