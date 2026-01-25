#!/bin/bash
#
# Shamela Book Exporter
# Exports books from the Shamela library to HTML files.
#
# Usage:
#   ./export_books.sh --list          # List all available books
#   ./export_books.sh 1 2 3           # Export books with IDs 1, 2, 3
#   ./export_books.sh --all           # Export all books
#

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LUCENE_DIR="$SCRIPT_DIR/shamela4/app/lucene/1"
CLASS_FILE="$SCRIPT_DIR/ShamelaExporter.class"
JAVA_FILE="$SCRIPT_DIR/ShamelaExporter.java"

# Build classpath from all JARs in lucene directory
CLASSPATH="$SCRIPT_DIR"
for jar in "$LUCENE_DIR"/*.jar; do
    CLASSPATH="$CLASSPATH:$jar"
done

# Check if SQLite JDBC is available, if not download it
SQLITE_JAR="$SCRIPT_DIR/sqlite-jdbc.jar"
if [ ! -f "$SQLITE_JAR" ]; then
    echo "Downloading SQLite JDBC driver..."
    curl -sL "https://github.com/xerial/sqlite-jdbc/releases/download/3.44.1.0/sqlite-jdbc-3.44.1.0.jar" -o "$SQLITE_JAR"
fi
CLASSPATH="$CLASSPATH:$SQLITE_JAR"

# SLF4J is required by SQLite JDBC
SLF4J_API="$SCRIPT_DIR/slf4j-api.jar"
SLF4J_SIMPLE="$SCRIPT_DIR/slf4j-simple.jar"
if [ ! -f "$SLF4J_API" ]; then
    echo "Downloading SLF4J..."
    curl -sL "https://repo1.maven.org/maven2/org/slf4j/slf4j-api/2.0.9/slf4j-api-2.0.9.jar" -o "$SLF4J_API"
    curl -sL "https://repo1.maven.org/maven2/org/slf4j/slf4j-simple/2.0.9/slf4j-simple-2.0.9.jar" -o "$SLF4J_SIMPLE"
fi
CLASSPATH="$CLASSPATH:$SLF4J_API:$SLF4J_SIMPLE"

# Compile if needed
if [ ! -f "$CLASS_FILE" ] || [ "$JAVA_FILE" -nt "$CLASS_FILE" ]; then
    echo "Compiling ShamelaExporter.java..."
    javac -cp "$CLASSPATH" "$JAVA_FILE"
    if [ $? -ne 0 ]; then
        echo "Compilation failed!"
        exit 1
    fi
fi

# Run the exporter
cd "$SCRIPT_DIR"
java -cp "$CLASSPATH" ShamelaExporter "$@"
