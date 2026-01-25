import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.sql.*;
import java.util.*;

import org.apache.lucene.document.Document;
import org.apache.lucene.index.DirectoryReader;
import org.apache.lucene.index.IndexReader;
import org.apache.lucene.index.StoredFields;
import org.apache.lucene.index.Term;
import org.apache.lucene.search.IndexSearcher;
import org.apache.lucene.search.PrefixQuery;
import org.apache.lucene.search.ScoreDoc;
import org.apache.lucene.search.TermQuery;
import org.apache.lucene.search.TopDocs;
import org.apache.lucene.store.FSDirectory;

/**
 * Shamela Book Exporter - Java Implementation
 * Exports books from the Shamela library database to HTML files.
 * This replicates the exact functionality of the library's export feature.
 */
public class ShamelaExporter {

    // HTML Template - matching exact format from library
    private static final String HTML_HEADER = """

<!DOCTYPE html><html lang='ar' dir='rtl'><head><meta content='text/html; charset=UTF-8' http-equiv='Content-Type'><style>@media all
{

body
{
direction: rtl;
background-color: #D4D4D4;
line-height: 2;
font: bold 18pt "Traditional Naskh";
text-align: center;
}

hr {clear:both; color: #221122;}
p {margin: 0px;}
.title {color: #800000;}
.footnote, .PageHead {font: bold 16pt "Traditional Naskh"; color: #464646;}
.PageHead {font-style: italic}
.PartName {float:right;}
.PageNumber {float:left;}

.Main {text-align:right; margin: 0 auto; max-width: 780px;}

.PageText
{
text-align: justify;
background-color: #EFEBD6;
margin-top: 20px;
padding: 90px 90px 90px 90px;
border: solid 1px gray;
border-right-width: 4px;
border-bottom-width: 4px;
}

Table
{
background-color: #800000;
width: 90%;
}

TD {background-color: #fefbe7; padding: 0px 10px 0px 10px; vertical-align:middle;}\s
TH {background-color: #e3e1cf; padding: 0px 10px 0px 10px; text-align:center; vertical-align:middle;}
}

@media print
{
.Main {width:650px;}
.PageText

{
page-break-before:always;
border-width:0px;
margin:0px;
padding:1px;
}

}
</style><title>""";

    private static final String HTML_TITLE_END = "</title></head><body><div class='Main'>\n";
    private static final String HTML_FOOTER = "</div></body></html>";

    // Arabic-Indic numerals
    private static final char[] ARABIC_NUMERALS = {'٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'};

    private Path baseDir;
    private Path databaseDir;
    private Path exportDir;
    private IndexSearcher searcher;
    private IndexReader reader;
    private StoredFields storedFields;
    // Book metadata index
    private IndexSearcher bookSearcher;
    private IndexReader bookReader;
    private StoredFields bookStoredFields;

    public ShamelaExporter(Path baseDir) throws Exception {
        this.baseDir = baseDir;
        this.databaseDir = baseDir.resolve("shamela4").resolve("database");
        this.exportDir = baseDir.resolve("export");

        // Load SQLite JDBC driver
        Class.forName("org.sqlite.JDBC");

        // Create export directory
        Files.createDirectories(exportDir);

        // Open page Lucene index
        Path indexPath = databaseDir.resolve("store").resolve("page");
        FSDirectory directory = FSDirectory.open(indexPath);
        reader = DirectoryReader.open(directory);
        searcher = new IndexSearcher(reader);
        storedFields = reader.storedFields();

        // Open book metadata Lucene index
        Path bookIndexPath = databaseDir.resolve("store").resolve("book");
        FSDirectory bookDirectory = FSDirectory.open(bookIndexPath);
        bookReader = DirectoryReader.open(bookDirectory);
        bookSearcher = new IndexSearcher(bookReader);
        bookStoredFields = bookReader.storedFields();
    }

    public void close() throws Exception {
        if (reader != null) {
            reader.close();
        }
        if (bookReader != null) {
            bookReader.close();
        }
    }

    /**
     * Convert Western numerals to Arabic-Indic numerals
     */
    public static String toArabicNumerals(int number) {
        String str = String.valueOf(number);
        StringBuilder result = new StringBuilder();
        for (char c : str.toCharArray()) {
            if (c >= '0' && c <= '9') {
                result.append(ARABIC_NUMERALS[c - '0']);
            } else {
                result.append(c);
            }
        }
        return result.toString();
    }

    /**
     * Get all books from master database
     */
    public List<Map<String, Object>> getAllBooks() throws SQLException {
        List<Map<String, Object>> books = new ArrayList<>();
        Path masterDb = databaseDir.resolve("master.db");

        try (Connection conn = DriverManager.getConnection("jdbc:sqlite:" + masterDb)) {
            Statement stmt = conn.createStatement();
            ResultSet rs = stmt.executeQuery(
                "SELECT book_id, book_name, book_category FROM book ORDER BY book_id"
            );

            while (rs.next()) {
                Map<String, Object> book = new HashMap<>();
                book.put("book_id", rs.getInt("book_id"));
                book.put("book_name", rs.getString("book_name"));
                book.put("book_category", rs.getInt("book_category"));
                books.add(book);
            }
        }

        return books;
    }

    /**
     * Get book info by ID with full metadata
     */
    public Map<String, Object> getBook(int bookId) throws SQLException {
        Path masterDb = databaseDir.resolve("master.db");

        try (Connection conn = DriverManager.getConnection("jdbc:sqlite:" + masterDb)) {
            // Get book info
            PreparedStatement stmt = conn.prepareStatement(
                "SELECT * FROM book WHERE book_id = ?"
            );
            stmt.setInt(1, bookId);
            ResultSet rs = stmt.executeQuery();

            if (rs.next()) {
                Map<String, Object> book = new HashMap<>();
                book.put("book_id", rs.getInt("book_id"));
                book.put("book_name", rs.getString("book_name"));
                book.put("book_category", rs.getInt("book_category"));
                book.put("meta_data", rs.getString("meta_data"));

                int mainAuthorId = rs.getInt("main_author");
                book.put("main_author", mainAuthorId);

                // Get author name
                if (mainAuthorId > 0) {
                    PreparedStatement authorStmt = conn.prepareStatement(
                        "SELECT author_name, death_text FROM author WHERE author_id = ?"
                    );
                    authorStmt.setInt(1, mainAuthorId);
                    ResultSet authorRs = authorStmt.executeQuery();
                    if (authorRs.next()) {
                        book.put("author_name", authorRs.getString("author_name"));
                        book.put("death_text", authorRs.getString("death_text"));
                    }
                }

                // Get category name
                int categoryId = rs.getInt("book_category");
                if (categoryId > 0) {
                    PreparedStatement catStmt = conn.prepareStatement(
                        "SELECT category_name FROM category WHERE category_id = ?"
                    );
                    catStmt.setInt(1, categoryId);
                    ResultSet catRs = catStmt.executeQuery();
                    if (catRs.next()) {
                        book.put("category_name", catRs.getString("category_name"));
                    }
                }

                return book;
            }
        }

        return null;
    }

    /**
     * Get betaka (book metadata) from book Lucene index
     */
    public String getBetaka(int bookId) throws Exception {
        // Search for book in book metadata index
        TermQuery query = new TermQuery(new Term("id", String.valueOf(bookId)));
        TopDocs hits = bookSearcher.search(query, 1);

        if (hits.totalHits.value > 0) {
            Document doc = bookStoredFields.document(hits.scoreDocs[0].doc);
            return doc.get("body_store");
        }

        return null;
    }

    /**
     * Get page structure from book database
     */
    public List<Map<String, Object>> getBookPages(int bookId) throws SQLException {
        List<Map<String, Object>> pages = new ArrayList<>();

        String subdir = String.format("%03d", bookId % 1000);
        Path bookDb = databaseDir.resolve("book").resolve(subdir).resolve(bookId + ".db");

        if (!Files.exists(bookDb)) {
            return pages;
        }

        try (Connection conn = DriverManager.getConnection("jdbc:sqlite:" + bookDb)) {
            Statement stmt = conn.createStatement();
            ResultSet rs = stmt.executeQuery(
                "SELECT id, part, page, number FROM page ORDER BY id"
            );

            while (rs.next()) {
                Map<String, Object> page = new HashMap<>();
                page.put("id", rs.getInt("id"));
                page.put("part", rs.getString("part"));
                page.put("page", rs.getObject("page"));
                page.put("number", rs.getObject("number"));
                pages.add(page);
            }
        }

        return pages;
    }

    /**
     * Get page aliases from book database.
     * Returns a map from this book's page ID to [aliased_book_id, aliased_page_id].
     */
    public Map<Integer, int[]> getBookAliases(int bookId) throws SQLException {
        Map<Integer, int[]> aliases = new HashMap<>();

        String subdir = String.format("%03d", bookId % 1000);
        Path bookDb = databaseDir.resolve("book").resolve(subdir).resolve(bookId + ".db");

        if (!Files.exists(bookDb)) {
            return aliases;
        }

        try (Connection conn = DriverManager.getConnection("jdbc:sqlite:" + bookDb)) {
            Statement stmt = conn.createStatement();
            ResultSet rs = stmt.executeQuery(
                "SELECT this_id, book_id, page_id FROM alias"
            );

            while (rs.next()) {
                int thisId = rs.getInt("this_id");
                int aliasBookId = rs.getInt("book_id");
                int aliasPageId = rs.getInt("page_id");
                aliases.put(thisId, new int[]{aliasBookId, aliasPageId});
            }
        }

        return aliases;
    }

    /**
     * Get page texts from Lucene index for a specific book prefix
     */
    private Map<Integer, String[]> getPageTextsForBook(int bookId) throws Exception {
        Map<Integer, String[]> texts = new HashMap<>();

        String prefix = bookId + "-";
        PrefixQuery query = new PrefixQuery(new Term("id", prefix));
        TopDocs topDocs = searcher.search(query, 100000);

        for (ScoreDoc scoreDoc : topDocs.scoreDocs) {
            Document doc = storedFields.document(scoreDoc.doc);
            String id = doc.get("id");

            if (id != null && id.startsWith(prefix)) {
                try {
                    String pageIdStr = id.substring(prefix.length());
                    int pageId = Integer.parseInt(pageIdStr);
                    String body = doc.get("body");
                    String foot = doc.get("foot");
                    texts.put(pageId, new String[]{body, foot});
                } catch (NumberFormatException e) {
                    // Skip invalid page IDs
                }
            }
        }

        return texts;
    }

    /**
     * Get page texts from Lucene index, including aliased pages
     */
    public Map<Integer, String[]> getPageTexts(int bookId) throws Exception {
        Map<Integer, String[]> texts = new HashMap<>();

        // Get direct page texts for this book
        texts.putAll(getPageTextsForBook(bookId));

        // Get aliases and fetch content from aliased books
        try {
            Map<Integer, int[]> aliases = getBookAliases(bookId);
            if (!aliases.isEmpty()) {
                // Group aliases by source book to minimize Lucene queries
                Map<Integer, List<int[]>> aliasesByBook = new HashMap<>();
                for (Map.Entry<Integer, int[]> entry : aliases.entrySet()) {
                    int thisPageId = entry.getKey();
                    int aliasBookId = entry.getValue()[0];
                    int aliasPageId = entry.getValue()[1];
                    aliasesByBook.computeIfAbsent(aliasBookId, k -> new ArrayList<>())
                        .add(new int[]{thisPageId, aliasPageId});
                }

                // Fetch content from each aliased book
                for (Map.Entry<Integer, List<int[]>> bookEntry : aliasesByBook.entrySet()) {
                    int aliasBookId = bookEntry.getKey();
                    Map<Integer, String[]> aliasTexts = getPageTextsForBook(aliasBookId);

                    // Map aliased content back to this book's page IDs
                    for (int[] mapping : bookEntry.getValue()) {
                        int thisPageId = mapping[0];
                        int aliasPageId = mapping[1];
                        String[] content = aliasTexts.get(aliasPageId);
                        if (content != null) {
                            texts.put(thisPageId, content);
                        }
                    }
                }

                System.out.println("  Loaded " + aliases.size() + " aliased pages from " + aliasesByBook.size() + " book(s)");
            }
        } catch (SQLException e) {
            System.err.println("  Warning: Could not load aliases: " + e.getMessage());
        }

        return texts;
    }

    /**
     * Sanitize filename
     */
    public static String safeName(String name) {
        if (name == null) return "";
        String safe = name.replaceAll("[<>:\"/\\\\|?*]", "");
        safe = safe.replaceAll("\\s+", " ");
        safe = safe.trim();
        if (safe.length() > 200) {
            safe = safe.substring(0, 200);
        }
        return safe;
    }

    /**
     * Reorder Arabic diacritics to match expected Shamela output format:
     * - Regular vowels (fatha/kasra/damma): shadda comes before vowel
     * - Tanween (fathatan/kasratan/dammatan): tanween comes before shadda
     */
    private static String reorderDiacritics(String text) {
        // Swap regular vowels with shadda so shadda comes first:
        // fatha (U+064E), kasra (U+0650), damma (U+064F), sukun (U+0652)
        text = text.replaceAll("([\u064E-\u0650\u0652])(\u0651)", "$2$1");

        // Swap shadda with tanween so tanween comes first:
        // fathatan (U+064B), dammatan (U+064C), kasratan (U+064D)
        text = text.replaceAll("(\u0651)([\u064B-\u064D])", "$2$1");

        return text;
    }

    /**
     * Format text for HTML export - convert to paragraphs and expand special characters
     */
    public static String formatText(String text) {
        if (text == null || text.isEmpty()) return "";

        // Reorder diacritics so shadda comes before vowels (matching expected output)
        text = reorderDiacritics(text);

        // Expand special Islamic Unicode characters
        text = text.replace("\uFDFD", "بسم الله الرحمن الرحيم");  // ﷽ Bismillah
        text = text.replace("\uFDFA", "صلى الله عليه وسلم");      // ﷺ Salawat
        text = text.replace("\uFD40", "رحمه الله");               // ﵀
        text = text.replace("\uFD4F", "رحمهم الله");              // ﵏ (plural)
        text = text.replace("\uFD41", "رضي الله عنه");            // ﵁
        text = text.replace("\uFD44", "رضي الله عنهما");          // ﵄ (dual)
        text = text.replace("\uFD42", "رضي الله عنها");           // ﵂ (feminine)
        text = text.replace("\uFD43", "رضي الله عنهم");           // ﵃ (plural)
        text = text.replace("\uFD49", "عليه السلام");             // ﵉
        text = text.replace("\uFD4A", "عليه الصلاة والسلام");     // ﵊
        text = text.replace("\uFD4D", "عليها السلام");            // ﵍ (feminine)
        // U+FD47 is context-dependent: "عز وجل" for Allah, "عليه السلام" for others
        // Use "عز وجل" only when preceded by Allah-related words
        String diacritics = "[\u064B-\u0652]*";
        String allahWords = "(ا" + diacritics + "ل" + diacritics + "ل" + diacritics + "ه" + diacritics +  // الله (Allah)
            "|ر" + diacritics + "ب" + diacritics +                    // رب (Lord)
            "|ا" + diacritics + "ل" + diacritics + "ر" + diacritics + "ب" + diacritics +  // الرب (the Lord)
            ")";
        text = text.replaceAll(allahWords + "\\s*\uFD47", "$1 عز وجل");
        text = text.replace("\uFD47", "عليه السلام");             // ﵇ (default for prophets/imams)
        text = text.replace("\uFD4E", "تبارك وتعالى");            // ﵎
        text = text.replace("\uFDFB", "جل جلاله");               // ﷻ Jalla Jalaluhu
        text = text.replace("\uFDFE", "سبحانه وتعالى");           // ﷾
        text = text.replace("\uFDFF", "عز وجل");                  // ﷿

        // Remove stray footnote marker character that isn't part of (¬N) pattern
        text = text.replace("¬ ", " ");

        // Replace ornate Quranic brackets with regular braces
        text = text.replace("\uFD3F", "{");  // ﴿ left/opening bracket
        text = text.replace("\uFD3E", "}");  // ﴾ right/closing bracket

        // Convert Arabic-Indic numerals to Western in page content
        StringBuilder result = new StringBuilder();
        for (char c : text.toCharArray()) {
            if (c >= '\u0660' && c <= '\u0669') {
                result.append((char)('0' + (c - '\u0660')));
            } else {
                result.append(c);
            }
        }
        text = result.toString();

        // Replace newlines with </p> paragraph breaks
        text = text.replace("\r\n", "</p>");
        text = text.replace("\n", "</p>");
        text = text.replace("\r", "</p>");

        // Convert empty paragraphs to &nbsp; spacing (matching library output)
        text = text.replace("</p></p>", "</p>&nbsp;</p>");

        // Add ZWNJ before and after title spans (preserving original format from source)
        // Pattern: <span data-type='title' ... > needs &#8204; before it and after the >
        text = text.replaceAll("(<span data-type=['\"]title['\"][^>]*>)", "&#8204;$1&#8204;");
        // Also handle class="title" format if present in source
        text = text.replaceAll("(?<!&#8204;)(<span class=['\"]title['\"]>)", "&#8204;$1&#8204;");

        // Convert FIRST inline footnote separator (underscores) to HR with footnote div
        // Subsequent underscores are kept as visual separators within the footnote section
        // NOTE: Must be done BEFORE footnote marker processing so the div pattern exists
        text = text.replaceFirst("</p>_________</p>", "<hr width='95' align='right'><div class='footnote'>");

        // Convert footnote references with ¬ marker:
        // At start of text (beginning of page content): ^(¬N) → <font color=#be0000>(N)</font>
        text = text.replaceAll("^\\(¬(\\d+)\\)", "<font color=#be0000>($1)</font>");
        // At start of paragraph (footnote section): </p>(¬N) → </p><font color=#be0000>(N)</font>
        text = text.replaceAll("</p> ?\\(¬(\\d+)\\)", "</p><font color=#be0000>($1)</font>");
        // At start of footnote div: <div class='footnote'>(¬N) → ...<font color=#be0000>(N)</font>
        text = text.replaceAll("(<div class='footnote'>) ?\\(¬(\\d+)\\)", "$1<font color=#be0000>($2)</font>");
        // Inline in text: (¬N) → <sup><font color=#be0000>(N)</font></sup>
        text = text.replaceAll(" ?\\(¬(\\d+)\\)", "<sup><font color=#be0000>($1)</font></sup>");

        // Style plain footnote markers (N) without ¬ in footnote section:
        // At start of footnote div: <div class='footnote'>(N) → ...<font color=#be0000>(N)</font>
        text = text.replaceAll("(<div class='footnote'>)\\((\\d+)\\)", "$1<font color=#be0000>($2)</font>");
        // After </p> in footnote section: </p>(N) → </p><font color=#be0000>(N)</font>
        // Only match single/double digit to avoid matching years like (1945)
        text = text.replaceAll("</p>\\((\\d{1,2})\\) ", "</p><font color=#be0000>($1)</font> ");

        // Style ellipsis - Unicode ellipsis and three periods surrounded by spaces
        text = text.replace("…", "<font color=#be0000>…</font>");
        text = text.replace(" ... ", " <font color=#be0000>…</font> ");

        // Convert ASCII comma to Arabic comma in page content
        text = text.replace(",", "،");

        // Style numbered entries: N - → <font color=#be0000>N -</font>
        // Can appear after </p>, at start of text
        // Handle trailing space, sup tag, or ZWNJ (&#8204;)
        text = text.replaceAll("(^|</p>)(\\d+) -(&#8204;|<sup>|\\s)", "$1<font color=#be0000>$2 -</font>$3");

        return text;
    }

    /**
     * Build book metadata page (betaka)
     */
    private String buildBetakaPage(Map<String, Object> bookInfo, String betakaText) {
        StringBuilder html = new StringBuilder();
        html.append("<div class='PageText'>");

        String bookName = (String) bookInfo.get("book_name");
        String authorName = (String) bookInfo.get("author_name");
        String categoryName = (String) bookInfo.get("category_name");

        // Title with author
        html.append("<span class='title'>").append(bookName).append("&nbsp;&nbsp;&nbsp;</span>");
        if (authorName != null) {
            html.append("<span class='footnote'>(").append(authorName).append(")</span>");
        }

        // Category
        if (categoryName != null) {
            html.append("<p><span class='title'>القسم:</span> ").append(categoryName);
        }

        html.append("<hr>");

        // Parse and format betaka text from Lucene
        if (betakaText != null && !betakaText.isEmpty()) {
            // Split on any line separator (\r, \n, or \r\n)
            String[] lines = betakaText.split("\\r\\n|\\r|\\n");
            for (String line : lines) {
                line = line.trim();
                if (line.isEmpty()) continue;

                // Check if line has a label (contains colon)
                int colonIdx = line.indexOf(':');
                if (colonIdx > 0 && colonIdx < 30) {
                    String label = line.substring(0, colonIdx).trim();
                    String value = line.substring(colonIdx + 1).trim();

                    // Format both label and value
                    label = formatBetakaValue(label);
                    value = formatBetakaValue(value);

                    html.append("<p><span class='title'>").append(label)
                        .append("<font color=#be0000>:</font></span> ").append(value);
                } else if (line.startsWith("[") && line.endsWith("]")) {
                    // Bracketed note
                    html.append("<p><font color=#be0000>[</font>")
                        .append(line.substring(1, line.length() - 1))
                        .append("<font color=#be0000>]</font>");
                } else {
                    html.append("<p>").append(line);
                }
            }
        }

        // Add Shamela publish date from meta_data
        String metaData = (String) bookInfo.get("meta_data");
        if (metaData != null && metaData.contains("date")) {
            try {
                // Parse JSON-like format: {"date": "19121446"}
                int dateStart = metaData.indexOf("\"date\"");
                if (dateStart >= 0) {
                    int valueStart = metaData.indexOf("\"", dateStart + 7) + 1;
                    int valueEnd = metaData.indexOf("\"", valueStart);
                    if (valueStart > 0 && valueEnd > valueStart) {
                        String dateStr = metaData.substring(valueStart, valueEnd);
                        // Format: DDMMYYYY -> DD month YYYY
                        String formattedDate = formatShamelaDate(dateStr);
                        if (formattedDate != null) {
                            html.append("<p><span class='title'>تاريخ النشر بالشاملة<font color=#be0000>:</font></span> ")
                                .append(formattedDate);
                        }
                    }
                }
            } catch (Exception e) {
                // Ignore date parsing errors
            }
        }

        html.append("</div>\n");
        return html.toString();
    }

    /**
     * Convert Arabic-Indic numerals to Western numerals
     */
    private String toWesternNumerals(String text) {
        StringBuilder result = new StringBuilder();
        for (char c : text.toCharArray()) {
            if (c >= '٠' && c <= '٩') {
                result.append((char)('0' + (c - '٠')));
            } else {
                result.append(c);
            }
        }
        return result.toString();
    }

    /**
     * Format betaka value with red styling for special characters
     */
    private String formatBetakaValue(String value) {
        // Convert Arabic numerals to Western
        value = toWesternNumerals(value);

        // Style all dashes surrounded by spaces
        value = value.replace(" - ", " <font color=#be0000>-</font> ");

        // Style dashes with space before but digit after (e.g., "هـ -1999")
        value = value.replaceAll(" -(\\d)", " <font color=#be0000>-</font>$1");

        // Style parentheses
        value = value.replace("(", "<font color=#be0000>(</font>");
        value = value.replace(")", "<font color=#be0000>)</font>");

        // Replace Arabic comma in editions
        value = value.replace("،", "<font color=#be0000>،</font>");

        return value;
    }

    /**
     * Format Shamela date from DDMMYYYY to readable format
     */
    private String formatShamelaDate(String dateStr) {
        if (dateStr.length() != 8) return null;

        try {
            int day = Integer.parseInt(dateStr.substring(0, 2));
            int month = Integer.parseInt(dateStr.substring(2, 4));
            int year = Integer.parseInt(dateStr.substring(4, 8));

            String[] hijriMonths = {
                "محرم", "صفر", "ربيع الأول", "ربيع الثاني",
                "جمادى الأولى", "جمادى الآخرة", "رجب", "شعبان",
                "رمضان", "شوال", "ذو القعدة", "ذو الحجة"
            };

            if (month >= 1 && month <= 12) {
                return day + " " + hijriMonths[month - 1] + " " + year;
            }
        } catch (Exception e) {
            // Ignore
        }
        return null;
    }

    /**
     * Export a single book
     */
    public Path exportBook(int bookId) throws Exception {
        Map<String, Object> bookInfo = getBook(bookId);
        if (bookInfo == null) {
            System.err.println("Book " + bookId + " not found in database");
            return null;
        }

        String bookName = (String) bookInfo.get("book_name");
        System.out.println("Exporting: " + bookName + " (ID: " + bookId + ")");

        // Get betaka
        String betaka = getBetaka(bookId);

        // Get page structure
        List<Map<String, Object>> pages = getBookPages(bookId);
        if (pages.isEmpty()) {
            System.err.println("  No pages found in book database");
            return null;
        }

        System.out.println("  Loading " + pages.size() + " pages from index...");

        // Get page texts from Lucene
        Map<Integer, String[]> pageTexts = getPageTexts(bookId);
        System.out.println("  Found " + pageTexts.size() + " pages with content");

        // Validate all pages have content
        List<Integer> missingPages = new ArrayList<>();
        for (Map<String, Object> page : pages) {
            int pageId = (Integer) page.get("id");
            String[] texts = pageTexts.get(pageId);
            boolean hasBody = texts != null && texts[0] != null && !texts[0].isEmpty();
            boolean hasFoot = texts != null && texts[1] != null && !texts[1].isEmpty();
            if (!hasBody && !hasFoot) {
                missingPages.add(pageId);
            }
        }

        if (!missingPages.isEmpty()) {
            // Show first few missing pages for debugging
            String missingInfo = missingPages.size() <= 10
                ? missingPages.toString()
                : missingPages.subList(0, 10) + "... and " + (missingPages.size() - 10) + " more";
            throw new RuntimeException("Book " + bookId + " has " + missingPages.size() +
                " pages with no content available. Missing page IDs: " + missingInfo);
        }

        // Create output directory for this book
        String safeBookName = safeName(bookName);
        Path bookDir = exportDir.resolve(safeBookName);
        Files.createDirectories(bookDir);

        // Group pages by part
        Map<String, List<Map<String, Object>>> parts = new LinkedHashMap<>();
        for (Map<String, Object> page : pages) {
            String partName = (String) page.get("part");
            if (partName == null) partName = "";
            parts.computeIfAbsent(partName, k -> new ArrayList<>()).add(page);
        }

        // Export each part as a separate HTML file
        // Add betaka (book metadata) to ALL parts, not just the first one
        int fileCounter = 1;
        for (Map.Entry<String, List<Map<String, Object>>> entry : parts.entrySet()) {
            String partName = entry.getKey();
            List<Map<String, Object>> partPages = entry.getValue();

            exportPart(bookInfo, bookName, partName, partPages, pageTexts, bookDir, betaka, fileCounter);
            fileCounter++;
        }

        System.out.println("  Exported to: " + bookDir);
        return bookDir;
    }

    /**
     * Export a single part of a book to memory (returns HTML content)
     */
    private String exportPartToMemory(Map<String, Object> bookInfo, String bookName, String partName,
                           List<Map<String, Object>> pages,
                           Map<Integer, String[]> pageTexts,
                           String betaka) {

        // Check if partName is numeric
        boolean isNumeric = partName != null && partName.matches("\\d+");
        int partNumber = isNumeric ? Integer.parseInt(partName) : 0;

        // Build HTML content
        StringBuilder html = new StringBuilder();
        html.append(HTML_HEADER);

        // Format title
        String title = bookName;
        if (partName != null && !partName.isEmpty()) {
            if (isNumeric) {
                title += " - جـ " + toArabicNumerals(partNumber);
            } else {
                title += " - " + partName;
            }
        }
        html.append(title);
        html.append(HTML_TITLE_END);

        // Add betaka page if provided
        if (betaka != null) {
            html.append(buildBetakaPage(bookInfo, betaka));
        }

        // Determine the part name to use in headers
        String headerPartName;
        if (partName == null || partName.isEmpty()) {
            headerPartName = bookName;
        } else if (isNumeric) {
            headerPartName = bookName + " - جـ " + toArabicNumerals(partNumber);
        } else {
            headerPartName = bookName + " - " + partName;
        }

        // Add pages
        for (Map<String, Object> page : pages) {
            int pageId = (Integer) page.get("id");
            Object pageNum = page.get("page");

            String[] texts = pageTexts.get(pageId);
            String body = (texts != null) ? texts[0] : null;
            String foot = (texts != null) ? texts[1] : null;

            html.append("<div class='PageText'>");

            // Page header
            html.append("<div class='PageHead'>");
            html.append("<span class='PartName'>").append(headerPartName).append("</span>");
            if (pageNum != null) {
                String arabicPageNum = toArabicNumerals(((Number) pageNum).intValue());
                html.append("<span class='PageNumber'>(ص: ").append(arabicPageNum).append(")</span>");
            }
            html.append("<hr/></div>");

            // Body content
            boolean hasBody = body != null && !body.isEmpty();
            boolean hasFoot = foot != null && !foot.isEmpty();

            if (hasBody) {
                String formattedBody = formatText(body);
                html.append(formattedBody);

                boolean hasInlineFootnotes = formattedBody.contains("<div class='footnote'>");

                if (hasFoot) {
                    String formattedFoot = formatText(foot);
                    if (formattedFoot.startsWith("<sup><font color=#be0000>(")) {
                        formattedFoot = formattedFoot.replaceFirst(
                            "^<sup>(<font color=#be0000>\\(\\d+\\)</font>)</sup>",
                            "$1");
                    }
                    html.append("<hr width='95' align='right'><div class='footnote'>")
                        .append(formattedFoot).append("</div>");
                } else if (hasInlineFootnotes) {
                    html.append("<p></div>");
                }
            } else if (hasFoot) {
                String formattedFoot = formatText(foot);
                html.append(formattedFoot);
                if (formattedFoot.contains("<div class='footnote'>")) {
                    html.append("<p></div>");
                }
            } else {
                html.append("[No content available]");
            }

            html.append("</div>\n");
        }

        html.append(HTML_FOOTER);

        // Return with CRLF line endings
        return html.toString().replace("\n", "\r\n");
    }

    /**
     * Export a single part of a book
     */
    private void exportPart(Map<String, Object> bookInfo, String bookName, String partName,
                           List<Map<String, Object>> pages,
                           Map<Integer, String[]> pageTexts,
                           Path outputDir, String betaka, int fileCounter) throws IOException {

        // Check if partName is numeric
        boolean isNumeric = partName != null && partName.matches("\\d+");
        int partNumber = isNumeric ? Integer.parseInt(partName) : 0;

        // Create filename: always use sequential numbering (001.htm, 002.htm, etc.)
        String filename = String.format("%03d.htm", fileCounter);

        Path filePath = outputDir.resolve(filename);

        // Build HTML content
        StringBuilder html = new StringBuilder();
        html.append(HTML_HEADER);

        // Format title:
        // - Numeric parts: "bookName - جـ ١"
        // - Named sections: "bookName - المقدمة"
        String title = bookName;
        if (partName != null && !partName.isEmpty()) {
            if (isNumeric) {
                title += " - جـ " + toArabicNumerals(partNumber);
            } else {
                title += " - " + partName;
            }
        }
        html.append(title);
        html.append(HTML_TITLE_END);

        // Add betaka page if this is the first part
        if (betaka != null) {
            html.append(buildBetakaPage(bookInfo, betaka));
        }

        // Determine the part name to use in headers (same as title format)
        String headerPartName;
        if (partName == null || partName.isEmpty()) {
            headerPartName = bookName;
        } else if (isNumeric) {
            headerPartName = bookName + " - جـ " + toArabicNumerals(partNumber);
        } else {
            headerPartName = bookName + " - " + partName;
        }

        // Add pages
        for (Map<String, Object> page : pages) {
            int pageId = (Integer) page.get("id");
            Object pageNum = page.get("page");

            String[] texts = pageTexts.get(pageId);
            String body = (texts != null) ? texts[0] : null;
            String foot = (texts != null) ? texts[1] : null;

            html.append("<div class='PageText'>");

            // Page header
            html.append("<div class='PageHead'>");
            html.append("<span class='PartName'>").append(headerPartName).append("</span>");
            if (pageNum != null) {
                String arabicPageNum = toArabicNumerals(((Number) pageNum).intValue());
                html.append("<span class='PageNumber'>(ص: ").append(arabicPageNum).append(")</span>");
            }
            html.append("<hr/></div>");

            // Body content
            boolean hasBody = body != null && !body.isEmpty();
            boolean hasFoot = foot != null && !foot.isEmpty();

            if (hasBody) {
                // Normal case: body content exists
                String formattedBody = formatText(body);
                html.append(formattedBody);

                // Check if body has inline footnotes (underscore separator converted to footnote div)
                boolean hasInlineFootnotes = formattedBody.contains("<div class='footnote'>");

                if (hasFoot) {
                    // Add footnotes with separator
                    String formattedFoot = formatText(foot);
                    // If foot starts with a footnote marker in <sup>, remove the <sup> wrapper
                    // because it's at the start of the footnote section, not inline
                    if (formattedFoot.startsWith("<sup><font color=#be0000>(")) {
                        formattedFoot = formattedFoot.replaceFirst(
                            "^<sup>(<font color=#be0000>\\(\\d+\\)</font>)</sup>",
                            "$1");
                    }
                    html.append("<hr width='95' align='right'><div class='footnote'>")
                        .append(formattedFoot).append("</div>");
                } else if (hasInlineFootnotes) {
                    // Close the inline footnote div
                    html.append("<p></div>");
                }
            } else if (hasFoot) {
                // No body, only foot - treat foot as body content (no footnote div)
                String formattedFoot = formatText(foot);
                html.append(formattedFoot);
                // If foot has inline footnotes (underscore separator), close the footnote div
                if (formattedFoot.contains("<div class='footnote'>")) {
                    html.append("<p></div>");
                }
            } else {
                // No content at all
                html.append("[No content available]");
            }

            html.append("</div>\n");
        }

        html.append(HTML_FOOTER);

        // Write file with CRLF line endings (to match library output)
        String content = html.toString().replace("\n", "\r\n");
        Files.writeString(filePath, content, StandardCharsets.UTF_8);
    }

    /**
     * Export a single book to memory (returns Map of filename -> content)
     */
    public Map<String, String> exportBookToMemory(int bookId) throws Exception {
        Map<String, Object> bookInfo = getBook(bookId);
        if (bookInfo == null) {
            throw new RuntimeException("Book " + bookId + " not found in database");
        }

        String bookName = (String) bookInfo.get("book_name");
        System.err.println("Exporting: " + bookName + " (ID: " + bookId + ")");

        // Get betaka
        String betaka = getBetaka(bookId);

        // Get page structure
        List<Map<String, Object>> pages = getBookPages(bookId);
        if (pages.isEmpty()) {
            throw new RuntimeException("No pages found in book database for book " + bookId);
        }

        System.err.println("  Loading " + pages.size() + " pages from index...");

        // Get page texts from Lucene
        Map<Integer, String[]> pageTexts = getPageTexts(bookId);
        System.err.println("  Found " + pageTexts.size() + " pages with content");

        // Validate all pages have content
        List<Integer> missingPages = new ArrayList<>();
        for (Map<String, Object> page : pages) {
            int pageId = (Integer) page.get("id");
            String[] texts = pageTexts.get(pageId);
            boolean hasBody = texts != null && texts[0] != null && !texts[0].isEmpty();
            boolean hasFoot = texts != null && texts[1] != null && !texts[1].isEmpty();
            if (!hasBody && !hasFoot) {
                missingPages.add(pageId);
            }
        }

        if (!missingPages.isEmpty()) {
            String missingInfo = missingPages.size() <= 10
                ? missingPages.toString()
                : missingPages.subList(0, 10) + "... and " + (missingPages.size() - 10) + " more";
            throw new RuntimeException("Book " + bookId + " has " + missingPages.size() +
                " pages with no content available. Missing page IDs: " + missingInfo);
        }

        // Group pages by part
        Map<String, List<Map<String, Object>>> parts = new LinkedHashMap<>();
        for (Map<String, Object> page : pages) {
            String partName = (String) page.get("part");
            if (partName == null) partName = "";
            parts.computeIfAbsent(partName, k -> new ArrayList<>()).add(page);
        }

        // Export each part to memory
        Map<String, String> result = new LinkedHashMap<>();
        int fileCounter = 1;
        for (Map.Entry<String, List<Map<String, Object>>> entry : parts.entrySet()) {
            String partName = entry.getKey();
            List<Map<String, Object>> partPages = entry.getValue();

            String filename = String.format("%03d.htm", fileCounter);
            String content = exportPartToMemory(bookInfo, bookName, partName, partPages, pageTexts, betaka);
            result.put(filename, content);
            fileCounter++;
        }

        System.err.println("  Exported " + result.size() + " files to memory");
        return result;
    }

    /**
     * Export a book and output as JSON to stdout (for Python integration)
     */
    public void exportBookToStdout(int bookId) throws Exception {
        Map<String, String> files = exportBookToMemory(bookId);

        // Output as JSON
        StringBuilder json = new StringBuilder();
        json.append("{\n");
        json.append("  \"book_id\": ").append(bookId).append(",\n");
        json.append("  \"files\": {\n");

        int count = 0;
        int total = files.size();
        for (Map.Entry<String, String> entry : files.entrySet()) {
            String filename = entry.getKey();
            String content = entry.getValue();

            json.append("    \"").append(escapeJson(filename)).append("\": \"");
            json.append(escapeJson(content)).append("\"");

            if (++count < total) {
                json.append(",");
            }
            json.append("\n");
        }

        json.append("  }\n");
        json.append("}\n");

        // Output to stdout
        System.out.print(json.toString());
    }

    /**
     * Escape string for JSON
     */
    private static String escapeJson(String s) {
        if (s == null) return "";
        StringBuilder result = new StringBuilder();
        for (char c : s.toCharArray()) {
            switch (c) {
                case '"': result.append("\\\""); break;
                case '\\': result.append("\\\\"); break;
                case '\b': result.append("\\b"); break;
                case '\f': result.append("\\f"); break;
                case '\n': result.append("\\n"); break;
                case '\r': result.append("\\r"); break;
                case '\t': result.append("\\t"); break;
                default:
                    if (c < ' ') {
                        result.append(String.format("\\u%04x", (int) c));
                    } else {
                        result.append(c);
                    }
            }
        }
        return result.toString();
    }

    /**
     * List all books
     */
    public void listBooks() throws SQLException {
        List<Map<String, Object>> books = getAllBooks();
        System.out.println("\nAvailable books (" + books.size() + " total):\n");
        System.out.printf("%6s  %s%n", "ID", "Name");
        System.out.println("-".repeat(60));

        for (Map<String, Object> book : books) {
            System.out.printf("%6d  %s%n",
                book.get("book_id"),
                book.get("book_name"));
        }
    }

    /**
     * Export multiple books
     */
    public void exportBooks(List<Integer> bookIds) throws Exception {
        int total = bookIds.size();
        int success = 0;
        List<String> errors = new ArrayList<>();

        for (int i = 0; i < bookIds.size(); i++) {
            int bookId = bookIds.get(i);
            System.out.printf("[%d/%d] ", i + 1, total);

            try {
                Path result = exportBook(bookId);
                if (result != null) {
                    success++;
                } else {
                    errors.add("Book " + bookId + ": Export returned null (book not found or no pages)");
                }
            } catch (Exception e) {
                String errorMsg = "Book " + bookId + ": " + e.getMessage();
                System.err.println("  Error: " + e.getMessage());
                errors.add(errorMsg);
            }
        }

        System.out.println("\nExport complete! " + success + "/" + total + " books exported.");
        System.out.println("Output directory: " + exportDir);

        // Fail if any books failed to export
        if (!errors.isEmpty()) {
            throw new RuntimeException("Export failed for " + errors.size() + " book(s):\n" +
                String.join("\n", errors));
        }
    }

    public static void main(String[] args) {
        if (args.length == 0) {
            System.out.println("Usage:");
            System.out.println("  ShamelaExporter --list              # List all books");
            System.out.println("  ShamelaExporter <id> [id...]        # Export specific books to files");
            System.out.println("  ShamelaExporter --stdout <id>       # Export single book as JSON to stdout");
            System.out.println("  ShamelaExporter --all               # Export all books to files");
            System.exit(1);
        }

        try {
            Path baseDir = Paths.get(".").toAbsolutePath().normalize();
            ShamelaExporter exporter = new ShamelaExporter(baseDir);

            try {
                if (args[0].equals("--list") || args[0].equals("-l")) {
                    exporter.listBooks();
                } else if (args[0].equals("--stdout") || args[0].equals("-s")) {
                    // Export single book to stdout as JSON (for Python integration)
                    if (args.length < 2) {
                        System.err.println("Error: --stdout requires a book ID");
                        System.exit(1);
                    }
                    int bookId = Integer.parseInt(args[1]);
                    exporter.exportBookToStdout(bookId);
                } else if (args[0].equals("--all") || args[0].equals("-a")) {
                    List<Map<String, Object>> books = exporter.getAllBooks();
                    List<Integer> bookIds = new ArrayList<>();
                    for (Map<String, Object> book : books) {
                        bookIds.add((Integer) book.get("book_id"));
                    }
                    System.out.println("\nExporting " + bookIds.size() + " books...\n");
                    exporter.exportBooks(bookIds);
                } else {
                    List<Integer> bookIds = new ArrayList<>();
                    for (String arg : args) {
                        try {
                            bookIds.add(Integer.parseInt(arg));
                        } catch (NumberFormatException e) {
                            System.err.println("Invalid book ID: " + arg);
                        }
                    }

                    if (!bookIds.isEmpty()) {
                        System.out.println("\nExporting " + bookIds.size() + " book(s)...\n");
                        exporter.exportBooks(bookIds);
                    }
                }
            } finally {
                exporter.close();
            }

        } catch (Exception e) {
            System.err.println("Error: " + e.getMessage());
            e.printStackTrace();
            System.exit(1);
        }
    }
}
