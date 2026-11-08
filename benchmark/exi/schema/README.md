# JJazzLab .sng schema (initial)

File: `jjazzlab-sng.xsd`

This first XSD draft is intended for the schema-informed EXI benchmark. It is
based on the public JJazzLab `SongImpl` serialization proxy and public
`.sng` examples.

## Scope

- Constrains the outer `Song` serialization envelope and its field order.
- Accounts for the legacy `spClientProperties` representation and the newer
  `spClientPropertiesV3` representation.
- Declares element names observed in public song files and source code.
- Keeps nested model objects permissive to tolerate XStream serialization
  details, version changes, aliases, object references and additional fields.

## Important limitation

This is **not yet a complete semantic/validation schema** for every JJazzLab
version. The nested model structures are intentionally open. This is a useful
first experiment for schema-informed EXI, but its compression benefit must be
measured; a more detailed schema should only be added after checking it against
a broad corpus of real `.sng` files from multiple JJazzLab versions.

The schema does not describe the separate `.mix` format.

## Public references

- JJazzLab source: `model/SongImpl/.../org/jjazz/song/SongImpl.java`
  (serialization proxy, version fields and XStream aliases).
- JJazzLab User Guide: "Song and mix files".
- Public test songs under `model/SongImpl/src/test/resources/org/jjazz/song/`.
