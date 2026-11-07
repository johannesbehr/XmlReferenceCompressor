import { SaxesParser } from "saxes";

function append(stack, document, node) {
  const parent = stack.at(-1);
  (parent ? parent.children : document.children).push(node);
}

/** Parse XML into an ordered document tree. */
export function parseXml(xml) {
  if (typeof xml !== "string") throw new TypeError("XML input must be a string");

  const document = { declaration: null, children: [] };
  const stack = [];
  const parser = new SaxesParser({ xmlns: false });

  parser.on("xmldecl", (declaration) => { document.declaration = { ...declaration }; });
  parser.on("opentag", (tag) => {
    const node = { type: "element", name: tag.name, attributes: { ...tag.attributes }, children: [] };
    append(stack, document, node);
    stack.push(node);
  });
  parser.on("closetag", () => { stack.pop(); });
  parser.on("text", (value) => {
    if (value.length) append(stack, document, { type: "text", value });
  });
  parser.on("cdata", (value) => append(stack, document, { type: "cdata", value }));
  parser.on("comment", (value) => append(stack, document, { type: "comment", value }));
  parser.on("processinginstruction", ({ target, body }) => append(stack, document, { type: "pi", target, body }));
  parser.on("doctype", (value) => append(stack, document, { type: "doctype", value }));

  parser.write(xml).close();
  return document;
}

function escapeText(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function escapeAttribute(value) {
  return escapeText(value).replaceAll('"', "&quot;").replaceAll("\r", "&#13;").replaceAll("\n", "&#10;").replaceAll("\t", "&#9;");
}

function serializeNode(node) {
  switch (node.type) {
    case "element": {
      const attrs = Object.entries(node.attributes).map(([name, value]) => ` ${name}="${escapeAttribute(value)}"`).join("");
      if (node.children.length === 0) return `<${node.name}${attrs}/>`;
      return `<${node.name}${attrs}>${node.children.map(serializeNode).join("")}</${node.name}>`;
    }
    case "text": return escapeText(node.value);
    case "cdata": return `<![CDATA[${String(node.value).replaceAll("]]>", "]]]]><![CDATA[>")}]]>`;
    case "comment": return `<!--${node.value}-->`;
    case "pi": return `<?${node.target}${node.body ? ` ${node.body}` : ""}?>`;
    case "doctype": return `<!DOCTYPE ${node.value}>`;
    default: throw new Error(`Unsupported XML node type: ${node.type}`);
  }
}

export function serializeXml(document) {
  const declaration = document.declaration
    ? `<?xml version="${document.declaration.version ?? "1.0"}"${document.declaration.encoding ? ` encoding="${document.declaration.encoding}"` : ""}${document.declaration.standalone == null ? "" : ` standalone="${document.declaration.standalone ? "yes" : "no"}"`}?>`
    : "";
  return declaration + document.children.map(serializeNode).join("");
}
