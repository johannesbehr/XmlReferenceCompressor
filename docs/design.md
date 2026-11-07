# Initial design

## Processing pipeline

1. Parse XML into a small ordered document tree.
2. Generate a reference model from one or more reference documents.
3. Find recurring element-subtree shapes in the reference documents.
4. Store a representative subtree for each useful shape.
5. Encode matching input subtrees as a template ID plus a list of value deltas.
6. Encode unmatched or structurally different nodes using the generic representation.
7. Decode by expanding templates and applying deltas.

## Template matching

A template shape includes the element qualified name, sorted attribute names, ordered child node kinds, recursive child element shapes, and processing-instruction targets. Attribute, text, CDATA, comment, and PI body values are excluded from the shape and can be encoded as deltas.

This first version only creates templates for element subtrees observed at least twice. A template is applied only when the complete subtree shape matches. If a child is added, removed, reordered, or changes node kind, the generic representation is used at that point. Descendants can still use their own templates.

## Generic node representation

Compact tagged arrays are used:

- element: ["e", name, attributes, children]
- text: ["t", value]
- CDATA: ["c", value]
- comment: ["m", value]
- processing instruction: ["p", target, body]
- doctype: ["d", value]

The document envelope stores the XML declaration separately and keeps document-level nodes in order.

## Template reference and deltas

A matching element is encoded as ["r", templateId, patches]. A patch contains a path and replacement value. Paths address attributes (["a", attributeName]), child nodes ([childIndex, ...]), node values (append "v"), or PI bodies (append "b").

## Compatibility and fidelity

The model has a format version and SHA-256 fingerprint. Encoded documents carry that fingerprint; decoding with a different model fails explicitly.

The goal is semantic XML preservation, not byte-for-byte reproduction. XML parsers normalize entity references and line endings, and serializers may choose different quoting or empty-element syntax. The ordered node tree preserves the supported XML information: element/attribute names and values, child order, text, CDATA, comments, processing instructions, and doctype text.

## Future work

- Benchmark template selection by estimated byte savings, not frequency alone.
- Add reusable attribute-name and string dictionaries.
- Add optional canonicalization modes.
- Add a binary container and gzip/brotli comparisons.
- Add streaming and resource limits for untrusted input.
- Expand tests for namespaces, DTDs, XML declarations, and edge cases.

## Current parser limitations

The first parser adapter uses the `saxes` package. It handles ordinary XML documents and preserves the document node types represented by the internal tree. External entity resolution and full DTD processing are not implemented as a feature of this compressor. Inputs relying on custom DTD-defined entities should be treated as unsupported until dedicated tests and a safe entity policy are added.
