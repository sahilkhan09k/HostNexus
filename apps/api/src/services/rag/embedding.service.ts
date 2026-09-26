/**
 * High-performance semantic dense embedding engine for HostNexus RAG.
 * Generates normalized 384-dimensional dense vectors with domain-specific semantic projection.
 * Supports cosine similarity dot products with zero external network dependencies.
 */

export class EmbeddingService {
  public static readonly DIMENSIONS = 384;

  // Domain semantic clusters for B2B hospitality and marketplace policies
  private static readonly SEMANTIC_CLUSTERS: Record<string, string[]> = {
    seating: [
      "chair", "chairs", "chiavari", "seating", "seat", "seats", "stool", "stools", 
      "banquet chair", "dining chair", "armchair", "sofa", "bench", "cushion"
    ],
    tables: [
      "table", "tables", "round table", "dining table", "buffet table", "banquet table", 
      "cocktail table", "bar table", "desk", "trestle table", "setup"
    ],
    venues_and_spaces: [
      "banquet", "hall", "ballroom", "lawn", "terrace", "venue", "room", "space", 
      "pax", "capacity", "guests", "conference", "auditorium", "wedding"
    ],
    kitchen_and_catering: [
      "kitchen", "catering", "cook", "oven", "range", "tandoor", "chafing", "burner", 
      "buffet", "crockery", "cutlery", "glassware", "utensils", "chef", "commercial kitchen"
    ],
    audio_visual: [
      "av", "audio", "sound", "speaker", "speakers", "microphone", "mic", "projector", 
      "screen", "led wall", "display", "stage lighting", "spotlight", "sound system", "dj"
    ],
    cold_storage_and_cooling: [
      "cold storage", "refrigerat", "freezer", "chiller", "cooling", "ac", "portable ac", "cooler"
    ],
    power_and_utilities: [
      "generator", "genset", "diesel", "kva", "power backup", "electricity", "utility"
    ],
    decor_and_staging: [
      "decor", "decoration", "stage", "staging", "backdrop", "flower", "floral", "dance floor", "carpet"
    ],
    damage_and_claims: [
      "damage", "damaged", "broken", "loss", "scratch", "dent", "stain", "ruin", "breakage", 
      "claim", "compensation", "repair", "dispute", "wear", "tear", "imperfect"
    ],
    custody_and_inspection: [
      "handover", "inspection", "receiving", "pickup", "delivery", "window", "1 hour", "2 hour", 
      "photos", "evidence", "audit trail", "condition snapshot", "chain of custody"
    ],
    escrow_and_payment: [
      "escrow", "payment", "razorpay", "deposit", "security deposit", "payout", "refund", 
      "freeze", "funds", "release", "financial", "safe", "transaction"
    ],
    negotiation_and_pricing: [
      "negotiate", "negotiation", "counter offer", "discount", "bargain", "rate", "quote", 
      "bulk discount", "price reduction", "lower price"
    ],
    kyc_and_trust: [
      "kyc", "gst", "gstin", "aadhaar", "verified badge", "trust", "verification", 
      "commercial entity", "business registration"
    ]
  };

  /**
   * Cache for repeated queries to achieve instantaneous 0ms embedding
   */
  private static cache = new Map<string, number[]>();

  /**
   * Generate a normalized 384-dimensional semantic embedding vector
   */
  public static async embedText(text: string): Promise<number[]> {
    const normalizedText = text.trim().toLowerCase();
    
    // Check cache
    const cached = this.cache.get(normalizedText);
    if (cached) return cached;

    const vector = new Array<number>(this.DIMENSIONS).fill(0);
    const tokens = this.tokenize(normalizedText);

    if (tokens.length === 0) {
      // Return zero vector if text is empty
      return vector;
    }

    // 1. Subword and Token N-gram Hashing across vector space
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      const tokenWeight = 1.0 / Math.sqrt(i + 1); // positional decay

      // Direct token hash
      const tokenHash = this.fnv1a(token);
      const primaryIdx = Math.abs(tokenHash) % (this.DIMENSIONS - 64);
      vector[primaryIdx] += 1.5 * tokenWeight;

      // Secondary hash for dispersion
      const secondaryHash = this.fnv1a(token + "_sec");
      const secondaryIdx = Math.abs(secondaryHash) % (this.DIMENSIONS - 64);
      vector[secondaryIdx] += 0.8 * tokenWeight;

      // Character tri-grams for subword robustness (handles typos & pluralizations)
      if (token.length >= 3) {
        for (let j = 0; j <= token.length - 3; j++) {
          const tri = token.slice(j, j + 3);
          const triHash = this.fnv1a(tri);
          const triIdx = Math.abs(triHash) % (this.DIMENSIONS - 64);
          vector[triIdx] += 0.35 * tokenWeight;
        }
      }
    }

    // 2. Semantic Cluster Alignment (reserved dimensions 320 to 383)
    const clusterEntries = Object.entries(this.SEMANTIC_CLUSTERS);
    clusterEntries.forEach(([_clusterName, keywords], clusterIdx) => {
      const targetDim = 320 + (clusterIdx * 4) % 64;
      let clusterHit = 0;

      for (const kw of keywords) {
        if (normalizedText.includes(kw)) {
          clusterHit += 2.0;
        }
      }

      if (clusterHit > 0) {
        // Boost dedicated cluster vector slice
        vector[targetDim] += clusterHit;
        vector[(targetDim + 1) % this.DIMENSIONS] += clusterHit * 0.75;
        vector[(targetDim + 2) % this.DIMENSIONS] += clusterHit * 0.5;
      }
    });

    // 3. L2 Unit Normalization (so dot product equals cosine similarity)
    const normalized = this.normalize(vector);

    // Limit cache size to 5,000 entries
    if (this.cache.size > 5000) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }
    this.cache.set(normalizedText, normalized);

    return normalized;
  }

  /**
   * Calculate cosine similarity between two embedding vectors.
   * Both vectors must be L2 normalized (dot product = cosine similarity).
   */
  public static cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) return 0;

    let dot = 0;
    for (let i = 0; i < vecA.length; i++) {
      dot += vecA[i] * vecB[i];
    }

    // Bound between 0.0 and 1.0 for positive cosine score
    return Math.max(0, Math.min(1, (dot + 1) / 2));
  }

  /**
   * Tokenize text into normalized alphanumeric words
   */
  private static tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 1);
  }

  /**
   * FNV-1a 32-bit hashing algorithm
   */
  private static fnv1a(str: string): number {
    let hash = 2166136261;
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash;
  }

  /**
   * L2 Vector Normalization
   */
  private static normalize(vector: number[]): number[] {
    let sumSq = 0;
    for (let i = 0; i < vector.length; i++) {
      sumSq += vector[i] * vector[i];
    }

    const magnitude = Math.sqrt(sumSq);
    if (magnitude === 0) return vector;

    const normalized = new Array<number>(vector.length);
    for (let i = 0; i < vector.length; i++) {
      normalized[i] = vector[i] / magnitude;
    }
    return normalized;
  }
}
