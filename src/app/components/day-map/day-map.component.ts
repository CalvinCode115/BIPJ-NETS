import { Component, Input, AfterViewInit, OnDestroy, OnChanges, SimpleChanges, ViewChild, ElementRef } from '@angular/core';
import { GoogleMapsLoaderService } from '../../services/google-maps-loader.service';
import { NgZone } from '@angular/core';

@Component({
  selector: 'app-day-map',
  template: `<div #mapContainer class="map-container"></div>`,
  styles: [`
    .map-container {
      width: 100%;
      height: 400px;
      border-radius: 20px;
      overflow: hidden;
      background: #f1f5f9;
    }
    :host { display: block; }
  `],
  standalone: false
})
export class DayMapComponent implements AfterViewInit, OnDestroy, OnChanges {
  @ViewChild('mapContainer', { static: false }) mapContainer!: ElementRef;
  @Input() venues: any[] = [];
  @Input() routeDetails: any;
  @Input() day: number = 0;

  private map: any;
  private markers: any[] = [];
  private polylines: any[] = [];
  private infoWindows: any[] = [];
  private mapId?: string;
  private isInitialized = false;

  constructor(private mapsLoader: GoogleMapsLoaderService, private ngZone: NgZone) { }

  async ngAfterViewInit() {
    try {
      await this.mapsLoader.loadGoogleMaps();
      const config = await this.mapsLoader.getMapConfig().toPromise();
      this.mapId = config?.mapId;
      this.isInitialized = true;
      this.initMap();
    } catch (err) {
      console.error('Failed to load Google Maps:', err);
      this.showFallback();
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    // Only re-init if we have a map container and Google Maps is loaded
    if (this.isInitialized && this.mapContainer?.nativeElement) {
      console.log('Map inputs changed:', {
        venues: this.venues?.length,
        routeDetails: this.routeDetails?.status,
        venueNames: this.venues?.map((v: any) => v.name)
      });

      // Always cleanup and re-init on changes
      this.cleanup();
      // Small delay to ensure DOM is ready
      setTimeout(() => this.initMap(), 100);
    }
  }

  ngOnDestroy() {
    this.cleanup();
  }

  private cleanup() {
    this.infoWindows.forEach(iw => iw.close());
    this.infoWindows = [];

    this.markers.forEach(m => {
      if (m.map) m.map = null;
    });
    this.markers = [];

    this.polylines.forEach(p => {
      if (p.setMap) p.setMap(null);
    });
    this.polylines = [];

    // Don't null out the map itself, just clear overlays
    // this.map = null;
  }

  private async initMap() {
    const google = (window as any).google;
    if (!google?.maps) {
      this.showFallback();
      return;
    }

    if (!this.mapContainer?.nativeElement) {
      console.warn('Map container not available');
      return;
    }

    const seenCoords = new Set<string>();
    const validVenues = this.venues.filter((v: any) => {
      if (!v || typeof v.lat !== 'number' || typeof v.lng !== 'number' ||
        isNaN(v.lat) || isNaN(v.lng)) return false;
      if (v.isPlaceholder) return false; // ← Skip placeholders entirely
      return true;
    });

    if (validVenues.length === 0) {
      console.warn('No valid venues for map');
      this.showFallback();
      return;
    }

    console.log(`Rendering map with ${validVenues.length} venues:`, validVenues.map((v: any) => v.name));

    const center = this.getCenter(validVenues);
    const bounds = new google.maps.LatLngBounds();

    // Create or reuse map
    this.ngZone.runOutsideAngular(() => {
      if (!this.map) {
        this.map = new google.maps.Map(this.mapContainer.nativeElement, {
          center: { lat: center.lat, lng: center.lng },
          zoom: 14,
          mapTypeId: 'roadmap',
          mapId: this.mapId,
          mapTypeControl: false,
          fullscreenControl: false,
          streetViewControl: false,
          zoomControl: true,
          zoomControlOptions: {
            position: google.maps.ControlPosition.RIGHT_TOP
          },
          gestureHandling: 'greedy',
        });
      } else {
        // Just recenter existing map
        this.map.setCenter({ lat: center.lat, lng: center.lng });
      }
    });

    // Use AdvancedMarkerElement if mapId exists
    if (this.mapId) {
      try {
        const { AdvancedMarkerElement } = await google.maps.importLibrary("marker");

        validVenues.forEach((venue: any, index: number) => {
          const isStart = index === 0;
          const isEnd = index === validVenues.length - 1;
          const color = venue.isPlaceholder ? '#f59e0b' :  // Orange for placeholder
            isStart ? '#ef4444' :
              isEnd ? '#22c55e' :
                '#3b82f6';
          const label = String(index + 1);

          const pinElement = document.createElement('div');
          pinElement.innerHTML = `
            <div style="
              width: 32px;
              height: 32px;
              border-radius: 50%;
              background: ${color};
              border: 3px solid white;
              box-shadow: 0 2px 6px rgba(0,0,0,0.3);
              display: flex;
              align-items: center;
              justify-content: center;
              color: white;
              font-weight: bold;
              font-size: 14px;
              font-family: sans-serif;
            ">${label}</div>
          `;

          const marker = new AdvancedMarkerElement({
            map: this.map,
            position: { lat: venue.lat, lng: venue.lng },
            content: pinElement,
            title: venue.name,
          });

          const infoWindow = new google.maps.InfoWindow({
            content: `
              <div style="padding: 8px; max-width: 200px; font-family: sans-serif;">
                <strong style="font-size: 14px;">${venue.name}</strong>
                <p style="margin: 4px 0 0; font-size: 12px; color: #666;">
                  ${venue.startTime || ''} - ${venue.endTime || ''}
                </p>
                ${venue.isDnaSuggestion ? '<span style="color: #3b82f6; font-size: 11px;">📍 Nearby Find</span>' : ''}
                ${venue.isPlaceholder ? '<span style="color: #f59e0b; font-size: 11px;">⚠️ Placeholder</span>' : ''}
              </div>
            `,
            pixelOffset: new google.maps.Size(0, -10)
          });

          pinElement.addEventListener('pointerdown', (e: Event) => {
            e.stopPropagation();
            this.ngZone.run(() => {
              this.infoWindows.forEach(iw => iw.close());
              infoWindow.open(this.map, marker);
            });
          });

          this.markers.push(marker);
          this.infoWindows.push(infoWindow);
          bounds.extend({ lat: venue.lat, lng: venue.lng });
        });
      } catch (err) {
        console.error('AdvancedMarkerElement failed, falling back:', err);
        this.renderClassicMarkers(validVenues, bounds);
      }
    } else {
      this.renderClassicMarkers(validVenues, bounds);
    }

    // Draw route path
    this.ngZone.runOutsideAngular(() => {
      // Clear old polylines first
      this.polylines.forEach(p => p.setMap(null));
      this.polylines = [];

      let path: { lat: number; lng: number }[];

      if (this.routeDetails?.decodedPath?.length > 0) {
        path = this.routeDetails.decodedPath.map((p: any) => ({
          lat: p.lat,
          lng: p.lng
        }));
      } else {
        path = validVenues.map((v: any) => ({ lat: v.lat, lng: v.lng }));
      }

      const polyline = new google.maps.Polyline({
        path,
        geodesic: true,
        strokeColor: '#34c759',
        strokeOpacity: 0.8,
        strokeWeight: 4,
        map: this.map
      });
      this.polylines.push(polyline);

      // Fit bounds with padding
      if (validVenues.length > 1) {
        this.map.fitBounds(bounds, { top: 50, right: 50, bottom: 50, left: 50 });
      } else {
        this.map.setZoom(15);
      }
    });
  }

  private renderClassicMarkers(venues: any[], bounds: any) {
    const google = (window as any).google;

    venues.forEach((venue: any, index: number) => {
      const isStart = index === 0;
      const isEnd = index === venues.length - 1;
      const color = venue.isPlaceholder ? '#f59e0b' : isStart ? '#ef4444' : isEnd ? '#22c55e' : '#3b82f6';
      const label = String(index + 1);

      const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36">
          <circle cx="18" cy="18" r="14" fill="${color}" stroke="white" stroke-width="3"/>
          <text x="18" y="23" text-anchor="middle" fill="white" font-size="14" font-weight="bold" font-family="sans-serif">${label}</text>
        </svg>
      `;

      const marker = new google.maps.Marker({
        position: { lat: venue.lat, lng: venue.lng },
        map: this.map,
        icon: {
          url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
          scaledSize: new google.maps.Size(36, 36),
          anchor: new google.maps.Point(18, 18)
        },
        title: venue.name,
      });

      const infoWindow = new google.maps.InfoWindow({
        content: `
          <div style="padding: 8px; max-width: 200px; font-family: sans-serif;">
            <strong style="font-size: 14px;">${venue.name}</strong>
            <p style="margin: 4px 0 0; font-size: 12px; color: #666;">
              ${venue.startTime || ''} - ${venue.endTime || ''}
            </p>
          </div>
        `,
        pixelOffset: new google.maps.Size(0, -10)
      });

      marker.addListener('click', () => {
        this.ngZone.run(() => {
          this.infoWindows.forEach(iw => iw.close());
          infoWindow.open(this.map, marker);
        });
      });

      this.markers.push(marker);
      this.infoWindows.push(infoWindow);
      bounds.extend({ lat: venue.lat, lng: venue.lng });
    });
  }

  private getCenter(points: { lat: number; lng: number }[]): { lat: number; lng: number } {
    const avgLat = points.reduce((s, p) => s + p.lat, 0) / points.length;
    const avgLng = points.reduce((s, p) => s + p.lng, 0) / points.length;
    return { lat: avgLat, lng: avgLng };
  }

  private showFallback() {
    if (!this.mapContainer?.nativeElement) return;
    this.mapContainer.nativeElement.innerHTML = `
      <div style="
        display: flex; 
        align-items: center; 
        justify-content: center; 
        height: 100%; 
        background: #f1f5f9; 
        border-radius: 20px;
      ">
        <p style="color: #64748b;">Map unavailable. Check connection.</p>
      </div>
    `;
  }
}