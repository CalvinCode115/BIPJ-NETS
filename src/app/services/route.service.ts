import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

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
        distance: string;
        duration: string;
        steps: {
            instruction: string;
            distance: string;
            duration: string;
        }[];
    }[];
    bounds: {
        northeast: { lat: number; lng: number };
        southwest: { lat: number; lng: number };
    };
}

@Injectable({ providedIn: 'root' })
export class RouteService {
    private readonly API_URL = 'http://localhost:8000/api';

    constructor(private http: HttpClient) { }

    getOptimizedRoute(
        origin: { lat: number; lng: number },
        destination: { lat: number; lng: number },
        waypoints: { lat: number; lng: number }[] = [],
        mode: 'walking' | 'driving' | 'transit' = 'walking'
    ): Observable<DirectionsResponse> {
        return this.http.post<DirectionsResponse>(`${this.API_URL}/directions`, {
            origin,
            destination,
            waypoints,
            mode,
            optimize: true
        });
    }

    // In route.service.ts — add polyline parameter
    getStaticMapUrl(
        center: { lat: number; lng: number },
        markers: { lat: number; lng: number }[],
        path?: { lat: number; lng: number }[],
        polyline?: string,  // Add encoded polyline
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
}