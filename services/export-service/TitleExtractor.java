/**
 * Lucene Title Extractor for Shamela Library
 *
 * This tool extracts title/TOC text content from the Lucene title index
 * and saves it to a SQLite database that can be read by the Python export script.
 *
 * Compile:
 *   javac -cp "lib/*" TitleExtractor.java
 *
 * Run:
 *   java -cp ".:lib/*" TitleExtractor
 */

import java.io.*;
import java.nio.file.*;
import java.sql.*;

import org.apache.lucene.document.Document;
import org.apache.lucene.index.DirectoryReader;
import org.apache.lucene.index.IndexReader;
import org.apache.lucene.index.StoredFields;
import org.apache.lucene.store.FSDirectory;

public class TitleExtractor {

    public static void main(String[] args) throws Exception {
        // Load SQLite JDBC driver
        Class.forName("org.sqlite.JDBC");

        String indexPath = "shamela4/database/store/title";
        String outputDb = "extracted_titles.db";

        if (args.length >= 1) {
            indexPath = args[0];
        }
        if (args.length >= 2) {
            outputDb = args[1];
        }

        System.out.println("Lucene Title Extractor for Shamela Library");
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

        // First, inspect the first few documents to see available fields
        System.out.println("\nInspecting first document fields:");
        if (numDocs > 0) {
            Document doc = storedFields.document(0);
            for (var field : doc.getFields()) {
                System.out.println("  Field: " + field.name() + " = " + field.stringValue());
            }
        }
        System.out.println();

        // Create SQLite database
        Connection conn = DriverManager.getConnection("jdbc:sqlite:" + outputDb);
        Statement stmt = conn.createStatement();

        // Create table - we'll store book_id, title_id, and title text
        stmt.execute("DROP TABLE IF EXISTS title_text");
        stmt.execute(
            "CREATE TABLE title_text (" +
            "  book_id INTEGER, " +
            "  title_id INTEGER, " +
            "  title TEXT, " +
            "  PRIMARY KEY (book_id, title_id)" +
            ")"
        );
        stmt.execute("CREATE INDEX idx_book ON title_text (book_id)");

        // Prepare insert statement
        PreparedStatement insert = conn.prepareStatement(
            "INSERT OR REPLACE INTO title_text (book_id, title_id, title) VALUES (?, ?, ?)"
        );

        conn.setAutoCommit(false);

        int count = 0;
        int errors = 0;
        long startTime = System.currentTimeMillis();

        for (int i = 0; i < numDocs; i++) {
            try {
                Document doc = storedFields.document(i);

                // Get the ID field which contains "book_id-title_id"
                String id = doc.get("id");
                // Title text is stored in the "body" field
                String text = doc.get("body");

                if (id != null && text != null && id.contains("-")) {
                    String[] parts = id.split("-", 2);
                    int bookId = Integer.parseInt(parts[0]);
                    int titleId = Integer.parseInt(parts[1]);

                    insert.setInt(1, bookId);
                    insert.setInt(2, titleId);
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
            if ((i + 1) % 50000 == 0) {
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
        System.out.println("  Extracted titles: " + count);
        System.out.println("  Errors: " + errors);
        System.out.println("  Time: " + (elapsed / 1000.0) + " seconds");
        System.out.println("  Output: " + outputDb);
    }
}
