import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { WeatherData } from '../travel/travel.model';

@Injectable({
  providedIn: 'root'
})
export class WeatherService {
  // === CONFIG: Replace with your OpenWeatherMap API key ===
  private readonly WEATHER_API_KEY = '712036520da649d45a9d37ff66292afa';
  private readonly API_URL = 'https://api.openweathermap.org/data/2.5/weather';

  // Johor Bahru coordinates
  private readonly DESTINATION = {
    lat: 1.4927,
    lon: 103.7414,
    name: 'Johor Bahru'
  };

  constructor(private http: HttpClient) {}

  getWeather(): Observable<WeatherData> {

    return this.http.get<any>(
      `${this.API_URL}?lat=${this.DESTINATION.lat}&lon=${this.DESTINATION.lon}&appid=${this.WEATHER_API_KEY}&units=metric`
    ).pipe(
      map(res => ({
        temp: Math.round(res.main.temp),
        condition: res.weather[0].main,
        icon: this.mapWeatherIcon(res.weather[0].main),
        humidity: res.main.humidity
      })),
      catchError(() => of(this.getMockWeather()))
    );
  }

  private getMockWeather(): WeatherData {
    const conditions = [
      { condition: 'Clear', icon: 'sunny', temp: 32 },
      { condition: 'Clouds', icon: 'cloudy', temp: 30 },
      { condition: 'Rain', icon: 'rainy', temp: 28 },
      { condition: 'Thunderstorm', icon: 'thunderstorm', temp: 27 }
    ];
    const random = conditions[Math.floor(Math.random() * conditions.length)];
    return {
      temp: random.temp,
      condition: random.condition,
      icon: random.icon,
      humidity: 75 + Math.floor(Math.random() * 20)
    };
  }

  private mapWeatherIcon(condition: string): string {
    const map: { [key: string]: string } = {
      'Clear': 'sunny',
      'Clouds': 'cloudy',
      'Rain': 'rainy',
      'Drizzle': 'rainy',
      'Thunderstorm': 'thunderstorm',
      'Mist': 'cloudy',
      'Fog': 'cloudy'
    };
    return map[condition] || 'partly-sunny';
  }
}