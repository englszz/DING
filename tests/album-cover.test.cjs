/* eslint-disable @typescript-eslint/no-require-imports */
const { test, afterEach, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
const { JSDOM } = require("jsdom");
const dom = new JSDOM("<html><body></body></html>", {
  url: "http://localhost",
});
global.window = dom.window;
global.document = dom.window.document;
global.HTMLElement = dom.window.HTMLElement;
const React = require("react");
const {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} = require("@testing-library/react");
afterEach(cleanup);
after(() => dom.window.close());
function load(file, deps) {
  const m = { exports: {} };
  new Function(
    "require",
    "module",
    "exports",
    ts.transpileModule(fs.readFileSync(file, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
      },
    }).outputText,
  )((name) => deps[name] ?? require(name), m, m.exports);
  return m.exports;
}


const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; });
global.IntersectionObserver = class { observe() {} disconnect() {} };
const { AlbumCover } = load("components/AlbumCover.tsx", {
  "next/image": { default: ({ src, alt, onError, onLoad }) => React.createElement("img", { src, alt, onError, onLoad }) },
});
test("broken covers try the same edition once, then show a neutral placeholder", async () => {
  let requests = 0;
  global.fetch = async url => {
    requests++;
    assert.match(url, /type=release&id=edition-id/);
    return Response.json({ covers: ["https://archive.org/download/mbid-edition/front.jpg"] });
  };
  render(React.createElement(AlbumCover, {
    album: { mbid: "edition-id", entityType: "release", title: "BULLY", coverUrl: "https://coverartarchive.org/release/edition-id/front-500" },
    sizes: "192px", priority: true,
  }));
  fireEvent.error(screen.getByRole("img", { name: "BULLY", exact: true }));
  await waitFor(() => assert.match(screen.getByRole("img", { name: "BULLY", exact: true }).src, /archive.org\/download/));
  fireEvent.error(screen.getByRole("img", { name: "BULLY", exact: true }));
  await screen.findByRole("img", { name: "Portada no disponible: BULLY" });
  assert.equal(screen.queryByRole("img", { name: "BULLY", exact: true }), null);
  assert.equal(requests, 1);
});
test("successful covers do not request another catalog or change edition", async () => {
  global.fetch = async () => { throw Error("Unexpected cover lookup"); };
  render(React.createElement(AlbumCover, {
    album: { mbid: "123", entityType: "itunes", title: "Album", coverUrl: "https://is1-ssl.mzstatic.com/image/600x600bb.jpg" },
    sizes: "192px", priority: true,
  }));
  fireEvent.load(screen.getByRole("img", { name: "Album", exact: true }));
  assert.equal(screen.queryByRole("img", { name: "Cargando portada: Album" }), null);
  assert.match(screen.getByRole("img", { name: "Album", exact: true }).src, /600x600/);
});
