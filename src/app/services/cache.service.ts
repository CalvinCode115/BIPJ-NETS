import { Injectable } from '@angular/core';

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  countryId: string;
}

@Injectable({
  providedIn: 'root'
})
export class CacheService {
  private readonly TTL_MS = 60 * 60 * 1000; // 1 hour
  private memoryCache: Map<string, any> = new Map();

  get<T>(key: string): T | null {
    // Check memory first
    const mem = this.memoryCache.get(key);
    if (mem && !this.isExpired(mem)) {
      return mem.data;
    }

    // Check localStorage
    const stored = localStorage.getItem(key);
    if (stored) {
      try {
        const parsed: CacheEntry<T> = JSON.parse(stored);
        if (!this.isExpired(parsed)) {
          // Promote to memory
          this.memoryCache.set(key, parsed);
          return parsed.data;
        }
      } catch {
        // Invalid cache, clear it
        localStorage.removeItem(key);
      }
    }
    return null;
  }

  set<T>(key: string, data: T, countryId: string): void {
    const entry: CacheEntry<T> = { data, timestamp: Date.now(), countryId };
    this.memoryCache.set(key, entry);
    localStorage.setItem(key, JSON.stringify(entry));
  }

  clear(countryId?: string): void {
    if (countryId) {
      // Clear only entries for this country
      for (const [key, entry] of this.memoryCache) {
        if (entry.countryId === countryId) {
          this.memoryCache.delete(key);
          localStorage.removeItem(key);
        }
      }
    } else {
      this.memoryCache.clear();
      // Only clear our keys
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key?.startsWith('nets_')) {
          localStorage.removeItem(key);
        }
      }
    }
  }

  private isExpired(entry: CacheEntry<any>): boolean {
    return Date.now() - entry.timestamp > this.TTL_MS;
  }

  // Helper to build cache keys
  key(type: string, countryId: string): string {
    return `nets_${type}_${countryId}`;
  }
}