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
let calls = [],
  fail = false;
const { TrackRatingInput } = load("components/TrackRatingInput.tsx", {
  "@/app/(app)/album/actions": {
    saveTrackRating: async (id, rating) => {
      if (fail) throw Error();
      calls.push(rating);
    },
    deleteTrackRating: async () => calls.push(null),
  },
});
test("typing 10 and 10.0 commits only the complete score on blur", async () => {
  calls = [];
  fail = false;
  render(React.createElement(TrackRatingInput, { trackId: "track" }));
  const input = screen.getByRole("textbox");
  fireEvent.change(input, { target: { value: "1" } });
  assert.deepEqual(calls, []);
  fireEvent.change(input, { target: { value: "10.0" } });
  assert.deepEqual(calls, []);
  fireEvent.blur(input);
  await screen.findByText("Guardado");
  assert.deepEqual(calls, [10]);
  assert.equal(input.value, "10");
  fireEvent.blur(input);
  assert.deepEqual(calls, [10]);
});
test("invalid scores never write and failed saves remain retryable", async () => {
  calls = [];
  fail = false;
  render(
    React.createElement(TrackRatingInput, {
      trackId: "track",
      existingRating: 8,
    }),
  );
  const input = screen.getByRole("textbox");
  fireEvent.change(input, { target: { value: "11" } });
  fireEvent.blur(input);
  assert.deepEqual(calls, []);
  assert.ok(screen.getByText("Usa un número entre 0 y 10"));
  fail = true;
  fireEvent.change(input, { target: { value: "10" } });
  fireEvent.blur(input);
  await screen.findByText("No se guardó. Inténtalo de nuevo.");
  fail = false;
  fireEvent.blur(input);
  await screen.findByText("Guardado");
  assert.deepEqual(calls, [10]);
});
test("clearing a score waits for blur before deleting", async () => {
  calls = [];
  fail = false;
  render(
    React.createElement(TrackRatingInput, {
      trackId: "track",
      existingRating: 8,
    }),
  );
  const input = screen.getByRole("textbox");
  fireEvent.change(input, { target: { value: "" } });
  assert.deepEqual(calls, []);
  fireEvent.blur(input);
  await waitFor(() => assert.deepEqual(calls, [null]));
});
