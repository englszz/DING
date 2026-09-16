/* eslint-disable @typescript-eslint/no-require-imports */
const { test, afterEach, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const { JSDOM } = require("jsdom");
const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost" });
global.window = dom.window;
global.document = dom.window.document;
global.HTMLElement = dom.window.HTMLElement;
const React = require("react");
const { render, screen, fireEvent, waitFor, cleanup } = require("@testing-library/react");
const originalFetch = global.fetch;
afterEach(() => { cleanup(); global.fetch = originalFetch; });
after(() => dom.window.close());

function load(file, dependencies = {}) {
  const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, "..", file), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const compiledModule = { exports: {} };
  new Function("require", "module", "exports", source)(
    name => dependencies[name] ?? require(name), compiledModule, compiledModule.exports);
  return compiledModule.exports;
}
const router = { push() {} };
const Page = load("app/(app)/search/page.tsx", {
  "@/components/AlbumCover": { AlbumCover: () => null },
  "@/components/AlbumEditions": { AlbumEditions: () => null },
  "@/lib/albums/search-filters": load("lib/albums/search-filters.ts", { "@/lib/musicbrainz/search": load("lib/musicbrainz/search.ts") }),
  "@/components/ItunesBadge": {ItunesBadge:()=>null},
  "@/components/ArtistPortrait": { ArtistPortrait: () => null },
  "@/components/AlbumLibrary": { SaveAlbumButton: () => null },
  "@/lib/albums/open": load("lib/albums/open.ts"),
  "next/navigation": { useRouter: () => router },
  "next/image": ({ src, alt, onError }) => React.createElement("img", { src, alt, onError }),
  "next/link": ({ href, children }) => React.createElement("a", { href }, children),
  "@fortawesome/react-fontawesome": { FontAwesomeIcon: () => null },
  "@/lib/musicbrainz/search": load("lib/musicbrainz/search.ts"),
}).default;
const album = { mbid: "group-id", entityType: "release-group", title: "UTOPIA", artist: "Travis Scott" };
const json = (data, status = 200) => new Response(JSON.stringify(data), { status });
const input = () => screen.getByRole("textbox");
const type = value => fireEvent.change(input(), { target: { value } });

test("typing from a pending discography returns to Albums and ignores the late response", async () => {
  const calls = [];
  let finishDiscography;
  global.fetch = async (url, options = {}) => {
    calls.push({ url, ...options });
    if (options.method === "POST") return new Promise(resolve => { finishDiscography = resolve; });
    if (url.includes("type=artists")) return json({ artists: [{ id: "artist-id", name: "Travis Scott" }] });
    return json({ albums: [album] });
  };
  render(React.createElement(Page));
  fireEvent.click(screen.getByRole("button", { name: "Artistas", exact: true }));
  type("Travis Scott");
  fireEvent.click(await screen.findByRole("button", { name: "Discografía" }));
  await waitFor(() => assert.equal(typeof finishDiscography, "function"));
  type("Utopia Travis Scott");
  finishDiscography(json({ albums: [{ ...album, title: "OLD DISCOGRAPHY" }] }));
  await screen.findByText("UTOPIA");
  assert.ok(screen.getByRole("heading", { name: "Buscador Global" }));
  assert.match(screen.getByRole("button", { name: "Álbumes", exact: true }).className, /btn-primary/);
  assert.equal(screen.getByLabelText("Tipo de lanzamiento").value, "album");
  assert.equal(screen.queryByText("OLD DISCOGRAPHY"), null);
  assert.equal(calls.filter(call => call.url.includes("type=artists")).length, 1);
  assert.equal(calls.find(call => call.method === "POST").signal.aborted, true);
  assert.match(calls.at(-1).url, /type=albums/);
});

test("clearing the query cancels an in-flight search and never displays its results", async () => {
  let finish;
  global.fetch = () => new Promise(resolve => { finish = resolve; });
  render(React.createElement(Page));
  type("Utopia");
  await waitFor(() => assert.equal(typeof finish, "function"));
  type("U");
  finish(json({ albums: [album] }));
  await waitFor(() => assert.ok(screen.getByText("Escribe al menos 2 caracteres para buscar.")));
  assert.equal(screen.queryByText("UTOPIA"), null);
  assert.equal(screen.queryByText("Buscando..."), null);
});

test("failed searches show Retry, and type selection sends the chosen filter", async () => {
  const urls = [];
  global.fetch = async url => {
    urls.push(url);
    return urls.length === 1 ? json({ error: "Servicio temporalmente no disponible" }, 502) : json({ albums: [album] });
  };
  render(React.createElement(Page));
  type("Utopia");
  await screen.findByRole("alert");
  assert.equal(screen.queryByText("No se encontraron álbumes."), null);
  fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
  await screen.findByText("UTOPIA");
  fireEvent.change(screen.getByLabelText("Tipo de lanzamiento"), { target: { value: "ep" } });
  await waitFor(() => assert.ok(urls.at(-1).endsWith("kind=ep")));
});

test("opening a search result sends its entity type to the importer", async () => {
  let body;
  global.fetch = async (url, options) => {
    if (url === "/api/album/import") {
      body = JSON.parse(options.body);
      return json({ error: "Inicia sesión para abrir el álbum" }, 401);
    }
    return json({ albums: [album] });
  };
  render(React.createElement(Page));
  type("Utopia");
  fireEvent.click(await screen.findByRole("button", { name: "Ver álbum" }));
  await screen.findByRole("alert");
  assert.deepEqual(body, { mbid: "group-id", entityType: "release-group", title:"UTOPIA",artist:"Travis Scott" });
});

test("approximate results display a hint without rewriting the query", async () => {
  global.fetch = async () => json({ albums: [{ ...album, approximate: true }] });
  render(React.createElement(Page));
  type("Utoipa Travis Scott");
  await screen.findByRole("status");
  assert.equal(input().value, "Utoipa Travis Scott");
  assert.ok(screen.getByText("UTOPIA"));
});

test("returning from an album restores search results, filter and scroll without fetching again", async () => {
  window.sessionStorage.clear();
  const calls = [];
  let destination;
  router.push = value => { destination = value; };
  window.scrollTo = (x,y) => { window.scrollY = y; };
  global.fetch = async url => { calls.push(url); return url === "/api/album/import" ? json({albumId:"local-album"}) : json({albums:[album]}); };
  const view = render(React.createElement(Page));
  type("Utopia Travis Scott");
  fireEvent.change(screen.getByLabelText("Tipo de lanzamiento"), {target:{value:"ep"}});
  await screen.findByText("UTOPIA");
  window.scrollY = 640;
  fireEvent.click(screen.getByRole("button", {name:"Ver álbum"}));
  await waitFor(() => assert.equal(destination,"/album/local-album"));
  view.unmount();
  window.scrollY = 0;
  const count = calls.length;
  render(React.createElement(Page));
  await screen.findByText("UTOPIA");
  assert.equal(input().value,"Utopia Travis Scott");
  assert.equal(screen.getByLabelText("Tipo de lanzamiento").value,"ep");
  await waitFor(() => assert.equal(window.scrollY,640));
  await new Promise(resolve=>setTimeout(resolve,650));
  assert.equal(calls.length,count);
  type("New search");
  await waitFor(() => assert.equal(calls.length,count+1));
});

test("filters isolate artist, year and catalog without another network search", async () => {
  window.sessionStorage.clear();
  let calls = 0;
  global.fetch = async () => { calls++; return json({ albums: [
    { mbid: "digital", entityType: "itunes", title: "BULLY", artist: "Kanye West", year: "2026", trackCount: 18 },
    { mbid: "archive", entityType: "release-group", title: "BULLY", artist: "Ye", year: "2025" },
    { mbid: "other", entityType: "itunes", title: "Bully", artist: "Other Artist", year: "2019" },
  ] }); };
  render(React.createElement(Page));
  type("Bully");
  await screen.findByText("Edición digital · iTunes · 18 canciones");
  fireEvent.change(screen.getByLabelText("Artista exacto"), { target: { value: "Kanye West" } });
  fireEvent.change(screen.getByLabelText("Año"), { target: { value: "2026" } });
  fireEvent.change(screen.getByLabelText("Catálogo"), { target: { value: "itunes" } });
  assert.equal(screen.getAllByRole("button", { name: "Ver álbum", exact: true }).length, 1);
  assert.ok(screen.getByText("1 de 3 resultados"));
  fireEvent.change(screen.getByLabelText("Variante indicada"), { target: { value: "deluxe" } });
  assert.ok(screen.getByText(/Ningún resultado coincide/));
  fireEvent.click(screen.getByText("Limpiar filtros"));
  assert.equal(screen.getAllByRole("button", { name: "Ver álbum", exact: true }).length, 3);
  assert.equal(calls, 1);
});

test("explicit digital-edition links override a saved unrelated search", async () => {
  window.sessionStorage.setItem("ding-search-return-v1", JSON.stringify({
    savedAt: Date.now(), urlSearch: "", query: "Utopia", activeTab: "albums", kind: "album",
    albums: [album], artists: [], users: [], discography: null,
  }));
  window.history.replaceState({}, "", "/search?q=BULLY&source=itunes");
  global.fetch = async () => json({ albums: [{ mbid: "digital", entityType: "itunes", title: "BULLY", artist: "Kanye West" }] });
  try {
    render(React.createElement(Page));
    await screen.findByText("BULLY");
    assert.equal(input().value, "BULLY");
    assert.equal(screen.getByLabelText("Catálogo").value, "itunes");
    assert.equal(screen.queryByText("UTOPIA"), null);
  } finally {
    window.history.replaceState({}, "", "/");
    window.sessionStorage.clear();
  }
});
