import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface DirectionsResponse {
    status: string;
    optimizedOrder: number[];
    totalDistance: number;  // meters
    totalDuration: number;  // seconds
    polyline: string;
    decodedPath: { lat: number; lng: number }[];
    legs: {
        start: { lat: number; lng: number };
        end: { lat: number; lng: number };
        distance: string;      // ← text like "295 m"
        duration: string;      // ← text like "4 mins" (BACKEND RETURNS STRING)
        steps: {
            instruction: string;
            distance: string;
            duration: string;
        }[];
    }[];
    url?: string;
    bounds: {
        northeast: { lat: number; lng: number };
        southwest: { lat: number; lng: number };
    };
}

@Injectable({ providedIn: 'root' })
export class RouteService {
    private readonly API_URL = environment.pyApiUrl;

    constructor(private http: HttpClient) { }

    getOptimizedRoute(origin: any, destination: any, waypoints: any[], mode: string = 'driving') {
        return this.http.post<DirectionsResponse>(`${this.API_URL}/directions`, {
            origin,
            destination,
            waypoints,
            mode,              // ← 'driving' passed through
            optimize: true
        }).pipe(
            catchError(err => {
                console.log('Driving failed, falling back to walking:', err);
                return this.http.post<DirectionsResponse>(`${this.API_URL}/directions`, {
                    origin,
                    destination,
                    waypoints,
                    mode: 'walking',
                    optimize: true
                });
            })
        );
    }

    getStaticMapUrl(
        center: { lat: number; lng: number },
        markers: { lat: number; lng: number }[],
        path?: { lat: number; lng: number }[],
        polyline?: string,
        zoom: number = 14,
        width: number = 600,
        height: number = 300
    ): string {
        const markersStr = markers.map(m => `${m.lat},${m.lng}`).join('|');

        let url = `${this.API_URL}/map/static?center_lat=${center.lat}&center_lng=${center.lng}&zoom=${zoom}&width=${width}&height=${height}&markers=${markersStr}`;

        if (polyline) {
            url += `&polyline=${encodeURIComponent(polyline)}`;
        } else if (path) {
            const pathStr = path.map(m => `${m.lat},${m.lng}`).join('|');
            url += `&path=${pathStr}`;
        }

        return url;
    }

    getDirectionsUrl(
        origin: { lat: number; lng: number },
        destination: { lat: number; lng: number },
        waypoints: { lat: number; lng: number }[] = []
    ): Observable<{ url: string }> {
        const wp = waypoints.map(w => `${w.lat},${w.lng}`).join('|');
        return this.http.get<{ url: string }>(
            `${this.API_URL}/map/directions-url?origin_lat=${origin.lat}&origin_lng=${origin.lng}&dest_lat=${destination.lat}&dest_lng=${destination.lng}&waypoints=${wp}`
        );
    }

    // NEW: Search for places near a specific point
    searchNearbyPoint(lat: number, lng: number, keyword: string, radius: number = 2000): Observable<any[]> {
        return this.http.get<any>(`${this.API_URL}/places/nearby-point`, {
            params: {
                lat: lat.toString(),
                lng: lng.toString(),
                keyword,
                radius: radius.toString(),
                max_results: '5'
            }
        }).pipe(
            catchError(err => {
                console.warn(`Nearby search failed for ${keyword} at ${lat},${lng}:`, err);
                return new Observable<any[]>(observer => {
                    observer.next([]);
                    observer.complete();
                });
            })
        );
    }
}