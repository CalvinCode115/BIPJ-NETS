import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class GoogleMapsLoaderService {
  private scriptLoaded = false;
  private loadPromise: Promise<void> | null = null;

  constructor(private http: HttpClient) {}

  loadGoogleMaps(): Promise<void> {
    if (this.scriptLoaded) return Promise.resolve();
    if ((window as any).google?.maps) {
      this.scriptLoaded = true;
      return Promise.resolve();
    }
    if (this.loadPromise) return this.loadPromise;

    this.loadPromise = new Promise((resolve, reject) => {
      this.http.get<{ apiKey: string; libraries: string }>(`${environment.pyApiUrl}/config/google-maps-key`)
        .pipe(catchError(() => of(null)))
        .subscribe({
          next: (config) => {
            if (!config?.apiKey) {
              reject(new Error('Failed to load Google Maps API key'));
              return;
            }

            // Use modern loader with async + defer
            const script = document.createElement('script');
            script.src = `https://maps.googleapis.com/maps/api/js?key=${config.apiKey}&loading=async&callback=__googleMapsInit`;
            script.async = true;
            script.defer = true;

            (window as any).__googleMapsInit = () => {
              this.scriptLoaded = true;
              resolve();
              // Clean up global callback
              delete (window as any).__googleMapsInit;
            };

            script.onerror = () => {
              reject(new Error('Failed to load Google Maps script'));
              delete (window as any).__googleMapsInit;
            };

            document.head.appendChild(script);
          },
          error: reject
        });
    });

    return this.loadPromise;
  }

  // google-maps-loader.service.ts
private mapConfig: { apiKey: string; mapId?: string } | null = null;

getMapConfig(): Observable<{ apiKey: string; mapId?: string }> {
    if (this.mapConfig) return of(this.mapConfig);
    
    return this.http.get<{ apiKey: string; mapId?: string }>(`${environment.pyApiUrl}/config/google-maps-key`)
        .pipe(
            map(config => {
                this.mapConfig = config;
                return config;
            })
        );
}
}