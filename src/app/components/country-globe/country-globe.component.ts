import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ModalController } from '@ionic/angular';
import { Subject } from 'rxjs';
import { takeUntil, debounceTime } from 'rxjs/operators';
import { CountryDataService, CountryInfo } from '../../services/country-data.service';

declare global {
  interface Window {
    Cesium: any;
  }
}

// Region colors for pins
const REGION_COLORS: { [key: string]: string } = {
  'Asia': '#FF6B6B',
  'Europe': '#4ECDC4',
  'Americas': '#45B7D1',
  'Africa': '#FFE66D',
  'Oceania': '#96CEB4',
  'Antarctic': '#DDA0DD'
};

const FEATURED_COLOR = '#d71920';

@Component({
  selector: 'app-country-globe',
  templateUrl: './country-globe.component.html',
  styleUrls: ['./country-globe.component.scss'],
  standalone: false
})
export class CountryGlobeComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('cesiumContainer', { static: false }) cesiumContainer!: ElementRef;

  Cesium = window.Cesium;
  viewer: any = null;

  allCountries: CountryInfo[] = [];
  filteredCountries: CountryInfo[] = [];
  visibleCountries: CountryInfo[] = [];
  searchQuery = '';
  selectedCountry: CountryInfo | null = null;
  isLoading = true;
  error: string | null = null;
  loadProgress = 0;
  hoveredCountry: CountryInfo | null = null;
  isFeaturedCollapsed = false;

  private destroy$ = new Subject<void>();
  private search$ = new Subject<string>();
  private entityMap = new Map<string, any>();
  private pulseEntities: any[] = [];

  // Progressive loading by region
  private regions = ['Asia', 'Europe', 'Americas', 'Africa', 'Oceania'];
  private loadedRegions = new Set<string>();
  private pendingPins: CountryInfo[] = [];

  constructor(
    private http: HttpClient,
    private modalCtrl: ModalController,
    public countryData: CountryDataService
  ) { }

  ngOnInit() {
    this.search$.pipe(
      takeUntil(this.destroy$),
      debounceTime(300)
    ).subscribe(query => this.doSearch(query));

    this.loadCountriesProgressive();
  }

  ngAfterViewInit() { }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.viewer) {
      this.viewer.destroy();
      this.viewer = null;
    }
  }

  loadCountriesProgressive() {
    this.isLoading = true;
    console.log('[Globe] Starting to load countries...');

    this.countryData.getAllCountries().pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (countries) => {
        console.log('[Globe] API returned countries:', countries.length);

        if (countries.length < 50) {
          console.warn('[Globe] API returned only', countries.length, 'countries, using fallback');
          this.allCountries = [...countries, ...this.getFallbackCountries()];
        } else {
          console.log('[Globe] Using API data:', countries.length, 'countries');
          this.allCountries = countries;
        }

        this.filteredCountries = [...this.allCountries];
        this.isLoading = false;
        this.loadProgress = 100;

        setTimeout(() => {
          this.initCesium();
          this.addPinsProgressive();
        }, 100);
      },
      error: (err) => {
        console.error('[Globe] Failed:', err);
        this.allCountries = this.getFallbackCountries();
        this.filteredCountries = [...this.allCountries];
        this.isLoading = false;

        setTimeout(() => {
          this.initCesium();
          this.addPinsProgressive();
        }, 100);
      }
    });
  }

  private addPinsProgressive() {
    const batchSize = 50;
    let index = 0;

    const addBatch = () => {
      const batch = this.allCountries.slice(index, index + batchSize);
      batch.forEach(country => this.addPin(country));
      index += batchSize;

      if (index < this.allCountries.length) {
        requestAnimationFrame(addBatch);
      } else {
        this.visibleCountries = [...this.allCountries];
        this.setupClickHandler();
        this.setupHoverHandler();
        this.startFeaturedPulse();
      }
    };

    addBatch();
  }

  initCesium() {
    if (!this.cesiumContainer?.nativeElement) {
      console.warn('[Globe] Container not ready');
      return;
    }
    if (!this.Cesium) {
      this.error = 'CesiumJS failed to load. Check internet connection.';
      return;
    }

    try {
      this.Cesium.Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJmMTBiZjkwNC0yMDVmLTQxMTUtYjQ3Mi1hOGE5MGY4MTM3NDIiLCJpZCI6NDU2NjkyLCJzdWIiOiJlcm9ua293IiwiaXNzIjoiaHR0cHM6Ly9hcGkuY2VzaXVtLmNvbSIsImF1ZCI6IlVudGl0bGVkIiwiaWF0IjoxNzg0MTA4NDc2fQ.iw_cB2rasq1ObO7pMTqkJYo3lBI-_pFO1-L5cRNFzM4';

      this.viewer = new this.Cesium.Viewer(this.cesiumContainer.nativeElement, {
        terrainProvider: new this.Cesium.EllipsoidTerrainProvider(),
        baseLayerPicker: false,
        geocoder: false,
        homeButton: false,
        sceneModePicker: false,
        navigationHelpButton: false,
        animation: false,
        timeline: false,
        fullscreenButton: false,
        vrButton: false,
        infoBox: false,
        selectionIndicator: false,
        skyBox: false,
        skyAtmosphere: false,
        shouldAnimate: false,
        orderIndependentTranslucency: false,
        contextOptions: {
          webgl: {
            alpha: false,
            antialias: true,
            preserveDrawingBuffer: true
          }
        }
      });

      // Try multiple tile providers, use first that works
      const tileProviders = [
        {
          name: 'CartoDB Voyager',
          provider: new this.Cesium.UrlTemplateImageryProvider({
            url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
            subdomains: ['a', 'b', 'c', 'd'],
            minimumLevel: 0,
            maximumLevel: 18
          })
        },
        {
          name: 'OpenStreetMap',
          provider: new this.Cesium.OpenStreetMapImageryProvider({
            url: 'https://tile.openstreetmap.org/'
          })
        },
        {
          name: 'Natural Earth',
          provider: new this.Cesium.UrlTemplateImageryProvider({
            url: 'https://naturalearthtiles.com/tiles/naturalearth/{z}/{x}/{y}.png',
            minimumLevel: 0,
            maximumLevel: 6
          })
        }
      ];

      // Add the first provider as base layer
      let baseLayerAdded = false;
      for (const tp of tileProviders) {
        try {
          this.viewer.imageryLayers.addImageryProvider(tp.provider);
          console.log('[Globe] Using tile provider:', tp.name);
          baseLayerAdded = true;
          break;
        } catch (e) {
          console.warn('[Globe] Tile provider failed:', tp.name, e);
        }
      }

      // If no tiles loaded, use a simple color material to show land/sea
      if (!baseLayerAdded) {
        console.warn('[Globe] No tile providers worked, using color-coded globe');
        this.viewer.scene.globe.imageryLayers.removeAll();
        this.viewer.scene.globe.material = new this.Cesium.ColorMaterialProperty(
          this.Cesium.Color.fromCssColorString('#2E8B57') // Sea green base
        );
      }

      const widget = this.cesiumContainer.nativeElement.querySelector('.cesium-viewer');
      if (widget) {
        const toolbar = widget.querySelector('.cesium-viewer-toolbar');
        if (toolbar) toolbar.style.display = 'none';
        const credits = widget.querySelector('.cesium-viewer-bottom');
        if (credits) credits.style.display = 'none';
      }

      this.viewer.scene.screenSpaceCameraController.enableZoom = true;
      this.viewer.scene.screenSpaceCameraController.enableTilt = true;
      this.viewer.scene.screenSpaceCameraController.enableLook = true;
      this.viewer.scene.screenSpaceCameraController.minimumZoomDistance = 1000000;
      this.viewer.scene.screenSpaceCameraController.maximumZoomDistance = 50000000;

      this.viewer.scene.globe.enableLighting = false;
      this.viewer.scene.globe.dynamicAtmosphereLighting = false;
      this.viewer.scene.globe.dynamicAtmosphereLightingFromSun = false;
      this.viewer.scene.globe.baseColor = this.Cesium.Color.fromCssColorString('#1E90FF');
      this.viewer.scene.backgroundColor = this.Cesium.Color.fromCssColorString('#0a0a1a');
      this.viewer.scene.globe.depthTestAgainstTerrain = false;
      this.viewer.scene.globe.depthTestAgainstTerrain = false;

      this.flyTo(20, 0, 25000000, 0);

    } catch (e: any) {
      console.error('[Globe] Cesium init failed:', e);
      this.error = 'Could not initialize 3D globe.';
    }
  }

  addPin(country: CountryInfo) {
    if (!this.viewer) return;

    const isRich = this.countryData.isRich(country.id);
    const regionColor = REGION_COLORS[country.region] || '#888888';
    const color = isRich ? FEATURED_COLOR : regionColor;
    const size = isRich ? 14 : 6;
    const outlineWidth = isRich ? 3 : 1;

    const entity = this.viewer.entities.add({
      position: this.Cesium.Cartesian3.fromDegrees(country.lon, country.lat),
      point: {
        pixelSize: size,
        color: this.Cesium.Color.fromCssColorString(color),
        outlineColor: this.Cesium.Color.WHITE,
        outlineWidth: outlineWidth,
        heightReference: this.Cesium.HeightReference.CLAMP_TO_GROUND,
        scaleByDistance: new this.Cesium.NearFarScalar(1000000, 2.0, 50000000, 0.5)
      },
      label: {
        text: country.flag + ' ' + country.country,
        font: isRich ? 'bold 14px sans-serif' : '12px sans-serif',
        fillColor: this.Cesium.Color.WHITE,
        outlineColor: this.Cesium.Color.BLACK,
        outlineWidth: 2,
        style: this.Cesium.LabelStyle.FILL_AND_OUTLINE,
        verticalOrigin: this.Cesium.VerticalOrigin.BOTTOM,
        pixelOffset: new this.Cesium.Cartesian2(0, -12),
        show: false,
        scaleByDistance: new this.Cesium.NearFarScalar(2000000, 1.5, 10000000, 0.8)
      },
      properties: { country }
    });

    this.entityMap.set(country.id, entity);

    // For featured countries, add a larger glow ring
    if (isRich) {
      const glow = this.viewer.entities.add({
        position: this.Cesium.Cartesian3.fromDegrees(country.lon, country.lat),
        point: {
          pixelSize: size + 8,
          color: this.Cesium.Color.fromCssColorString(color).withAlpha(0.3),
          outlineColor: this.Cesium.Color.TRANSPARENT,
          outlineWidth: 0,
          heightReference: this.Cesium.HeightReference.CLAMP_TO_GROUND
        }
      });
      this.pulseEntities.push({ entity: glow, baseSize: size + 8, country });
    }
  }

  setupClickHandler() {
    if (!this.viewer) return;

    const handler = new this.Cesium.ScreenSpaceEventHandler(this.viewer.canvas);

    handler.setInputAction((click: any) => {
      const picked = this.viewer.scene.pick(click.position);
      if (picked && picked.id && picked.id.properties) {
        const c = picked.id.properties.country.getValue();
        this.selectCountry(c);
      }
    }, this.Cesium.ScreenSpaceEventType.LEFT_CLICK);
  }

  setupHoverHandler() {
    if (!this.viewer) return;

    const handler = new this.Cesium.ScreenSpaceEventHandler(this.viewer.canvas);

    handler.setInputAction((movement: any) => {
      const picked = this.viewer.scene.pick(movement.endPosition);

      // Reset all labels
      this.entityMap.forEach(entity => {
        if (entity.label) entity.label.show = false;
        if (entity.point) {
          entity.point.outlineWidth = this.countryData.isRich(entity.properties.country.getValue().id) ? 3 : 1;
        }
      });

      if (picked && picked.id && picked.id.properties) {
        const country = picked.id.properties.country.getValue();
        this.hoveredCountry = country;

        if (picked.id.label) {
          picked.id.label.show = true;
        }
        if (picked.id.point) {
          picked.id.point.outlineWidth = 4;
          picked.id.point.outlineColor = this.Cesium.Color.YELLOW;
        }
      } else {
        this.hoveredCountry = null;
      }
    }, this.Cesium.ScreenSpaceEventType.MOUSE_MOVE);
  }

  startFeaturedPulse() {
    // Pulse animation for featured countries
    const pulse = () => {
      const time = Date.now() / 1000;
      this.pulseEntities.forEach((item: any) => {
        const scale = 1 + Math.sin(time * 2 + item.country.lat) * 0.3;
        if (item.entity && item.entity.point) {
          item.entity.point.pixelSize = item.baseSize * scale;
        }
      });
      requestAnimationFrame(pulse);
    };
    pulse();
  }

  flyTo(lat: number, lon: number, height: number = 2000000, duration: number = 1.5) {
    if (!this.viewer) return;
    this.viewer.camera.flyTo({
      destination: this.Cesium.Cartesian3.fromDegrees(lon, lat, height),
      duration: duration,
      easingFunction: this.Cesium.EasingFunction.QUAD_OUT
    });
  }

  selectCountry(country: CountryInfo) {
    this.selectedCountry = country;
    this.flyTo(country.lat, country.lon, 1500000);
  }

  onSearchInput(event: any) {
    const query = (event.target.value || '').toLowerCase().trim();
    this.searchQuery = query;
    this.search$.next(query);
  }

  private doSearch(query: string) {
    if (!query) {
      this.filteredCountries = [...this.allCountries];
      // Reset all pins to normal
      this.entityMap.forEach((entity, id) => {
        const country = this.allCountries.find(c => c.id === id);
        const isRich = country ? this.countryData.isRich(country.id) : false;
        const regionColor = country ? (REGION_COLORS[country.region] || '#888888') : '#888888';
        if (entity.point) {
          entity.point.color = this.Cesium.Color.fromCssColorString(isRich ? FEATURED_COLOR : regionColor);
          entity.point.pixelSize = isRich ? 14 : 6;
        }
        if (entity.label) entity.label.show = false;
      });
      return;
    }

    this.filteredCountries = this.allCountries.filter(c =>
      c.country.toLowerCase().includes(query) ||
      c.name.toLowerCase().includes(query) ||
      c.currencyCode.toLowerCase().includes(query)
    );

    // Highlight matching pins, dim others
    this.entityMap.forEach((entity, id) => {
      const match = this.filteredCountries.some(c => c.id === id);
      if (entity.point) {
        if (match) {
          entity.point.color = this.Cesium.Color.fromCssColorString('#FFFFFF');
          entity.point.pixelSize = this.countryData.isRich(id) ? 18 : 10;
          entity.point.outlineColor = this.Cesium.Color.fromCssColorString('#d71920');
          entity.point.outlineWidth = 3;
        } else {
          const country = this.allCountries.find(c => c.id === id);
          const isRich = country ? this.countryData.isRich(country.id) : false;
          const regionColor = country ? (REGION_COLORS[country.region] || '#888888') : '#888888';
          entity.point.color = this.Cesium.Color.fromCssColorString(isRich ? FEATURED_COLOR : regionColor).withAlpha(0.2);
          entity.point.pixelSize = isRich ? 14 : 4;
          entity.point.outlineColor = this.Cesium.Color.WHITE;
          entity.point.outlineWidth = isRich ? 3 : 1;
        }
      }
      if (entity.label) {
        entity.label.show = match;
      }
    });

    // Fly to first match
    if (this.filteredCountries.length > 0) {
      this.flyTo(this.filteredCountries[0].lat, this.filteredCountries[0].lon, 4000000);
    }
  }

  clearSearch() {
    this.searchQuery = '';
    this.filteredCountries = [...this.allCountries];
    this.entityMap.forEach((entity, id) => {
      const country = this.allCountries.find(c => c.id === id);
      const isRich = country ? this.countryData.isRich(country.id) : false;
      const regionColor = country ? (REGION_COLORS[country.region] || '#888888') : '#888888';
      if (entity.point) {
        entity.point.color = this.Cesium.Color.fromCssColorString(isRich ? FEATURED_COLOR : regionColor);
        entity.point.pixelSize = isRich ? 14 : 6;
        entity.point.outlineColor = this.Cesium.Color.WHITE;
        entity.point.outlineWidth = isRich ? 3 : 1;
      }
      if (entity.label) entity.label.show = false;
    });
  }

  confirmSelection() {
    if (!this.selectedCountry) return;
    this.modalCtrl.dismiss(this.selectedCountry);
  }

  dismiss() {
    this.modalCtrl.dismiss();
  }

  selectFromSidebar(country: CountryInfo) {
    this.selectCountry(country);
  }

  get featuredCountries(): CountryInfo[] {
    return this.allCountries.filter(c => this.countryData.isRich(c.id));
  }

  getRegionColor(region: string): string {
    return REGION_COLORS[region] || '#888888';
  }

  getDistanceFromSingapore(country: CountryInfo): string {
    // Singapore: 1.35, 103.8
    const R = 6371; // Earth's radius in km
    const lat1 = 1.35 * Math.PI / 180;
    const lat2 = country.lat * Math.PI / 180;
    const dLat = (country.lat - 1.35) * Math.PI / 180;
    const dLon = (country.lon - 103.8) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1) * Math.cos(lat2) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    if (distance < 1000) return Math.round(distance) + ' km';
    return (distance / 1000).toFixed(1) + 'k km';
  }

  private getFallbackCountries(): CountryInfo[] {
    return [
      { id: 'sg', name: 'Singapore', country: 'Singapore', lat: 1.35, lon: 103.8, currencyCode: 'SGD', flag: '🇸🇬', region: 'Asia' },
      { id: 'us', name: 'Washington D.C.', country: 'United States', lat: 38.9, lon: -77.0, currencyCode: 'USD', flag: '🇺🇸', region: 'Americas' },
      { id: 'gb', name: 'London', country: 'United Kingdom', lat: 51.5, lon: -0.1, currencyCode: 'GBP', flag: '🇬🇧', region: 'Europe' },
      { id: 'fr', name: 'Paris', country: 'France', lat: 48.8, lon: 2.3, currencyCode: 'EUR', flag: '🇫🇷', region: 'Europe' },
      { id: 'de', name: 'Berlin', country: 'Germany', lat: 52.5, lon: 13.4, currencyCode: 'EUR', flag: '🇩🇪', region: 'Europe' },
      { id: 'it', name: 'Rome', country: 'Italy', lat: 41.9, lon: 12.5, currencyCode: 'EUR', flag: '🇮🇹', region: 'Europe' },
      { id: 'es', name: 'Madrid', country: 'Spain', lat: 40.4, lon: -3.7, currencyCode: 'EUR', flag: '🇪🇸', region: 'Europe' },
      { id: 'cn', name: 'Beijing', country: 'China', lat: 39.9, lon: 116.4, currencyCode: 'CNY', flag: '🇨🇳', region: 'Asia' },
      { id: 'in', name: 'New Delhi', country: 'India', lat: 28.6, lon: 77.2, currencyCode: 'INR', flag: '🇮🇳', region: 'Asia' },
      { id: 'id', name: 'Jakarta', country: 'Indonesia', lat: -6.2, lon: 106.8, currencyCode: 'IDR', flag: '🇮🇩', region: 'Asia' },
      { id: 'ph', name: 'Manila', country: 'Philippines', lat: 14.5, lon: 120.9, currencyCode: 'PHP', flag: '🇵🇭', region: 'Asia' },
      { id: 'vn', name: 'Hanoi', country: 'Vietnam', lat: 21.0, lon: 105.8, currencyCode: 'VND', flag: '🇻🇳', region: 'Asia' },
      { id: 'br', name: 'Brasília', country: 'Brazil', lat: -15.7, lon: -47.9, currencyCode: 'BRL', flag: '🇧🇷', region: 'Americas' },
      { id: 'ca', name: 'Ottawa', country: 'Canada', lat: 45.4, lon: -75.7, currencyCode: 'CAD', flag: '🇨🇦', region: 'Americas' },
      { id: 'mx', name: 'Mexico City', country: 'Mexico', lat: 19.4, lon: -99.1, currencyCode: 'MXN', flag: '🇲🇽', region: 'Americas' },
      { id: 'ar', name: 'Buenos Aires', country: 'Argentina', lat: -34.6, lon: -58.3, currencyCode: 'ARS', flag: '🇦🇷', region: 'Americas' },
      { id: 'za', name: 'Pretoria', country: 'South Africa', lat: -25.7, lon: 28.2, currencyCode: 'ZAR', flag: '🇿🇦', region: 'Africa' },
      { id: 'eg', name: 'Cairo', country: 'Egypt', lat: 30.0, lon: 31.2, currencyCode: 'EGP', flag: '🇪🇬', region: 'Africa' },
      { id: 'ng', name: 'Abuja', country: 'Nigeria', lat: 9.0, lon: 7.4, currencyCode: 'NGN', flag: '🇳🇬', region: 'Africa' },
      { id: 'ke', name: 'Nairobi', country: 'Kenya', lat: -1.2, lon: 36.8, currencyCode: 'KES', flag: '🇰🇪', region: 'Africa' },
      { id: 'nz', name: 'Wellington', country: 'New Zealand', lat: -41.2, lon: 174.7, currencyCode: 'NZD', flag: '🇳🇿', region: 'Oceania' },
      { id: 'fj', name: 'Suva', country: 'Fiji', lat: -18.1, lon: 178.4, currencyCode: 'FJD', flag: '🇫🇯', region: 'Oceania' },
      { id: 'ru', name: 'Moscow', country: 'Russia', lat: 55.7, lon: 37.6, currencyCode: 'RUB', flag: '🇷🇺', region: 'Europe' },
      { id: 'tr', name: 'Ankara', country: 'Turkey', lat: 39.9, lon: 32.8, currencyCode: 'TRY', flag: '🇹🇷', region: 'Asia' },
      { id: 'ae', name: 'Abu Dhabi', country: 'United Arab Emirates', lat: 24.4, lon: 54.3, currencyCode: 'AED', flag: '🇦🇪', region: 'Asia' },
      { id: 'sa', name: 'Riyadh', country: 'Saudi Arabia', lat: 24.7, lon: 46.6, currencyCode: 'SAR', flag: '🇸🇦', region: 'Asia' },
      { id: 'kr', name: 'Seoul', country: 'South Korea', lat: 37.5, lon: 126.9, currencyCode: 'KRW', flag: '🇰🇷', region: 'Asia' },
      { id: 'jp', name: 'Tokyo', country: 'Japan', lat: 35.6, lon: 139.6, currencyCode: 'JPY', flag: '🇯🇵', region: 'Asia' },
      { id: 'my', name: 'Kuala Lumpur', country: 'Malaysia', lat: 3.1, lon: 101.6, currencyCode: 'MYR', flag: '🇲🇾', region: 'Asia' },
      { id: 'th', name: 'Bangkok', country: 'Thailand', lat: 13.7, lon: 100.5, currencyCode: 'THB', flag: '🇹🇭', region: 'Asia' },
      { id: 'au', name: 'Canberra', country: 'Australia', lat: -35.2, lon: 149.1, currencyCode: 'AUD', flag: '🇦🇺', region: 'Oceania' },
    ];
  }

  toggleFeatured() {
    this.isFeaturedCollapsed = !this.isFeaturedCollapsed;
  }
}