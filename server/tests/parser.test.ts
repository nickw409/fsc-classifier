import { test } from "node:test";
import assert from "node:assert/strict";
import { parseLLMResponse } from "../src/parser.js";

const CLEAN = `{"analysis":"A cable maker.","codes":[{"code":"4010","confidence":"high","reasoning":"r","evidence":"e"}]}`;

test("parses clean JSON", () => {
  const out = parseLLMResponse(CLEAN);
  assert.equal(out.analysis, "A cable maker.");
  assert.equal(out.codes.length, 1);
  assert.equal(out.codes[0].code, "4010");
  assert.equal(out.codes[0].confidence, "high");
});

test("strips markdown fences (```json)", () => {
  const wrapped = "```json\n" + CLEAN + "\n```";
  const out = parseLLMResponse(wrapped);
  assert.equal(out.codes[0].code, "4010");
});

test("strips plain ``` fences", () => {
  const wrapped = "```\n" + CLEAN + "\n```";
  const out = parseLLMResponse(wrapped);
  assert.equal(out.codes[0].code, "4010");
});

test("extracts JSON after preamble prose", () => {
  const withPreamble = `Sure, here is the classification:\n\n${CLEAN}`;
  const out = parseLLMResponse(withPreamble);
  assert.equal(out.codes[0].code, "4010");
});

test("extracts JSON before trailing prose", () => {
  const withTrailing = `${CLEAN}\n\nLet me know if you need more detail.`;
  const out = parseLLMResponse(withTrailing);
  assert.equal(out.codes[0].code, "4010");
});

test("handles both preamble and trailing prose", () => {
  const msg = `Here you go:\n\n${CLEAN}\n\nHope that helps!`;
  const out = parseLLMResponse(msg);
  assert.equal(out.codes[0].code, "4010");
});

test("drops codes with invalid shape", () => {
  const msg = `{"analysis":"x","codes":[
    {"code":"4010","confidence":"high","reasoning":"r","evidence":"e"},
    {"code":"xx","confidence":"high","reasoning":"r","evidence":"e"},
    {"code":"4011","confidence":"maybe","reasoning":"r","evidence":"e"}
  ]}`;
  const out = parseLLMResponse(msg);
  assert.equal(out.codes.length, 1);
  assert.equal(out.codes[0].code, "4010");
});

test("throws on missing JSON object", () => {
  assert.throws(() => parseLLMResponse("no json here"));
});

test("throws on missing analysis field", () => {
  assert.throws(() => parseLLMResponse(`{"codes":[]}`));
});
