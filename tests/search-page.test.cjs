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
  assert.equal(screen.getByRole("combobox").value, "album");
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
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "ep" } });
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
  assert.deepEqual(body, { mbid: "group-id", entityType: "release-group" });
});

test("approximate results display a hint without rewriting the query", async () => {
  global.fetch = async () => json({ albums: [{ ...album, approximate: true }] });
  render(React.createElement(Page));
  type("Utoipa Travis Scott");
  await screen.findByRole("status");
  assert.equal(input().value, "Utoipa Travis Scott");
  assert.ok(screen.getByText("UTOPIA"));
});
