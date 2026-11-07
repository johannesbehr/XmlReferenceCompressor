import test from "node:test";
import assert from "node:assert/strict";
import {
  parseXml, serializeXml, generateReferenceModel, encodeDocument, decodeDocument
} from "../src/index.js";

function roundTrip(references, input) {
  const model = generateReferenceModel(references.map(parseXml));
  const encoded = encodeDocument(parseXml(input), model);
  const restored = serializeXml(decodeDocument(encoded, model));
  return { model, encoded, restored };
}

test("learns repeated structures and encodes changed values as deltas", () => {
  const refs = [
    '<root><item id="one"><label>Alpha</label><value>10</value></item></root>',
    '<root><item id="two"><label>Beta</label><value>20</value></item></root>'
  ];
  const input = '<root><item id="three"><label>Gamma</label><value>30</value></item></root>';
  const { model, encoded, restored } = roundTrip(refs, input);

  assert.ok(model.templates.length > 0);
  assert.equal(encoded.nodes[0][0], "e");
  assert.match(restored, /id="three"/);
  assert.match(restored, /Gamma/);
  assert.match(restored, />30</);
});

test("generic fallback preserves comments, CDATA and processing instructions", () => {
  const refs = [
    '<root><known a="1"><child>same</child></known></root>',
    '<root><known a="2"><child>other</child></known></root>'
  ];
  const input = '<?xml version="1.0"?><!--before--><root><unknown x="y"><![CDATA[a < b]]></unknown><?work now?></root>';
  const { restored } = roundTrip(refs, input);
  const parsedAgain = parseXml(restored);
  assert.equal(parsedAgain.children[0].type, "comment");
  assert.equal(parsedAgain.children[1].children[0].name, "unknown");
  assert.equal(parsedAgain.children[1].children[0].children[0].type, "cdata");
  assert.equal(parsedAgain.children[1].children[1].type, "pi");
});

test("rejects decoding with a different reference model", () => {
  const a = generateReferenceModel([parseXml('<root><a>one</a><a>two</a></root>')]);
  const b = generateReferenceModel([parseXml('<root><b>one</b><b>two</b></root>')]);
  const encoded = encodeDocument(parseXml('<root><a>three</a><a>four</a></root>'), a);
  assert.throws(() => decodeDocument(encoded, b), /different reference model/);
});

test("preserves attribute values containing XML-special characters", () => {
  const refs = ['<root><item value="a"/></root>', '<root><item value="b"/></root>'];
  const input = '<root><item value="a &amp; b &quot; c"/></root>';
  const { restored } = roundTrip(refs, input);
  assert.equal(parseXml(restored).children[0].children[0].attributes.value, 'a & b " c');
});

test("keeps whitespace text nodes and document-level order", () => {
  const refs = ['<root><x>one</x></root>', '<root><x>two</x></root>'];
  const input = '\n<!--top--><root>  <x>three</x> \n</root>';
  const { restored } = roundTrip(refs, input);
  const parsed = parseXml(restored);
  assert.equal(parsed.children[0].type, "text");
  assert.equal(parsed.children[1].type, "comment");
  assert.equal(parsed.children[2].children[0].value, "  ");
});
