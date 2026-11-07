import { parseXml, serializeXml } from "./xml.js";
import { generateReferenceModel, validateReferenceModel, FORMAT_VERSION } from "./model.js";
import { encodeDocument, decodeDocument } from "./codec.js";

export { parseXml, serializeXml, generateReferenceModel, validateReferenceModel, FORMAT_VERSION, encodeDocument, decodeDocument };

export function generateModelFromXml(xmlDocuments, options) {
  return generateReferenceModel(xmlDocuments.map(parseXml), options);
}

export function encodeXml(xml, model) {
  return encodeDocument(parseXml(xml), model);
}

export function decodeXml(encoded, model) {
  return serializeXml(decodeDocument(encoded, model));
}
