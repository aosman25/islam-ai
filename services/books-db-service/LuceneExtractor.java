/**
 * Lucene Text Extractor for Shamela Library
 *
 * This tool extracts text content from the Lucene index and saves it
 * to a SQLite database that can be read by the Python export script.
 *
 * Compile:
 *   javac -cp "lucene-core-9.*.jar:lucene-queryparser-9.*.jar" LuceneExtractor.java
 *
 * Run:
 *   java -cp ".:lucene-core-9.*.jar:lucene-queryparser-9.*.jar:sqlite-jdbc-*.jar" \
 *        LuceneExtractor <index_path> <output_db>
 *
 * Example:
 *   java -cp ".:lib/*" LuceneExtractor database/store/page extracted_texts.db
 */

import java.io.*;
import java.nio.file.*;
import java.sql.*;

import org.apache.lucene.document.Document;
import org.apache.lucene.index.DirectoryReader;
import org.apache.lucene.index.IndexReader;
import org.apache.lucene.index.StoredFields;
import org.apache.lucene.store.FSDirectory;

public class LuceneExtractor {

    public static void main(String[] args) throws Exception {
        if (args.length < 2) {
            System.out.println("Usage: java LuceneExtractor <index_path> <output_db>");
            System.out.println("  index_path: Path to the Lucene index directory");
            System.out.println("  output_db: Path to output SQLite database");
            System.exit(1);
        }

        String indexPath = args[0];
        String outputDb = args[1];

        System.out.println("Lucene Text Extractor for Shamela Library");
        System.out.println("==========================================");
        System.out.println("Index path: " + indexPath);
        System.out.println("Output DB: " + outputDb);
        System.out.println();

        // Open Lucene index
        Path path = Paths.get(indexPath);
        FSDirectory directory = FSDirectory.open(path);
        IndexReader reader = DirectoryReader.open(directory);
        StoredFields storedFields = reader.storedFields();

        int numDocs = reader.numDocs();
        System.out.println("Found " + numDocs + " documents in index");

        // Create SQLite database
        Connection conn = DriverManager.getConnection("jdbc:sqlite:" + outputDb);
        Statement stmt = conn.createStatement();

        // Create table
        stmt.execute("DROP TABLE IF EXISTS page_text");
        stmt.execute(
            "CREATE TABLE page_text (" +
            "  book_id INTEGER, " +
            "  page_id INTEGER, " +
            "  text TEXT, " +
            "  PRIMARY KEY (book_id, page_id)" +
            ")"
        );
        stmt.execute("CREATE INDEX idx_book ON page_text (book_id)");

        // Prepare insert statement
        PreparedStatement insert = conn.prepareStatement(
            "INSERT OR REPLACE INTO page_text (book_id, page_id, text) VALUES (?, ?, ?)"
        );

        conn.setAutoCommit(false);

        int count = 0;
        int errors = 0;
        long startTime = System.currentTimeMillis();

        for (int i = 0; i < numDocs; i++) {
            try {
                Document doc = storedFields.document(i);

                // Get book and page IDs
                String bookStr = doc.get("book");
                String pageStr = doc.get("page");
                String text = doc.get("text");

                if (bookStr != null && pageStr != null && text != null) {
                    int bookId = Integer.parseInt(bookStr);
                    int pageId = Integer.parseInt(pageStr);

                    insert.setInt(1, bookId);
                    insert.setInt(2, pageId);
                    insert.setString(3, text);
                    insert.executeUpdate();

                    count++;
                }
            } catch (Exception e) {
                errors++;
                if (errors <= 10) {
                    System.err.println("Error processing document " + i + ": " + e.getMessage());
                }
            }

            // Progress update
            if ((i + 1) % 10000 == 0) {
                System.out.printf("Processed %d / %d documents (%d extracted, %d errors)\n",
                    i + 1, numDocs, count, errors);
            }
        }

        // Commit and close
        conn.commit();
        insert.close();
        stmt.close();
        conn.close();
        reader.close();
        directory.close();

        long elapsed = System.currentTimeMillis() - startTime;

        System.out.println();
        System.out.println("Extraction complete!");
        System.out.println("  Total documents: " + numDocs);
        System.out.println("  Extracted pages: " + count);
        System.out.println("  Errors: " + errors);
        System.out.println("  Time: " + (elapsed / 1000.0) + " seconds");
        System.out.println("  Output: " + outputDb);
    }
}
