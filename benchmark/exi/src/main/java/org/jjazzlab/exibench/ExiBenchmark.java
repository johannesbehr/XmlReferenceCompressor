package org.jjazzlab.exibench;

import com.siemens.ct.exi.core.CodingMode;
import com.siemens.ct.exi.core.EncodingOptions;
import com.siemens.ct.exi.core.EXIFactory;
import com.siemens.ct.exi.core.FidelityOptions;
import com.siemens.ct.exi.core.helpers.DefaultEXIFactory;
import com.siemens.ct.exi.grammars.GrammarFactory;
import com.siemens.ct.exi.main.api.sax.EXIResult;
import com.siemens.ct.exi.main.api.sax.EXISource;
import org.w3c.dom.NamedNodeMap;
import org.w3c.dom.Node;
import org.xml.sax.InputSource;
import org.xml.sax.XMLReader;
import org.xml.sax.helpers.XMLReaderFactory;

import javax.xml.parsers.DocumentBuilderFactory;
import javax.xml.transform.TransformerFactory;
import javax.xml.transform.dom.DOMResult;
import javax.xml.transform.sax.SAXSource;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.TreeMap;
import java.util.zip.GZIPOutputStream;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

/** Benchmarks schema-less EXI and optional schema-informed EXI for .sng files. */
public final class ExiBenchmark {
    private ExiBenchmark() {}

    private record ResultRow(String name, int originalBytes, int gzipBytes,
            int bitPackedBytes, long bitPackedEncodeMs, long bitPackedDecodeMs, boolean bitPackedRoundTrip,
            int compressionBytes, long compressionEncodeMs, long compressionDecodeMs, boolean compressionRoundTrip,
            int schemaCompressionBytes, long schemaCompressionEncodeMs, long schemaCompressionDecodeMs,
            boolean schemaCompressionRoundTrip) {}

    private record ModeResult(byte[] encoded, long encodeMs, long decodeMs, boolean roundTrip) {}

    public static void main(String[] args) throws Exception {
        if (args.length < 1 || args.length > 3) {
            System.err.println("Usage: ExiBenchmark <songs.zip> [output-directory] [schema.xsd]");
            System.exit(2);
        }
        Path zipPath = Path.of(args[0]);
        Path outputDir = args.length >= 2 ? Path.of(args[1]) : Path.of("exi-results");
        Path schemaPath = args.length >= 3 ? Path.of(args[2]).toAbsolutePath() : null;
        if (schemaPath != null && !Files.isRegularFile(schemaPath)) {
            throw new IllegalArgumentException("XSD not found: " + schemaPath);
        }
        Files.createDirectories(outputDir);

        List<ResultRow> rows = new ArrayList<>();
        try (ZipInputStream zip = new ZipInputStream(Files.newInputStream(zipPath))) {
            ZipEntry entry;
            while ((entry = zip.getNextEntry()) != null) {
                if (entry.isDirectory() || !entry.getName().toLowerCase(Locale.ROOT).endsWith(".sng")) continue;
                byte[] xml = zip.readAllBytes();
                String name = Path.of(entry.getName()).getFileName().toString();
                ResultRow row = benchmarkOne(name, xml, outputDir, schemaPath);
                rows.add(row);
                System.out.printf(Locale.ROOT,
                        "%-28s XML %,8d | GZIP %,6d | EXI bit %,6d | EXI compression %,6d",
                        name, row.originalBytes(), row.gzipBytes(), row.bitPackedBytes(), row.compressionBytes());
                if (schemaPath != null) System.out.printf(Locale.ROOT, " | EXI schema+compression %,6d", row.schemaCompressionBytes());
                System.out.println();
            }
        }
        if (rows.isEmpty()) throw new IllegalArgumentException("The ZIP archive contains no .sng files: " + zipPath);
        writeCsv(rows, outputDir.resolve("results.csv"));
        printSummary(rows, schemaPath != null);
        System.out.println();
        System.out.println("CSV report: " + outputDir.resolve("results.csv").toAbsolutePath());
        System.out.println("EXI files:  " + outputDir.toAbsolutePath());
    }

    private static ResultRow benchmarkOne(String name, byte[] xml, Path outputDir, Path schemaPath) throws Exception {
        int gzipBytes = gzip(xml).length;
        ModeResult bitPacked = encodeDecode(xml, CodingMode.BIT_PACKED, null);
        ModeResult compression = encodeDecode(xml, CodingMode.COMPRESSION, null);
        ModeResult schemaCompression = schemaPath == null ? null : encodeDecode(xml, CodingMode.COMPRESSION, schemaPath);

        String safeName = name.replaceAll("[^A-Za-z0-9._-]", "_");
        Files.write(outputDir.resolve(safeName + ".bit-packed.exi"), bitPacked.encoded());
        Files.write(outputDir.resolve(safeName + ".compression.exi"), compression.encoded());
        if (schemaCompression != null) {
            Files.write(outputDir.resolve(safeName + ".schema-compression.exi"), schemaCompression.encoded());
        }

        return new ResultRow(name, xml.length, gzipBytes,
                bitPacked.encoded().length, bitPacked.encodeMs(), bitPacked.decodeMs(), bitPacked.roundTrip(),
                compression.encoded().length, compression.encodeMs(), compression.decodeMs(), compression.roundTrip(),
                schemaCompression == null ? 0 : schemaCompression.encoded().length,
                schemaCompression == null ? 0 : schemaCompression.encodeMs(),
                schemaCompression == null ? 0 : schemaCompression.decodeMs(),
                schemaCompression != null && schemaCompression.roundTrip());
    }

    private static ModeResult encodeDecode(byte[] xml, CodingMode mode, Path schemaPath) throws Exception {
        EXIFactory factory = DefaultEXIFactory.newInstance();
        factory.setCodingMode(mode);
        if (schemaPath != null) {
            factory.setGrammars(GrammarFactory.newInstance().createGrammars(schemaPath.toString()));
        }

        // Preserve XML information, matching the schema-less benchmark configuration.
        FidelityOptions fidelity = factory.getFidelityOptions();
        fidelity.setFidelity(FidelityOptions.FEATURE_COMMENT, true);
        fidelity.setFidelity(FidelityOptions.FEATURE_PI, true);
        fidelity.setFidelity(FidelityOptions.FEATURE_PREFIX, true);
        fidelity.setFidelity(FidelityOptions.FEATURE_LEXICAL_VALUE, true);
        factory.getEncodingOptions().setOption(EncodingOptions.INCLUDE_OPTIONS);

        ByteArrayOutputStream encodedOut = new ByteArrayOutputStream();
        long encodeStart = System.nanoTime();
        EXIResult exiResult = new EXIResult(factory);
        exiResult.setOutputStream(encodedOut);
        XMLReader xmlReader = XMLReaderFactory.createXMLReader();
        xmlReader.setFeature("http://xml.org/sax/features/namespaces", true);
        xmlReader.setContentHandler(exiResult.getHandler());
        xmlReader.parse(new InputSource(new ByteArrayInputStream(xml)));
        byte[] encoded = encodedOut.toByteArray();
        long encodeMs = elapsedMillis(encodeStart);

        long decodeStart = System.nanoTime();
        EXISource exiSource = new EXISource(factory);
        exiSource.setInputSource(new InputSource(new ByteArrayInputStream(encoded)));
        DOMResult decodedResult = new DOMResult();
        TransformerFactory.newInstance().newTransformer().transform((SAXSource) exiSource, decodedResult);
        long decodeMs = elapsedMillis(decodeStart);

        Node originalDom = parseXml(xml);
        Node decodedDom = decodedResult.getNode();
        return new ModeResult(encoded, encodeMs, decodeMs,
                compareNodes(originalDom, decodedDom, "/") == null);
    }

    private static Node parseXml(byte[] xml) throws Exception {
        DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
        factory.setNamespaceAware(true);
        factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
        factory.setFeature("http://xml.org/sax/features/external-general-entities", false);
        factory.setFeature("http://xml.org/sax/features/external-parameter-entities", false);
        return factory.newDocumentBuilder().parse(new ByteArrayInputStream(xml));
    }

    private static String compareNodes(Node a, Node b, String path) {
        if (a == null || b == null) return a == b ? null : path + " missing node";
        if (a.getNodeType() != b.getNodeType()) return path + " node type differs";
        if (!safeEquals(a.getNodeName(), b.getNodeName())) return path + " node name differs";
        if (!safeEquals(a.getNamespaceURI(), b.getNamespaceURI())) return path + " namespace differs";
        if (a.getNodeType() == Node.ELEMENT_NODE) {
            Map<String, String> attrsA = attributes(a.getAttributes());
            Map<String, String> attrsB = attributes(b.getAttributes());
            if (!attrsA.equals(attrsB)) return path + " attributes differ: " + attrsA + " vs " + attrsB;
        } else if (!safeEquals(a.getNodeValue(), b.getNodeValue())) {
            return path + " value differs";
        }
        Node childA = a.getFirstChild();
        Node childB = b.getFirstChild();
        int index = 0;
        while (childA != null && childB != null) {
            String mismatch = compareNodes(childA, childB, path + index + "/");
            if (mismatch != null) return mismatch;
            childA = childA.getNextSibling();
            childB = childB.getNextSibling();
            index++;
        }
        return childA != null || childB != null ? path + " child count differs" : null;
    }

    private static Map<String, String> attributes(NamedNodeMap map) {
        Map<String, String> result = new TreeMap<>();
        for (int i = 0; i < map.getLength(); i++) {
            Node attr = map.item(i);
            result.put(attr.getNodeName(), attr.getNodeValue());
        }
        return result;
    }

    private static boolean safeEquals(Object a, Object b) {
        return a == null ? b == null : a.equals(b);
    }

    private static byte[] gzip(byte[] input) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        try (GZIPOutputStream gzip = new GZIPOutputStream(out)) { gzip.write(input); }
        return out.toByteArray();
    }

    private static long elapsedMillis(long start) {
        return (System.nanoTime() - start) / 1_000_000;
    }

    private static void writeCsv(List<ResultRow> rows, Path output) throws IOException {
        StringBuilder csv = new StringBuilder();
        csv.append("file,original_bytes,gzip_bytes,exi_bit_packed_bytes,bit_packed_encode_ms,bit_packed_decode_ms,bit_packed_roundtrip,exi_compression_bytes,compression_encode_ms,compression_decode_ms,compression_roundtrip,exi_schema_compression_bytes,schema_compression_encode_ms,schema_compression_decode_ms,schema_compression_roundtrip\n");
        for (ResultRow r : rows) {
            csv.append(csv(r.name())).append(',')
                    .append(r.originalBytes()).append(',')
                    .append(r.gzipBytes()).append(',')
                    .append(r.bitPackedBytes()).append(',')
                    .append(r.bitPackedEncodeMs()).append(',')
                    .append(r.bitPackedDecodeMs()).append(',')
                    .append(r.bitPackedRoundTrip()).append(',')
                    .append(r.compressionBytes()).append(',')
                    .append(r.compressionEncodeMs()).append(',')
                    .append(r.compressionDecodeMs()).append(',')
                    .append(r.compressionRoundTrip()).append(',')
                    .append(r.schemaCompressionBytes()).append(',')
                    .append(r.schemaCompressionEncodeMs()).append(',')
                    .append(r.schemaCompressionDecodeMs()).append(',')
                    .append(r.schemaCompressionRoundTrip()).append('\n');
        }
        Files.writeString(output, csv, StandardCharsets.UTF_8);
    }

    private static String csv(String value) {
        return "\"" + value.replace("\"", "\"\"") + "\"";
    }

    private static void printSummary(List<ResultRow> rows, boolean schemaTested) {
        long original = rows.stream().mapToLong(ResultRow::originalBytes).sum();
        long gzip = rows.stream().mapToLong(ResultRow::gzipBytes).sum();
        long bitPacked = rows.stream().mapToLong(ResultRow::bitPackedBytes).sum();
        long compression = rows.stream().mapToLong(ResultRow::compressionBytes).sum();
        long schemaCompression = rows.stream().mapToLong(ResultRow::schemaCompressionBytes).sum();
        long failed = rows.stream().filter(r -> !r.bitPackedRoundTrip() || !r.compressionRoundTrip()
                || (schemaTested && !r.schemaCompressionRoundTrip())).count();

        System.out.println();
        System.out.println("TOTALS");
        System.out.printf(Locale.ROOT, "Original XML:         %,d bytes%n", original);
        System.out.printf(Locale.ROOT, "GZIP:                 %,d bytes (%.2f%% of original)%n", gzip, percent(gzip, original));
        System.out.printf(Locale.ROOT, "EXI bit-packed:       %,d bytes (%.2f%% of original)%n", bitPacked, percent(bitPacked, original));
        System.out.printf(Locale.ROOT, "EXI compression:     %,d bytes (%.2f%% of original)%n", compression, percent(compression, original));
        if (schemaTested) {
            System.out.printf(Locale.ROOT, "EXI schema+compress: %,d bytes (%.2f%% of original)%n",
                    schemaCompression, percent(schemaCompression, original));
        }
        System.out.printf(Locale.ROOT, "Round-trip failures: %d%n", failed);
    }

    private static double percent(long value, long total) {
        return total == 0 ? 0 : value * 100.0 / total;
    }
}
