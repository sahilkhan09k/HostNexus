import fs from "fs";
import path from "path";
import { ChromaClient, type Collection } from "chromadb";
import { EmbeddingService } from "./embedding.service.js";
import { HOSTNEXUS_KNOWLEDGE_DOCUMENTS } from "./knowledge-base.js";
import { prisma } from "../../config/database.js";
import type { KnowledgeDocument } from "./types.js";

interface StoredVectorItem<T = any> {
  id: string;
  vector: number[];
  text: string;
  metadata: T;
  timestamp: number;
}

export class VectorStoreService {
  private static chromaClient: ChromaClient | null = null;
  private static resourceCollection: Collection | null = null;
  private static policyCollection: Collection | null = null;
  private static isChromaConnected = false;
  private static hasInitialized = false;

  // Local persistent memory index (guarantees 100% uptime with or without Chroma server)
  private static localResources: Map<string, StoredVectorItem<any>> = new Map();
  private static localPolicies: Map<string, StoredVectorItem<any>> = new Map();
  private static readonly PERSISTENCE_DIR = path.join(process.cwd(), "data");
  private static readonly PERSISTENCE_FILE = path.join(process.cwd(), "data", "vector-store.json");

  /**
   * Initialize Vector Database connection and local index
   */
  public static async init(): Promise<void> {
    if (this.hasInitialized) return;
    this.hasInitialized = true;

    // 1. Load local persistent vector storage from disk
    this.loadFromDisk();

    // 2. Try connecting to ChromaDB (Cloud or local)
    const host = process.env.CHROMA_HOST || "api.trychroma.com";
    const chromaApiKey = process.env.CHROMA_API_KEY;
    const tenant = process.env.CHROMA_TENANT || "default_tenant";
    const database = process.env.CHROMA_DATABASE || "default_database";
    const isCloud = host.includes("trychroma.com") || Boolean(chromaApiKey);

    try {
      const headers: Record<string, string> = {};
      if (chromaApiKey) {
        headers["x-chroma-token"] = chromaApiKey;
        headers["Authorization"] = `Bearer ${chromaApiKey}`;
      }

      this.chromaClient = new ChromaClient({
        ssl: isCloud,
        host,
        port: isCloud ? 443 : 8000,
        headers: Object.keys(headers).length > 0 ? headers : undefined,
        tenant,
        database,
      });

      // Quick heartbeat check
      await this.chromaClient.heartbeat();

      // Custom embedder so Chroma doesn't try loading @chroma-core/default-embed
      const dummyEmbedder = {
        generate: async (texts: string[]) => texts.map(() => new Array(EmbeddingService.DIMENSIONS).fill(0)),
      };

      // Get or create collections in ChromaDB
      this.resourceCollection = await this.chromaClient.getOrCreateCollection({
        name: "hostnexus_resources",
        metadata: { "hnsw:space": "cosine" },
        embeddingFunction: dummyEmbedder as any,
      });

      this.policyCollection = await this.chromaClient.getOrCreateCollection({
        name: "hostnexus_policies",
        metadata: { "hnsw:space": "cosine" },
        embeddingFunction: dummyEmbedder as any,
      });

      this.isChromaConnected = true;
      console.log(`✅ Chroma Cloud connected successfully [Database: ${database}, Tenant: ${tenant}]`);
    } catch (err: any) {
      this.isChromaConnected = false;
      console.log(
        `ℹ️ ChromaDB connection notice (${err?.message || "connection pending"}). Running with embedded persistent vector store.`
      );
    }

    // 3. Ensure policies are indexed
    if (this.localPolicies.size === 0) {
      await this.syncAllPolicies();
    }

    // 4. Ensure resources are indexed
    if (this.localResources.size === 0) {
      await this.syncAllResources();
    }
  }

  /**
   * Sync all platform knowledge documents into the vector store
   */
  public static async syncAllPolicies(): Promise<void> {
    console.log("📚 Indexing platform policies into Vector Store...");
    for (const doc of HOSTNEXUS_KNOWLEDGE_DOCUMENTS) {
      const docText = `${doc.title}\n${doc.section}\nKeywords: ${doc.keywords.join(", ")}\nRules:\n${doc.rulesSummary.join("\n")}\n${doc.content}`;
      const vector = await EmbeddingService.embedText(docText);

      this.localPolicies.set(doc.id, {
        id: doc.id,
        vector,
        text: docText,
        metadata: doc,
        timestamp: Date.now(),
      });

      if (this.isChromaConnected && this.policyCollection) {
        try {
          await this.policyCollection.upsert({
            ids: [doc.id],
            embeddings: [vector],
            metadatas: [{ title: doc.title, category: doc.category, section: doc.section }],
            documents: [docText],
          });
        } catch (e) {
          // Chroma upsert failed, local store remains authoritative
        }
      }
    }
    this.saveToDisk();
    console.log(`✅ Indexed ${this.localPolicies.size} policy documents in Vector Store.`);
  }

  /**
   * Sync all active database listings into the vector store
   */
  public static async syncAllResources(): Promise<void> {
    try {
      const rawResources = await prisma.resource.findMany({
        where: { isActive: true },
        include: {
          business: {
            select: {
              id: true,
              name: true,
              city: true,
              state: true,
              businessType: true,
              reviewsReceived: { select: { rating: true, reviewerRole: true } },
            },
          },
          availabilityWindows: {
            select: { fromDate: true, toDate: true },
          },
        },
      });

      console.log(`🔍 Indexing ${rawResources.length} marketplace listings into Vector Store...`);

      for (const res of rawResources) {
        await this.indexSingleResource(res);
      }

      this.saveToDisk();
      console.log(`✅ Indexed ${this.localResources.size} resources in Vector Store.`);
    } catch (err) {
      console.error("❌ Failed to sync resources to vector store:", err);
    }
  }

  /**
   * Index a single resource into Vector Store
   */
  public static async indexSingleResource(res: any): Promise<void> {
    const textToEmbed = [
      res.name,
      res.resourceType,
      res.description || "",
      res.location || "",
      res.business?.name || "",
      `Quantity: ${res.quantity} ${res.unit || "units"}`,
      res.hasPreExistingDamage ? `Pre-existing: ${res.damageDescription}` : "Mint condition",
    ].join(" ");

    const vector = await EmbeddingService.embedText(textToEmbed);

    this.localResources.set(res.id, {
      id: res.id,
      vector,
      text: textToEmbed,
      metadata: res,
      timestamp: Date.now(),
    });

    if (this.isChromaConnected && this.resourceCollection) {
      try {
        await this.resourceCollection.upsert({
          ids: [res.id],
          embeddings: [vector],
          metadatas: [
            {
              title: res.name,
              category: res.resourceType,
              businessName: res.business?.name || "",
              location: res.location || "",
              quantity: res.quantity,
              rentAmountPaise: res.rentAmountPaise || 0,
            },
          ],
          documents: [textToEmbed],
        });
      } catch (e) {
        // Chroma upsert failed, fallback to local store
      }
    }
  }

  /**
   * Remove a resource from vector index
   */
  public static async deleteResource(resourceId: string): Promise<void> {
    this.localResources.delete(resourceId);
    if (this.isChromaConnected && this.resourceCollection) {
      try {
        await this.resourceCollection.delete({ ids: [resourceId] });
      } catch (e) {
        // Ignore deletion errors
      }
    }
    this.saveToDisk();
  }

  /**
   * Semantic Vector Search for Policy Documents
   */
  public static async searchPolicies(
    queryText: string,
    topK = 3
  ): Promise<Array<{ document: KnowledgeDocument; score: number }>> {
    await this.init();
    const queryVector = await EmbeddingService.embedText(queryText);

    // If Chroma is connected, try Chroma vector search first
    if (this.isChromaConnected && this.policyCollection) {
      try {
        const chromaResults = await this.policyCollection.query({
          queryEmbeddings: [queryVector],
          nResults: topK,
        });

        if (chromaResults.ids?.[0]?.length) {
          const results: Array<{ document: KnowledgeDocument; score: number }> = [];
          for (let i = 0; i < chromaResults.ids[0].length; i++) {
            const id = chromaResults.ids[0][i];
            const distance = chromaResults.distances?.[0]?.[i] ?? 0;
            // Cosine distance to similarity: 1 - distance
            const score = Math.max(0, Math.min(1, 1 - distance));
            const stored = this.localPolicies.get(id);
            if (stored) {
              results.push({ document: stored.metadata, score });
            }
          }
          if (results.length > 0) return results;
        }
      } catch (e) {
        console.warn("Chroma policy query failed, falling back to local vector store:", e);
      }
    }

    // Local embedded vector similarity search
    const scored: Array<{ document: KnowledgeDocument; score: number }> = [];
    for (const item of this.localPolicies.values()) {
      const similarity = EmbeddingService.cosineSimilarity(queryVector, item.vector);
      scored.push({
        document: item.metadata,
        score: similarity,
      });
    }

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK);
  }

  /**
   * Semantic Vector Search for Marketplace Listings
   */
  public static async searchResources(
    queryText: string,
    topK = 5
  ): Promise<Array<{ resource: any; score: number }>> {
    await this.init();
    const queryVector = await EmbeddingService.embedText(queryText);

    // If Chroma is connected, attempt Chroma vector query
    if (this.isChromaConnected && this.resourceCollection) {
      try {
        const chromaResults = await this.resourceCollection.query({
          queryEmbeddings: [queryVector],
          nResults: topK,
        });

        if (chromaResults.ids?.[0]?.length) {
          const results: Array<{ resource: any; score: number }> = [];
          for (let i = 0; i < chromaResults.ids[0].length; i++) {
            const id = chromaResults.ids[0][i];
            const distance = chromaResults.distances?.[0]?.[i] ?? 0;
            const score = Math.max(0, Math.min(1, 1 - distance));
            const stored = this.localResources.get(id);
            if (stored) {
              results.push({ resource: stored.metadata, score });
            }
          }
          if (results.length > 0) return results;
        }
      } catch (e) {
        console.warn("Chroma resource query failed, falling back to local vector store:", e);
      }
    }

    // Local embedded vector similarity search
    const scored: Array<{ resource: any; score: number }> = [];
    for (const item of this.localResources.values()) {
      const similarity = EmbeddingService.cosineSimilarity(queryVector, item.vector);
      scored.push({
        resource: item.metadata,
        score: similarity,
      });
    }

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK);
  }

  /**
   * Save vector indexes to persistent disk file
   */
  private static saveToDisk(): void {
    try {
      if (!fs.existsSync(this.PERSISTENCE_DIR)) {
        fs.mkdirSync(this.PERSISTENCE_DIR, { recursive: true });
      }

      const dump = {
        resources: Array.from(this.localResources.values()),
        policies: Array.from(this.localPolicies.values()),
        updatedAt: new Date().toISOString(),
      };

      fs.writeFileSync(this.PERSISTENCE_FILE, JSON.stringify(dump), "utf-8");
    } catch (e) {
      console.warn("Could not save vector index to disk:", e);
    }
  }

  /**
   * Load vector indexes from persistent disk file
   */
  private static loadFromDisk(): void {
    try {
      if (fs.existsSync(this.PERSISTENCE_FILE)) {
        const content = fs.readFileSync(this.PERSISTENCE_FILE, "utf-8");
        const dump = JSON.parse(content);

        if (Array.isArray(dump.resources)) {
          for (const item of dump.resources) {
            this.localResources.set(item.id, item);
          }
        }

        if (Array.isArray(dump.policies)) {
          for (const item of dump.policies) {
            this.localPolicies.set(item.id, item);
          }
        }

        console.log(
          `📂 Loaded persistent vector cache from disk: ${this.localResources.size} resources, ${this.localPolicies.size} policies.`
        );
      }
    } catch (e) {
      console.warn("Could not load vector store from disk:", e);
    }
  }
}
