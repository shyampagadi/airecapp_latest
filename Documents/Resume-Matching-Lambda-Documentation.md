# AI-Powered Resume Matching System: Technical Documentation

## Overview

This document provides a detailed technical analysis of our AWS Lambda function (`lambda_function.py`), focusing particularly on the search, ranking, and reranking algorithms that power our AI-based resume matching system. The function leverages AWS Bedrock, OpenSearch, and PostgreSQL to intelligently match job descriptions with relevant candidate resumes using advanced semantic search and multi-factor ranking algorithms.

## System Architecture

Our resume matching system combines multiple AI technologies to deliver intelligent candidate-job matching:

1. **Vector Embeddings** - AWS Bedrock models transform text into high-dimensional numerical vectors
2. **Semantic Search** - OpenSearch performs vector and keyword searches against resume database
3. **AI Analysis** - LLM models extract structured information from job descriptions
4. **Advanced Ranking** - Multi-factor scoring system prioritizes best candidates
5. **Data Integration** - PostgreSQL database provides candidate PII information

## Search Technology: Hybrid Search Explained

### Vector Search vs. Keyword Search

Our system implements a sophisticated hybrid search that combines the strengths of two complementary approaches:

**Vector Search (Semantic Search)**:
- Converts text to high-dimensional vectors using AWS Bedrock embedding models
- Captures semantic meaning beyond exact keyword matches
- Understands conceptual relationships between terms
- Can identify relevant resumes even when terminology differs

**Keyword Search (Text Search)**:
- Looks for exact or fuzzy matches of specific terms
- Excellent for precise skill matching and requirements
- Handles specialized terminology and acronyms well
- Provides targeted boosting of specific fields

### Hybrid Search Implementation (Lines 877-1098)

Our hybrid search function merges these approaches with careful weighting:

```python
search_query = {
    "query": {
        "bool": {
            "should": [
                # Vector search component with higher weight
                {
                    "knn": {
                        "resume_embedding": {
                            "vector": query_embedding,
                            "k": initial_size,
                            "boost": 3.0  # Higher weight for semantic matching
                        }
                    }
                },
                # Text search components for keyword matching
                {
                    "multi_match": {
                        "query": focused_query,
                        "fields": [
                            "skills^3",       # Higher weight for skills
                            "positions^2.5",  # High weight for job titles
                            "summary^1.5",    # Medium weight for summary
                            "companies.description^1", 
                            "projects.description^1",
                            "education.degree^1"
                        ],
                        "type": "best_fields",
                        "tie_breaker": 0.3,
                        "fuzziness": "AUTO:4,7",
                        "boost": 1.0
                    }
                }
            ],
            "minimum_should_match": 1,
        }
    }
}
```

Key aspects of our hybrid search:

1. **Vector Search Boosting (3.0)**: Gives higher priority to semantic understanding
2. **Field-specific Boosting**: 
   - Skills receive highest text boost (3.0) as they are critical matching factors
   - Job titles/positions receive high boost (2.5) to match career trajectory
   - Summary receives medium boost (1.5) for broader context
   - Other fields (companies, projects, education) receive standard boost (1.0)

3. **Targeted Skill Boosting**:
   ```python
   # Add boost for specific skills if available
   if key_terms and len(key_terms) > 0:
       term_queries = []
       for term in key_terms[:10]:  # Limit to top 10 terms
           if len(term) >= 3:  # Skip very short terms
               term_queries.append({
                   "match_phrase": {
                       "skills": {
                           "query": term,
                           "boost": 1.5  # Boost for specific skill matches
                       }
                   }
               })
   ```
   This adds additional boosting (1.5) for exact phrase matches of key skills from the job description.

4. **Focused Query Creation**:
   ```python
   def create_focused_search_query(job_description: str, jd_info: Dict[str, Any]) -> str:
       # Create a focused query combining key elements from the JD
       query_parts = []
       
       # Add job title, skills, seniority level, etc.
       ...
       
       # If we have enough extracted info, use the focused query
       if len(query_parts) >= 3:
           return "\n".join(query_parts)
       
       # Fallback to using the original job description
       return job_description
   ```
   Instead of searching the raw job description, we create a focused query emphasizing the most important elements (title, skills, seniority).

## Multi-Stage Ranking and Reranking System

Our sophisticated candidate matching system operates in multiple stages to identify the best-fit candidates:

### Stage 1: Initial Search and Score Normalization (Lines 950-971)

The first stage retrieves potential candidates and normalizes their raw search scores:

```python
# Find min and max scores for normalization
scores = [hit.get('_score', 0) for hit in hits]
max_score = max(scores) if scores else 1.0
min_score = min(scores) if scores else 0.0
score_range = max(max_score - min_score, 0.0001)  # Avoid division by zero

# Normalize score to 0-100 scale
normalized_score = ((raw_score - min_score) / score_range) * 100

# Apply sigmoid normalization for better distribution
relevance_factor = 12.0  # Controls steepness of sigmoid curve
normalized_score = 100 * (1 / (1 + math.exp(-((normalized_score/100 - 0.5) * relevance_factor))))
normalized_score = min(round(normalized_score, 2), 100)  # Cap at 100
```

The sigmoid normalization is particularly important as it:
- Creates a more evenly distributed score range
- Emphasizes differences between mid-range results
- De-emphasizes small differences at extreme ends
- Provides consistent scoring across different queries

### Stage 2: Advanced Reranking Algorithm (Lines 973-1036)

After initial retrieval, our proprietary **reranking system** completely reorders candidates based on multiple weighted factors beyond just semantic similarity:

```python
# Apply reranking with skill match and experience match
reranked_results = []
jd_skills = jd_info.get("required_skills", [])

for resume in initial_results:
    # Calculate skill match
    skill_score = calculate_skill_match_score(resume_skills, jd_skills)
    
    # Calculate experience match
    exp_score = calculate_experience_match(resume_exp, jd_exp)
    
    # Calculate position match
    position_score = calculate_position_match(job_title, resume_positions)
    
    # Calculate combined rerank score with precise weights
    hybrid_weight = 0.55    # Higher weight for hybrid score
    skill_weight = 0.25     # Weight for skill matching
    position_weight = 0.10  # Weight for job title matching  
    exp_weight = 0.10       # Weight for experience matching

    rerank_score = (
        resume['score'] * hybrid_weight +
        skill_score * skill_weight +
        position_score * position_weight +
        exp_score * exp_weight
    )
    
    # Store scores and add to reranking results
    resume['rerank_score'] = min(round(rerank_score, 2), 100)
    resume['skill_score'] = skill_score
    resume['exp_score'] = exp_score
    resume['position_score'] = position_score
    
    reranked_results.append(resume)

# Sort by reranked score - completely new ordering based on multiple factors
reranked_results.sort(key=lambda x: x['rerank_score'], reverse=True)
```

Let's examine each factor in depth:

#### Initial Hybrid Score (55% weight)

The initial score from OpenSearch combines semantic relevance and keyword matching. This score:
- Represents holistic document relevance
- Captures semantic understanding of the resume
- Includes boosted matches from the fields configuration
- Forms the foundation of our ranking system

#### Skill Match Score (25% weight)

Our sophisticated skill matching algorithm (lines 619-673) is particularly nuanced:

```python
def calculate_skill_match_score(resume_skills: List[str], jd_skills: List[str]) -> float:
    # Normalize skills (lowercase and handle variations)
    resume_skills_norm = [normalize_skill(skill) for skill in resume_skills]
    jd_skills_norm = [normalize_skill(skill) for skill in jd_skills]
    
    # Count exact matches using normalized skills
    exact_matches = sum(1 for skill in jd_skills_norm if skill in resume_skills_norm)
    
    # Calculate partial matches with improved logic
    partial_matches = 0
    for jd_skill in jd_skills_norm:
        if jd_skill not in resume_skills_norm:
            # Check for substring matches (both directions)
            for resume_skill in resume_skills_norm:
                # Only consider meaningful substrings (at least 4 chars)
                if len(jd_skill) >= 4 and len(resume_skill) >= 4:
                    # Check if JD skill is part of resume skill
                    if jd_skill in resume_skill:
                        partial_matches += 0.75  # Higher weight for substring match
                        break
                    # Check if resume skill is part of JD skill
                    elif resume_skill in jd_skill:
                        partial_matches += 0.5  # Medium weight for this case
                        break
                    # Check for significant word overlap in multi-word skills
                    elif ' ' in jd_skill and ' ' in resume_skill:
                        jd_words = set(jd_skill.split())
                        resume_words = set(resume_skill.split())
                        common_words = jd_words.intersection(resume_words)
                        if len(common_words) >= 2 or (len(common_words) == 1 and len(jd_words) <= 2):
                            partial_matches += 0.5  # Medium weight for word overlap
                            break
    
    # Calculate score with sophisticated weighting
    total_matches = exact_matches + partial_matches
    weighted_score = (total_matches / len(jd_skills_norm) * 100) if jd_skills_norm else 0
    
    # Bonus for high coverage of critical skills
    if jd_skills_norm and exact_matches >= len(jd_skills_norm) * 0.7:
        weighted_score *= 1.15  # 15% bonus for covering 70%+ of required skills
        weighted_score = min(weighted_score, 100)  # Cap at 100
```

This algorithm implements:

1. **Skill Normalization** - Standardizes variations like "JavaScript"/"JS"/"javascript"
2. **Multi-tier Matching**:
   - **Exact matches**: Full weight (1.0) for perfect skill matches
   - **Substring matches**: High weight (0.75) when JD skill appears within resume skill
   - **Superset matches**: Medium weight (0.5) when resume skill appears within JD skill
   - **Word overlap**: Medium weight (0.5) for multi-word skills sharing 2+ words
3. **Bonus Scoring**: 15% bonus when candidate has 70%+ of required skills
4. **Proportional Scoring**: Score is calculated as percentage of required skills matched

#### Position/Title Match Score (10% weight)

Job title matching evaluates career alignment:

```python
position_score = 0
if jd_info.get('job_title') and 'positions' in resume:
    job_title = jd_info.get('job_title', '').lower()
    resume_positions = resume['positions'] if isinstance(resume['positions'], list) else [resume['positions']]
    
    for position in resume_positions:
        position_lower = position.lower() if position else ""
        if job_title == position_lower:
            position_score = 100  # Perfect title match
            break
        elif position_lower and (job_title in position_lower or position_lower in job_title):
            position_score = max(position_score, 70)  # Partial title match
```

This score rewards:
- Exact job title matches with maximum score (100)
- Partial matches (where one title contains the other) with high score (70)
- Avoids over-penalizing title variations while still prioritizing career alignment

#### Experience Match Score (10% weight)

Experience matching (lines 675-684) uses a proportional scoring model:

```python
def calculate_experience_match(resume_exp: float, jd_required_exp: float) -> float:
    if resume_exp >= jd_required_exp:
        return 100.0  # Full score for meeting/exceeding requirements
    
    # Partial match - proportional score
    return round((resume_exp / jd_required_exp) * 100, 2) if jd_required_exp > 0 else 0
```

This approach:
- Gives full credit for meeting or exceeding experience requirements
- Provides proportional scoring for partial experience matches
- Avoids binary filtering while still prioritizing qualified candidates

### 3. Enhanced Result Analysis (Lines 1377-1429)

After reranking, our system performs detailed skill analysis:

```python
# Find missing skills (required but not in resume)
missing_skills = [skill for skill in required_skills 
                 if normalize_skill(skill.lower()) not in normalized_resume_skills]

# Find matching skills (for highlighting)
matching_skills = [skill for skill in resume_skills 
                 if any(normalize_skill(skill.lower()) == normalize_skill(req_skill.lower()) 
                       for req_skill in required_skills)]

# Enhance with partial matches (e.g., "Python" matches "Python 3")
partial_matches = []
for req_skill in required_skills:
    req_norm = normalize_skill(req_skill.lower())
    # Check if any resume skill contains this required skill
    for res_skill in resume_skills:
        if res_skill not in matching_skills:  # Skip skills already counted as exact matches
            res_norm = normalize_skill(res_skill.lower())
            # Check for substring match in either direction
            if (req_norm in res_norm or res_norm in req_norm) and len(req_norm) > 2 and len(res_norm) > 2:
                partial_matches.append({
                    'required': req_skill,
                    'resume': res_skill
                })

# Calculate skill coverage percentage
skill_coverage = 0
if required_skills:
    # Count exact + partial matches with appropriate weighting
    exact_match_count = len(matching_skills)
    partial_match_count = len(partial_matches) * 0.5  # Give partial matches half weight
    skill_coverage = min(100, round((exact_match_count + partial_match_count) / len(required_skills) * 100, 1))
```

The above analysis is performed on candidates that have already been completely reranked and reordered based on our multi-factor algorithm.

This detailed skill analysis enables:
- Precise identification of skill gaps
- Highlighting matched skills in the UI
- Recognizing partial skill matches
- Calculating overall skill coverage percentages

### 4. Skill Gap Analysis (Lines 1431-1449)

Our system concludes by analyzing skill gaps across all candidates:

```python
# Create a summary of most common missing skills across candidates
skill_gap_analysis = {}
if results_with_metrics:
    # Count missing skills across all results
    for result in results_with_metrics:
        for skill in result['skills']['missing']:
            if skill in skill_gap_analysis:
                skill_gap_analysis[skill] += 1
            else:
                skill_gap_analysis[skill] = 1
    
    # Convert to sorted list
    skill_gap_list = [{"skill": k, "missing_count": v, "missing_percent": round((v / len(results_with_metrics)) * 100, 1)} 
                     for k, v in skill_gap_analysis.items()]
    skill_gap_list.sort(key=lambda x: x['missing_count'], reverse=True)
```

This final analysis:
- Identifies the most common skill gaps across the candidate pool
- Calculates percentage of candidates missing each skill
- Prioritizes skill gaps to guide recruitment or training initiatives
- Provides strategic HR insights beyond individual matching

## Performance Optimization Features

### 1. Embedding Cache

```python
# Enhance embedding cache with expiry time
_embedding_cache = {}
_embedding_cache_timestamps = {}
_CACHE_EXPIRY_SECONDS = 3600  # Cache expires after 1 hour

# In generate_embedding function:
# Check if embedding is cached and not expired
if (cache_key in _embedding_cache and 
    cache_key in _embedding_cache_timestamps and 
    current_time - _embedding_cache_timestamps[cache_key] < _CACHE_EXPIRY_SECONDS):
    logger.debug("Using cached embedding")
    return _embedding_cache[cache_key]
```

The caching mechanism dramatically improves performance by:
- Eliminating duplicate embedding generation API calls
- Setting time-based expiry to ensure freshness
- Using MD5 hashing for efficient lookup

### 2. Connection Retry Logic

```python
# Implement retry mechanism with exponential backoff
max_retries = 3
retry_delay = 1  # starting delay in seconds

for attempt in range(max_retries):
    try:
        # Execute search with retry
        # ...
        break  # Success, exit retry loop
    except Exception as e:
        # ...
        # Calculate exponential backoff with jitter
        jitter = random.uniform(0, 0.5)
        wait_time = (2 ** attempt * retry_delay) + jitter
        # ...
        time.sleep(wait_time)
```

Our connection retry approach implements industry best practices:
- Exponential backoff (doubling delay between retries)
- Randomized jitter to prevent thundering herd problems
- Graceful fallbacks when services are unavailable

## Summary of Ranking and Reranking Process

Our resume matching process follows these key stages:

1. **Initial Hybrid Search**: Combines vector similarity and keyword matching to find potential candidates
2. **Score Normalization**: Applies min-max and sigmoid normalization to raw search scores
3. **Multi-factor Reranking**: Completely reorders candidates based on:
   - Initial hybrid score (55% weight)
   - Skill match score (25% weight)
   - Position/title match (10% weight)
   - Experience match (10% weight)
4. **Skill Gap Analysis**: Identifies missing skills across all candidates for strategic insights

The reranking process is particularly important as it transforms a purely semantic search into a sophisticated matching system that balances multiple factors relevant to job fit.

## Conclusion

Our resume matching algorithm represents a sophisticated AI-powered solution that combines:

1. **Hybrid Search Technology**: Balancing semantic understanding with precise skill matching
2. **Advanced Reranking System**: Intelligently reordering candidates based on multiple weighted factors
3. **Detailed Skill Analysis**: Matching that considers variations and partial matches
4. **Strategic Insights**: Workforce analytics through skill gap identification
5. **Performance Optimization**: Caching and retry mechanisms for robust operation

The system delivers high-quality candidate recommendations that balance semantic understanding with specific skill and experience requirements, providing both tactical matching and strategic HR insights.
 