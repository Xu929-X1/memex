# Quality control metrics for chunck splitting

## Structural Integrity 
- Mid sentence cut rate: % of chuncks not ending in .?! or block boudary
- Mid word cut rate: % of first/last token splits a word
- Code fence balance: count of ``` need to be even for each chunk
- MD continuity: balanced [], (), list continity 
- Table integrity: Header row not seperate from body

## Chunk size distribution
- % of overly small chunks (<100 tokens) --- Orphans
- % of overly large chunks (> 2x max token count) --- Split strategies failed
### statistic matrix
- Mean, stddev, p5/p95 of token count

## Semantic Cohesion
- Intra-chunk cohesion: mean pairwise cosine of sentence embeddings inside chunk. High = topically tight.
- Boundary drop: cosine(last_sentence_chunk_i, first_sentence_chunk_i+1). Low = split landed on topicshift (good). High = split mid-topic (bad).
- Composite: cohesion - boundary_similarity. Higher = better split.

## Coverage
- Σ chunk_chars − overlap_chars == doc_chars. Gaps = lost content.
- Duplication rate beyond declared overlap.

## Context Preservation
- Heading depth retained (h1>h2>h3 chain intact)
- Orphan section rate: heading with <N chars body

## Density
- Whitespace ratio per chunk
- Boilerplate rate (repeated header/footer fragments via shingling)


## Single quality score

Weighted sum, e.g.:
  score = 0.25*(1-mid_sentence_rate)
        + 0.20*size_in_band_rate
        + 0.20*intra_cohesion
        + 0.15*(1-boundary_similarity)
        + 0.10*coverage_exact
        + 0.10*context_preserved
  Gate: score >= 0.80.