import { parseXml, serializeXml, generateReferenceModel, encodeDocument, decodeDocument } from "../src/index.js";

const references = [
  '<library><book id="1"><title>Alpha</title><year>2020</year></book></library>',
  '<library><book id="2"><title>Beta</title><year>2021</year></book></library>'
];
const input = '<library><book id="3"><title>Gamma</title><year>2022</year></book></library>';
const model = generateReferenceModel(references.map(parseXml));
const encoded = encodeDocument(parseXml(input), model);
const restored = serializeXml(decodeDocument(encoded, model));

console.log("Reference templates:", model.templates.length);
console.log("Encoded JSON:", JSON.stringify(encoded));
console.log("Restored XML:", restored);
