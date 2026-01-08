-- =====================================================
-- Enable UUID generation
-- =====================================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================
-- Drop tables (dependency-safe order)
-- =====================================================
DROP TABLE IF EXISTS book;
DROP TABLE IF EXISTS knowledge_category;
DROP TABLE IF EXISTS category;
DROP TABLE IF EXISTS knowledge;
DROP TABLE IF EXISTS author;

-- =====================================================
-- Author
-- =====================================================
CREATE TABLE author (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL
);

-- =====================================================
-- Knowledge
-- =====================================================
CREATE TABLE knowledge (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL
);

-- =====================================================
-- Category
-- =====================================================
CREATE TABLE category (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE
);

-- =====================================================
-- Knowledge ↔ Category
-- Allowed categories per knowledge
-- =====================================================
CREATE TABLE knowledge_category (
    knowledge_id UUID NOT NULL,
    category_id UUID NOT NULL,

    PRIMARY KEY (knowledge_id, category_id),

    CONSTRAINT fk_kc_knowledge
        FOREIGN KEY (knowledge_id)
        REFERENCES knowledge(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_kc_category
        FOREIGN KEY (category_id)
        REFERENCES category(id)
        ON DELETE CASCADE
);

-- =====================================================
-- Book
-- Exactly one category per book
-- Category must be allowed for its knowledge
-- =====================================================
CREATE TABLE book (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    book_name TEXT NOT NULL,
    knowledge_id UUID NOT NULL,
    category_id UUID NOT NULL,
    author_id UUID NOT NULL,
    exported BOOLEAN NOT NULL DEFAULT FALSE,

    CONSTRAINT fk_book_author
        FOREIGN KEY (author_id)
        REFERENCES author(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_book_allowed_category
        FOREIGN KEY (knowledge_id, category_id)
        REFERENCES knowledge_category (knowledge_id, category_id)
        ON DELETE RESTRICT
);

-- =====================================================
-- Indexes
-- =====================================================
CREATE INDEX idx_kc_knowledge_id
    ON knowledge_category (knowledge_id);

CREATE INDEX idx_kc_category_id
    ON knowledge_category (category_id);

CREATE INDEX idx_book_author_id
    ON book (author_id);

CREATE INDEX idx_book_knowledge_category
    ON book (knowledge_id, category_id);
