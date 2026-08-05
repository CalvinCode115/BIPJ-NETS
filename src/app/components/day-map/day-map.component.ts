import { Component, Input, AfterViewInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
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
    }
    :host { display: block; }
  `],
  standalone: false
})
export class DayMapComponent implements AfterViewInit, OnDestroy {
  @ViewChild('mapContainer', { static: false }) mapContainer!: ElementRef;
  @Input() venues: any[] = [];
  @Input() routeDetails: any;
  
  private map: any;
  private markers: any[] = [];
  private polylines: any[] = [];
  private infoWindows: any[] = [];
  private mapId?: string;

  constructor(private mapsLoader: GoogleMapsLoaderService,
    private ngZone: NgZone) {}

  async ngAfterViewInit() {
    try {
      await this.mapsLoader.loadGoogleMaps();
      const config = await this.mapsLoader.getMapConfig().toPromise();
      this.mapId = config?.mapId;
      setTimeout(() => this.initMap(), 0);
    } catch (err) {
      console.error('Failed to load Google Maps:', err);
      this.showFallback();
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
    this.polylines.forEach(p => p.setMap(null));
    this.polylines = [];
    this.map = null;
  }

private async initMap() {
    const google = (window as any).google;
    if (!google?.maps) {
      this.showFallback();
      return;
    }

    const routeVenues = this.venues.filter(v => !v.isMeal);
    if (routeVenues.length === 0) {
      this.showFallback();
      return;
    }

    const center = this.getCenter(routeVenues);
    const bounds = new google.maps.LatLngBounds();

    // Run map creation OUTSIDE Angular zone to prevent touch event conflicts
    this.ngZone.runOutsideAngular(() => {
      // Create map WITH mapId
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
    });

    // Use AdvancedMarkerElement if mapId exists, else fallback to classic Marker
    if (this.mapId) {
      const { AdvancedMarkerElement } = await google.maps.importLibrary("marker");

      routeVenues.forEach((venue, index) => {
        const isStart = index === 0;
        const isEnd = index === routeVenues.length - 1;
        const color = isStart ? '#ef4444' : isEnd ? '#22c55e' : '#3b82f6';
        const label = String(index + 1);

        // Create pin element
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

        // Info window
        const infoWindow = new google.maps.InfoWindow({
          content: `
            <div style="padding: 8px; max-width: 200px; font-family: sans-serif;">
              <strong style="font-size: 14px;">${venue.name}</strong>
              <p style="margin: 4px 0 0; font-size: 12px; color: #666;">
                ${venue.startTime || ''} - ${venue.endTime || ''}
              </p>
              ${venue.locked ? '<span style="color: #dc2626; font-size: 11px;">🔒 Locked</span>' : ''}
            </div>
          `,
          pixelOffset: new google.maps.Size(0, -10)
        });

        // Use pointerdown instead of click for better touch response
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

    } else {
      // Fallback: Classic Marker (no mapId)
      routeVenues.forEach((venue, index) => {
        const isStart = index === 0;
        const isEnd = index === routeVenues.length - 1;
        const color = isStart ? '#ef4444' : isEnd ? '#22c55e' : '#3b82f6';
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
              ${venue.locked ? '<span style="color: #dc2626; font-size: 11px;">🔒 Locked</span>' : ''}
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

    // Draw route path (same for both) — also outside zone
    this.ngZone.runOutsideAngular(() => {
      if (this.routeDetails?.decodedPath?.length > 0) {
        const path = this.routeDetails.decodedPath.map((p: any) => ({
          lat: p.lat,
          lng: p.lng
        }));

        const polyline = new google.maps.Polyline({
          path,
          geodesic: true,
          strokeColor: '#34c759',
          strokeOpacity: 0.8,
          strokeWeight: 4,
          map: this.map
        });
        this.polylines.push(polyline);
      } else {
        const path = routeVenues.map(v => ({ lat: v.lat, lng: v.lng }));
        const polyline = new google.maps.Polyline({
          path,
          geodesic: true,
          strokeColor: '#34c759',
          strokeOpacity: 0.6,
          strokeWeight: 3,
          map: this.map
        });
        this.polylines.push(polyline);
      }

      this.map.fitBounds(bounds, { top: 50, right: 50, bottom: 50, left: 50 });
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