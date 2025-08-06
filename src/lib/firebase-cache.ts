import { 
  collection, 
  query, 
  getDocs, 
  doc, 
  getDoc, 
  onSnapshot, 
  orderBy, 
  limit, 
  where,
  Timestamp,
  QuerySnapshot,
  DocumentSnapshot
} from 'firebase/firestore';
import { db } from './firebase';

interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  lastUpdated?: Timestamp;
}

interface CacheOptions {
  maxAge?: number; // Cache expiry in milliseconds (default: 5 minutes)
  checkUpdatedBy?: boolean; // Check if data was updated by comparing updatedBy field
}

class FirebaseCache {
  private cache = new Map<string, CacheEntry>();
  private readonly DEFAULT_MAX_AGE = 5 * 60 * 1000; // 5 minutes

  // Generate cache key from collection and query parameters
  private generateCacheKey(collectionName: string, params?: any): string {
    const paramsStr = params ? JSON.stringify(params) : '';
    return `${collectionName}_${paramsStr}`;
  }

  // Check if cache entry is still valid
  private isValidCacheEntry(entry: CacheEntry, maxAge: number): boolean {
    const age = Date.now() - entry.timestamp;
    return age < maxAge;
  }

  // Get cached collection data with lazy loading
  async getCachedCollection<T = any>(
    collectionName: string,
    queryParams?: {
      where?: Array<[string, any, any]>;
      orderBy?: [string, 'asc' | 'desc'];
      limit?: number;
    },
    options: CacheOptions = {}
  ): Promise<T[]> {
    const { maxAge = this.DEFAULT_MAX_AGE, checkUpdatedBy = true } = options;
    const cacheKey = this.generateCacheKey(collectionName, queryParams);
    
    console.log(`🗄️ Cache: Checking cache for ${collectionName}`);

    // Check if we have cached data
    const cached = this.cache.get(cacheKey);
    if (cached && this.isValidCacheEntry(cached, maxAge)) {
      // If checking updatedBy, we need to verify if data was updated
      if (checkUpdatedBy && cached.lastUpdated) {
        const hasUpdates = await this.checkForUpdates(collectionName, cached.lastUpdated, queryParams);
        if (!hasUpdates) {
          console.log(`✅ Cache: Using cached data for ${collectionName}`);
          return cached.data;
        }
        console.log(`🔄 Cache: Data was updated, refreshing ${collectionName}`);
      } else {
        console.log(`✅ Cache: Using cached data for ${collectionName}`);
        return cached.data;
      }
    }

    console.log(`🔄 Cache: Fetching fresh data for ${collectionName}`);
    
    // Build query
    let firestoreQuery = collection(db, collectionName);
    
    if (queryParams?.where) {
      queryParams.where.forEach(([field, operator, value]) => {
        firestoreQuery = query(firestoreQuery, where(field, operator, value));
      });
    }
    
    if (queryParams?.orderBy) {
      const [field, direction] = queryParams.orderBy;
      firestoreQuery = query(firestoreQuery, orderBy(field, direction));
    }
    
    if (queryParams?.limit) {
      firestoreQuery = query(firestoreQuery, limit(queryParams.limit));
    }

    const snapshot = await getDocs(firestoreQuery);
    const data = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      // Convert Firestore timestamps to Date objects
      createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt,
      updatedAt: doc.data().updatedAt?.toDate?.() || doc.data().updatedAt,
    })) as T[];

    // Find the most recent updatedAt timestamp
    const lastUpdated = this.findMostRecentTimestamp(snapshot);

    // Cache the data
    this.cache.set(cacheKey, {
      data,
      timestamp: Date.now(),
      lastUpdated
    });

    console.log(`💾 Cache: Stored ${data.length} items for ${collectionName}`);
    return data;
  }

  // Get cached document data
  async getCachedDocument<T = any>(
    collectionName: string,
    docId: string,
    options: CacheOptions = {}
  ): Promise<T | null> {
    const { maxAge = this.DEFAULT_MAX_AGE, checkUpdatedBy = true } = options;
    const cacheKey = `${collectionName}_doc_${docId}`;
    
    console.log(`🗄️ Cache: Checking cache for document ${collectionName}/${docId}`);

    // Check if we have cached data
    const cached = this.cache.get(cacheKey);
    if (cached && this.isValidCacheEntry(cached, maxAge)) {
      if (checkUpdatedBy && cached.lastUpdated) {
        const docRef = doc(db, collectionName, docId);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const docUpdatedAt = docSnap.data().updatedAt;
          if (docUpdatedAt && docUpdatedAt.seconds > cached.lastUpdated.seconds) {
            console.log(`🔄 Cache: Document was updated, refreshing ${collectionName}/${docId}`);
          } else {
            console.log(`✅ Cache: Using cached document for ${collectionName}/${docId}`);
            return cached.data;
          }
        }
      } else {
        console.log(`✅ Cache: Using cached document for ${collectionName}/${docId}`);
        return cached.data;
      }
    }

    console.log(`🔄 Cache: Fetching fresh document for ${collectionName}/${docId}`);
    
    const docRef = doc(db, collectionName, docId);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) {
      return null;
    }

    const data = {
      id: docSnap.id,
      ...docSnap.data(),
      createdAt: docSnap.data().createdAt?.toDate?.() || docSnap.data().createdAt,
      updatedAt: docSnap.data().updatedAt?.toDate?.() || docSnap.data().updatedAt,
    } as T;

    // Cache the document
    this.cache.set(cacheKey, {
      data,
      timestamp: Date.now(),
      lastUpdated: docSnap.data().updatedAt || Timestamp.now()
    });

    console.log(`💾 Cache: Stored document ${collectionName}/${docId}`);
    return data;
  }

  // Check if there are any updates since the last cache
  private async checkForUpdates(
    collectionName: string, 
    lastUpdated: Timestamp, 
    queryParams?: any
  ): Promise<boolean> {
    try {
      // Query for documents updated after the cached timestamp
      let updateQuery = query(
        collection(db, collectionName),
        where('updatedAt', '>', lastUpdated),
        limit(1) // We only need to know if any updates exist
      );
      
      const updateSnapshot = await getDocs(updateQuery);
      return !updateSnapshot.empty;
    } catch (error) {
      console.warn(`Cache: Could not check for updates in ${collectionName}:`, error);
      return true; // If we can't check, assume there are updates
    }
  }

  // Find the most recent timestamp from a snapshot
  private findMostRecentTimestamp(snapshot: QuerySnapshot): Timestamp {
    let mostRecent = Timestamp.fromDate(new Date(0)); // Start with epoch
    
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      const updatedAt = data.updatedAt || data.createdAt;
      if (updatedAt && updatedAt.seconds > mostRecent.seconds) {
        mostRecent = updatedAt;
      }
    });
    
    return mostRecent.seconds === 0 ? Timestamp.now() : mostRecent;
  }

  // Clear cache for a specific collection
  clearCollectionCache(collectionName: string): void {
    const keysToDelete: string[] = [];
    
    this.cache.forEach((_, key) => {
      if (key.startsWith(collectionName)) {
        keysToDelete.push(key);
      }
    });
    
    keysToDelete.forEach(key => this.cache.delete(key));
    console.log(`🗑️ Cache: Cleared ${keysToDelete.length} entries for ${collectionName}`);
  }

  // Clear all cache
  clearAllCache(): void {
    const size = this.cache.size;
    this.cache.clear();
    console.log(`🗑️ Cache: Cleared all ${size} cache entries`);
  }

  // Get cache statistics
  getCacheStats() {
    return {
      totalEntries: this.cache.size,
      entries: Array.from(this.cache.entries()).map(([key, entry]) => ({
        key,
        timestamp: new Date(entry.timestamp),
        age: Date.now() - entry.timestamp,
        dataLength: Array.isArray(entry.data) ? entry.data.length : 1
      }))
    };
  }

  // Real-time listener with cache invalidation
  setupRealtimeListener<T = any>(
    collectionName: string,
    callback: (data: T[]) => void,
    queryParams?: {
      where?: Array<[string, any, any]>;
      orderBy?: [string, 'asc' | 'desc'];
      limit?: number;
    }
  ) {
    // Build query
    let firestoreQuery = collection(db, collectionName);
    
    if (queryParams?.where) {
      queryParams.where.forEach(([field, operator, value]) => {
        firestoreQuery = query(firestoreQuery, where(field, operator, value));
      });
    }
    
    if (queryParams?.orderBy) {
      const [field, direction] = queryParams.orderBy;
      firestoreQuery = query(firestoreQuery, orderBy(field, direction));
    }
    
    if (queryParams?.limit) {
      firestoreQuery = query(firestoreQuery, limit(queryParams.limit));
    }

    return onSnapshot(firestoreQuery, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt,
        updatedAt: doc.data().updatedAt?.toDate?.() || doc.data().updatedAt,
      })) as T[];

      // Update cache
      const cacheKey = this.generateCacheKey(collectionName, queryParams);
      const lastUpdated = this.findMostRecentTimestamp(snapshot);
      
      this.cache.set(cacheKey, {
        data,
        timestamp: Date.now(),
        lastUpdated
      });

      console.log(`🔄 Cache: Updated realtime data for ${collectionName}`);
      callback(data);
    });
  }
}

export const firebaseCache = new FirebaseCache();