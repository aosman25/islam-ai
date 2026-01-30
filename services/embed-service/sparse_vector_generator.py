"""
Arabic BM25S Production Implementation
======================================
High-performance BM25 sparse vector generator for Arabic text.

Requirements:
    pip install bm25s numpy scipy

Usage:
    from arabic_bm25_production import ArabicBM25S
    
    bm25 = ArabicBM25S()
    bm25.fit(corpus)
    results = bm25.search("ما هو الذكاء الاصطناعي", top_k=10)
    vectors = bm25.encode(documents)

Version: 1.0.0
License: MIT
"""

from __future__ import annotations

import json
import math
import re
from collections import Counter
from dataclasses import dataclass, field
from typing import List, Dict, Optional, Tuple, Union, Any
from pathlib import Path

try:
    import bm25s
    BM25S_AVAILABLE = True
except ImportError:
    BM25S_AVAILABLE = False


# =============================================================================
# ARABIC STOPWORDS
# =============================================================================

ARABIC_STOPWORDS = frozenset({
    'من', 'في', 'على', 'إلى', 'الى', 'عن', 'مع', 'حتى', 'لدى', 'منذ', 'خلال',
    'بين', 'فوق', 'تحت', 'أمام', 'امام', 'خلف', 'حول', 'ضد', 'عند', 'قبل', 'بعد',
    'دون', 'ضمن', 'نحو', 'لدي', 'عبر', 'رغم', 'مقابل', 'وسط', 'تجاه',
    'هو', 'هي', 'هم', 'هن', 'أنا', 'انا', 'نحن', 'أنت', 'انت', 'أنتم', 'انتم',
    'أنتن', 'انتن', 'أنتما', 'انتما', 'هما', 'هذا', 'هذه', 'هؤلاء', 'ذلك', 'تلك',
    'أولئك', 'اولئك', 'الذي', 'التي', 'الذين', 'اللواتي', 'اللتان', 'اللذان',
    'ما', 'ماذا', 'أي', 'اي', 'أية', 'اية',
    'و', 'أو', 'او', 'ثم', 'ف', 'لكن', 'بل', 'لا', 'إن', 'ان', 'أن', 'إذا', 'اذا',
    'لو', 'كي', 'حيث', 'بينما', 'عندما', 'كلما', 'إذ', 'اذ', 'لأن', 'لان', 'حين',
    'حينما', 'كأن', 'كان', 'لكي', 'مما', 'إما', 'اما', 'سواء',
    'كان', 'كانت', 'كانوا', 'يكون', 'تكون', 'يكونون', 'ليس', 'ليست', 'ليسوا',
    'أصبح', 'اصبح', 'صار', 'بات', 'ظل', 'مازال', 'لازال', 'أضحى', 'اضحى',
    'يكن', 'تكن', 'كنت', 'كنا', 'كانا',
    'أين', 'اين', 'متى', 'كيف', 'لماذا', 'هل', 'كم', 'أيان', 'ايان',
    'قد', 'لقد', 'سوف', 'سـ', 'ل', 'لن', 'لم', 'قط', 'أبدا', 'ابدا', 'دائما',
    'فقط', 'كل', 'بعض', 'كثير', 'قليل', 'أكثر', 'اكثر', 'أقل', 'اقل', 'جدا',
    'أيضا', 'ايضا', 'هنا', 'هناك', 'هنالك', 'الآن', 'الان', 'اليوم', 'أمس', 'امس',
    'غدا', 'نعم', 'ربما', 'يجب', 'يمكن', 'إذن', 'اذن', 'لذا', 'لذلك', 'هكذا',
    'كذلك', 'نفس', 'ذات', 'غير', 'سوى', 'إلا', 'الا', 'عدا', 'خاصة', 'عامة',
    'معظم', 'جميع', 'كلا', 'كلتا', 'آخر', 'اخر', 'أخرى', 'اخرى',
    'ال', 'الـ',
    'به', 'بها', 'بهم', 'بهن', 'له', 'لها', 'لهم', 'لهن', 'لك', 'لكم',
    'عنه', 'عنها', 'عنهم', 'عنهن', 'منه', 'منها', 'منهم', 'منهن',
    'فيه', 'فيها', 'فيهم', 'فيهن', 'إليه', 'اليه', 'إليها', 'اليها',
    'عليه', 'عليها', 'عليهم', 'عليهن', 'معه', 'معها', 'معهم', 'معهن',
    'لنا', 'لي', 'بنا', 'بي', 'منا', 'مني', 'فينا', 'عنا', 'علينا',
    'يقول', 'قال', 'قالت', 'قالوا', 'يعني', 'تعني', 'يوجد', 'توجد',
})


# =============================================================================
# ARABIC TEXT NORMALIZER
# =============================================================================

class ArabicNormalizer:
    DIACRITICS_PATTERN = re.compile(r'[\u0617-\u061A\u064B-\u0652\u0670]')
    CHAR_MAP = str.maketrans({
        '\u0622': '\u0627', '\u0623': '\u0627', '\u0625': '\u0627', '\u0671': '\u0627',
        '\u0624': '\u0648', '\u0626': '\u064A',
        '\u0629': '\u0647', '\u0649': '\u064A', '\u0640': '',
    })
    
    @classmethod
    def normalize(cls, text: str) -> str:
        if not text:
            return ""
        text = cls.DIACRITICS_PATTERN.sub('', text)
        text = text.translate(cls.CHAR_MAP)
        return ' '.join(text.split())


# =============================================================================
# ARABIC LIGHT STEMMER
# =============================================================================

class ArabicLightStemmer:
    PREFIXES = [
        'وبال', 'وكال', 'فبال', 'فكال', 'ولل', 'فلل',
        'وال', 'بال', 'كال', 'فال', 'لال', 'ولل',
        'ال', 'لل', 'وب', 'وك', 'ول', 'وف', 'فب', 'فك', 'فل', 'بب', 'كك',
        'وا', 'فا', 'با', 'كا', 'لا', 'وي', 'في', 'بي', 'كي', 'لي',
        'وت', 'فت', 'بت', 'كت', 'لت', 'ون', 'فن', 'بن', 'كن', 'لن',
        'وس', 'فس', 'بس', 'سي', 'ست', 'سن', 'سا',
    ]
    SUFFIXES = [
        'تهما', 'تكما', 'تنا', 'كموه', 'كموا',
        'ات', 'ان', 'ون', 'ين', 'تن', 'تم', 'نا', 'ها', 'هم', 'هن',
        'كم', 'كن', 'وا', 'ية', 'تا', 'نى', 'ني', 'ته', 'تك',
        'ة', 'ه', 'ي', 'ك', 'ت', 'ا', 'ن', 'و',
    ]
    
    def __init__(self, min_stem_length: int = 3):
        self.min_stem_length = min_stem_length
        self.prefixes = sorted(self.PREFIXES, key=len, reverse=True)
        self.suffixes = sorted(self.SUFFIXES, key=len, reverse=True)
    
    def stem(self, word: str) -> str:
        if not word or len(word) < self.min_stem_length:
            return word
        original = word
        for prefix in self.prefixes:
            if word.startswith(prefix) and len(word) - len(prefix) >= self.min_stem_length:
                word = word[len(prefix):]
                break
        for suffix in self.suffixes:
            if word.endswith(suffix) and len(word) - len(suffix) >= self.min_stem_length:
                word = word[:-len(suffix)]
                break
        if len(word) > 1 and word.startswith('و') and word[1] == 'و':
            word = word[1:]
        return word if len(word) >= self.min_stem_length else original


# =============================================================================
# SPARSE VECTOR
# =============================================================================

@dataclass
class SparseVector:
    indices: List[int]
    values: List[float]
    
    def to_dict(self) -> Dict[str, List]:
        return {"indices": self.indices, "values": self.values}
    
    def to_milvus(self) -> Dict[int, float]:
        return dict(zip(self.indices, self.values))
    
    def to_qdrant(self) -> Dict[str, Any]:
        return {"indices": self.indices, "values": self.values}
    
    def to_weaviate(self) -> List[Dict]:
        return [{"index": i, "value": v} for i, v in zip(self.indices, self.values)]
    
    def to_numpy(self, vocab_size: int) -> np.ndarray:
        arr = np.zeros(vocab_size, dtype=np.float32)
        for i, v in zip(self.indices, self.values):
            if i < vocab_size:
                arr[i] = v
        return arr
    
    @property
    def dim(self) -> int:
        return len(self.indices)


# =============================================================================
# CONFIGURATION
# =============================================================================

@dataclass
class ArabicBM25Config:
    k1: float = 1.5
    b: float = 0.75
    delta: float = 0.5
    method: str = "lucene"
    normalize: bool = True
    remove_diacritics: bool = True
    apply_stemming: bool = True
    min_stem_length: int = 3
    remove_stopwords: bool = True
    min_token_length: int = 2
    custom_stopwords: set = field(default_factory=set)
    
    def to_dict(self) -> Dict:
        return {
            'k1': self.k1, 'b': self.b, 'delta': self.delta, 'method': self.method,
            'normalize': self.normalize, 'remove_diacritics': self.remove_diacritics,
            'apply_stemming': self.apply_stemming, 'min_stem_length': self.min_stem_length,
            'remove_stopwords': self.remove_stopwords, 'min_token_length': self.min_token_length,
        }
    
    @classmethod
    def from_dict(cls, d: Dict) -> 'ArabicBM25Config':
        return cls(**{k: v for k, v in d.items() if k != 'custom_stopwords'})


# =============================================================================
# MAIN CLASS
# =============================================================================

class ArabicBM25S:
    def __init__(self, config: Optional[ArabicBM25Config] = None):
        self.config = config or ArabicBM25Config()
        self.stemmer = ArabicLightStemmer(self.config.min_stem_length) if self.config.apply_stemming else None
        self.stopwords = ARABIC_STOPWORDS | self.config.custom_stopwords
        self._model = None
        self._corpus_tokens: Optional[List[List[str]]] = None
        self._vocab: Dict[str, int] = {}
        self._idf: Dict[str, float] = {}
        self._doc_count: int = 0
        self._avg_doc_length: float = 0.0
        self._fitted: bool = False
    
    def tokenize(self, text: str) -> List[str]:
        if not text:
            return []
        if self.config.normalize:
            text = ArabicNormalizer.normalize(text)
        tokens = text.split()
        tokens = [re.sub(r'[^\u0600-\u06FF\u0750-\u077F]', '', t) for t in tokens]
        tokens = [t for t in tokens if len(t) >= self.config.min_token_length]
        if self.stemmer:
            tokens = [self.stemmer.stem(t) for t in tokens]
        if self.config.remove_stopwords:
            tokens = [t for t in tokens if t not in self.stopwords]
        return tokens
    
    def fit(self, corpus: List[str]) -> 'ArabicBM25S':
        if not corpus:
            raise ValueError("Corpus cannot be empty")
        self._corpus_tokens = [self.tokenize(doc) for doc in corpus]
        self._doc_count = len(self._corpus_tokens)
        total_tokens = sum(len(doc) for doc in self._corpus_tokens)
        self._avg_doc_length = total_tokens / max(self._doc_count, 1)
        doc_frequencies: Dict[str, int] = Counter()
        for tokens in self._corpus_tokens:
            for token in set(tokens):
                doc_frequencies[token] += 1
        self._vocab = {token: idx for idx, token in enumerate(sorted(doc_frequencies.keys()))}
        self._idf = {token: math.log((self._doc_count - df + 0.5) / (df + 0.5) + 1) 
                     for token, df in doc_frequencies.items()}
        if BM25S_AVAILABLE:
            self._model = bm25s.BM25(method=self.config.method)
            self._model.index(self._corpus_tokens)
        self._fitted = True
        return self
    
    def search(self, query: str, top_k: int = 10, return_scores: bool = True) -> Union[List[int], List[Tuple[int, float]]]:
        self._check_fitted()
        query_tokens = self.tokenize(query)
        if not query_tokens:
            return []
        if BM25S_AVAILABLE and self._model is not None:
            results, scores = self._model.retrieve([query_tokens], k=min(top_k, self._doc_count))
            if return_scores:
                return list(zip(results[0].tolist(), scores[0].tolist()))
            return results[0].tolist()
        return self._search_python(query_tokens, top_k, return_scores)
    
    def _search_python(self, query_tokens: List[str], top_k: int, return_scores: bool) -> Union[List[int], List[Tuple[int, float]]]:
        scores = []
        for doc_idx, doc_tokens in enumerate(self._corpus_tokens):
            score = self._compute_bm25_score(query_tokens, doc_tokens)
            scores.append((doc_idx, score))
        scores.sort(key=lambda x: x[1], reverse=True)
        results = scores[:top_k]
        return results if return_scores else [idx for idx, _ in results]
    
    def _compute_bm25_score(self, query_tokens: List[str], doc_tokens: List[str]) -> float:
        doc_length = len(doc_tokens)
        if doc_length == 0:
            return 0.0
        tf_counts = Counter(doc_tokens)
        score = 0.0
        k1, b = self.config.k1, self.config.b
        for token in query_tokens:
            if token not in self._idf:
                continue
            tf = tf_counts.get(token, 0)
            if tf == 0:
                continue
            idf = self._idf[token]
            norm_tf = (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * doc_length / self._avg_doc_length))
            score += idf * norm_tf
        return score
    
    def encode(self, texts: Union[str, List[str]], is_query: bool = False) -> Union[SparseVector, List[SparseVector]]:
        self._check_fitted()
        single_input = isinstance(texts, str)
        if single_input:
            texts = [texts]
        vectors = [self._encode_query(t) if is_query else self._encode_document(t) for t in texts]
        return vectors[0] if single_input else vectors
    
    def encode_documents(self, texts: List[str]) -> List[SparseVector]:
        return self.encode(texts, is_query=False)
    
    def encode_queries(self, texts: List[str]) -> List[SparseVector]:
        return self.encode(texts, is_query=True)
    
    def _encode_document(self, text: str) -> SparseVector:
        tokens = self.tokenize(text)
        doc_length = len(tokens)
        if doc_length == 0:
            return SparseVector(indices=[], values=[])
        tf_counts = Counter(tokens)
        k1, b = self.config.k1, self.config.b
        indices, values = [], []
        for token, tf in tf_counts.items():
            if token not in self._vocab or token not in self._idf:
                continue
            idx = self._vocab[token]
            idf = self._idf[token]
            norm_tf = (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * doc_length / self._avg_doc_length))
            score = idf * norm_tf
            if score > 0:
                indices.append(idx)
                values.append(float(score))
        if indices:
            sorted_pairs = sorted(zip(indices, values))
            indices, values = zip(*sorted_pairs)
            return SparseVector(indices=list(indices), values=list(values))
        return SparseVector(indices=[], values=[])
    
    def _encode_query(self, text: str) -> SparseVector:
        tokens = self.tokenize(text)
        if not tokens:
            return SparseVector(indices=[], values=[])
        tf_counts = Counter(tokens)
        indices, values = [], []
        for token, tf in tf_counts.items():
            if token not in self._vocab or token not in self._idf:
                continue
            idx = self._vocab[token]
            weight = tf * self._idf[token]
            if weight > 0:
                indices.append(idx)
                values.append(float(weight))
        if indices:
            sorted_pairs = sorted(zip(indices, values))
            indices, values = zip(*sorted_pairs)
            return SparseVector(indices=list(indices), values=list(values))
        return SparseVector(indices=[], values=[])
    
    def save(self, path: Union[str, Path]) -> None:
        self._check_fitted()
        path = Path(path)
        path.mkdir(parents=True, exist_ok=True)
        metadata = {
            'config': self.config.to_dict(),
            'vocab': self._vocab,
            'idf': self._idf,
            'doc_count': self._doc_count,
            'avg_doc_length': self._avg_doc_length,
        }
        with open(path / 'metadata.json', 'w', encoding='utf-8') as f:
            json.dump(metadata, f, ensure_ascii=False, indent=2)
        if BM25S_AVAILABLE and self._model is not None:
            self._model.save(str(path / 'bm25s_index'))
        with open(path / 'corpus_tokens.json', 'w', encoding='utf-8') as f:
            json.dump(self._corpus_tokens, f, ensure_ascii=False)
    
    @classmethod
    def load(cls, path: Union[str, Path]) -> 'ArabicBM25S':
        path = Path(path)
        with open(path / 'metadata.json', 'r', encoding='utf-8') as f:
            metadata = json.load(f)
        config = ArabicBM25Config.from_dict(metadata['config'])
        instance = cls(config)
        instance._vocab = metadata['vocab']
        instance._idf = metadata['idf']
        instance._doc_count = metadata['doc_count']
        instance._avg_doc_length = metadata['avg_doc_length']
        with open(path / 'corpus_tokens.json', 'r', encoding='utf-8') as f:
            instance._corpus_tokens = json.load(f)
        bm25s_path = path / 'bm25s_index'
        if BM25S_AVAILABLE and bm25s_path.exists():
            instance._model = bm25s.BM25.load(str(bm25s_path))
        instance._fitted = True
        return instance
    
    def _check_fitted(self) -> None:
        if not self._fitted:
            raise ValueError("Model not fitted. Call fit() first.")
    
    @property
    def vocab_size(self) -> int:
        return len(self._vocab)
    
    @property
    def is_fitted(self) -> bool:
        return self._fitted
    
    def get_vocab(self) -> Dict[str, int]:
        return self._vocab.copy()
    
    def get_idf(self, token: str) -> Optional[float]:
        return self._idf.get(token)