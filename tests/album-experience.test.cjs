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

const { AlbumTopThree } = load("components/AlbumTopThree.tsx", {});
const { groupAlbumProgress } = load("lib/albums/progress.ts", {});
const { PieChart } = load("components/PieChart.tsx", {});
global.localStorage = dom.window.localStorage;
const tracks = ["Uno", "Dos", "Tres", "Cuatro"].map((title, i) => ({ id: String(i), title }));

test("top three requires distinct selections, persists order, and isolates accounts", async () => {
  localStorage.clear();
  const props = { albumId: "album", userId: "alice", tracks };
  const view = render(React.createElement(AlbumTopThree, props));
  fireEvent.click(await screen.findByText("Elegir mis canciones"));
  const selects = screen.getAllByRole("combobox");
  assert.equal(screen.getByText("Guardar top 3").disabled, true);
  fireEvent.change(selects[0], { target: { value: "2" } });
  assert.equal(selects[1].querySelector('option[value="2"]').disabled, true);
  fireEvent.change(selects[1], { target: { value: "0" } });
  fireEvent.change(selects[2], { target: { value: "3" } });
  fireEvent.click(screen.getByText("Guardar top 3"));
  assert.deepEqual(JSON.parse(localStorage.getItem("ding:top-three:alice:album")), ["2", "0", "3"]);
  assert.equal(screen.queryByRole("combobox"), null);
  view.unmount();
  const restored = render(React.createElement(AlbumTopThree, props));
  await screen.findByText("Editar mi top 3");
  assert.deepEqual(screen.getAllByRole("listitem").map((li) => li.textContent), ["1Tres", "2Uno", "3Cuatro"]);
  fireEvent.click(screen.getByText("Editar mi top 3"));
  fireEvent.change(screen.getAllByRole("combobox")[0], { target: { value: "1" } });
  fireEvent.click(screen.getByText("Cancelar"));
  assert.deepEqual(JSON.parse(localStorage.getItem("ding:top-three:alice:album")), ["2", "0", "3"]);
  restored.unmount();
  render(React.createElement(AlbumTopThree, { ...props, userId: "bob" }));
  await screen.findByText("Elegir mis canciones");
  assert.equal(screen.getAllByText("Por elegir").length, 3);
});

test("unfinished albums remain pending until an album-level rating exists", () => {
  const rows = [
    { track_id: "a1", album_id: "a" }, { track_id: "a2", album_id: "a" },
    { track_id: "b1", album_id: "b" }, { track_id: "a1", album_id: "a" },
  ];
  const pending = groupAlbumProgress(rows, ["b"]);
  assert.deepEqual([...pending.keys()], ["a"]);
  assert.equal(pending.get("a").size, 2);
  assert.equal(groupAlbumProgress(rows, ["a", "b"]).size, 0);
  assert.equal(groupAlbumProgress([], []).size, 0);
});

test("distribution explains counts and renders a single-note distribution", () => {
  render(React.createElement(PieChart, { ratings: { 10: 4 }, totalTracks: 4 }));
  assert.ok(screen.getByText("4 canciones · 100%"));
  assert.ok(screen.getByText("10 / 10"));
  assert.ok(screen.getByText(/Las pendientes no cuentan/));
});

let own = "Mi comentario original";
let rejectWrite = false;
const { TrackComments } = load("components/TrackComments.tsx", {
  "@/app/(app)/album/track-comments": {
    readTrackComments: async () => ({ own, signedIn: true, items: own ? [{ id: "c", username: "alice", content: own }] : [] }),
    writeTrackComment: async (_, content) => { if (rejectWrite) throw Error(); own = content; },
  },
});
test("published comments are read-only; editing can cancel, retry, and close on save", async () => {
  own = "Mi comentario original";
  rejectWrite = false;
  render(React.createElement(TrackComments, { trackId: "t" }));
  fireEvent.click(screen.getByText("Comentarios"));
  await screen.findByText(own);
  assert.equal(screen.queryByRole("textbox"), null);
  fireEvent.click(screen.getByText("Opciones de mi comentario"));
  fireEvent.click(screen.getByText("Editar comentario"));
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "Borrador" } });
  fireEvent.click(screen.getByText("Cancelar"));
  assert.equal(own, "Mi comentario original");
  fireEvent.click(screen.getByText("Editar comentario"));
  assert.equal(screen.getByRole("textbox").value, own);
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "Comentario editado" } });
  rejectWrite = true;
  fireEvent.click(screen.getByText("Guardar cambios"));
  await screen.findByText(/No se guardó el comentario/);
  assert.equal(screen.getByRole("textbox").value, "Comentario editado");
  rejectWrite = false;
  fireEvent.click(screen.getByText("Guardar cambios"));
  await screen.findByText("Comentario guardado.");
  assert.equal(screen.queryByRole("textbox"), null);
  assert.equal(own, "Comentario editado");
});
