import { Component, Inject, OnInit, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as mapboxgl from 'mapbox-gl';

@Component({
  selector: 'crc-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit {
  map: mapboxgl.Map | undefined;
  startPoint: [number, number] | null = null; // Punto de inicio (ubicación actual del usuario)
  endPoint: [number, number] | null = null; // Punto de llegada seleccionado por el usuario
  mode: string = 'driving'; // Modo de transporte por defecto
  mapStyle: string = 'mapbox://styles/mapbox/streets-v11'; // Estilo de mapa por defecto
  routeLayer: any; // Capa para mostrar la ruta en el mapa
  startMarker: mapboxgl.Marker | null = null; // Marcador del punto de inicio
  endMarker: mapboxgl.Marker | null = null; // Marcador del punto de llegada
  distance: string = ''; // Distancia calculada de la ruta
  duration: string = ''; // Duración estimada del viaje

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {}

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.initMapbox();
      this.setUserLocationAsStartPoint(); 
    }
  }

  private initMapbox(): void {
    mapboxgl.default.accessToken = 'pk.eyJ1IjoiamVueS02NjYiLCJhIjoiY20wbnAwMDF2MDV2dzJqb2tpN3NtM2FlZSJ9.sDQhjFffTSYaKDdfwqDXMw';

    this.map = new mapboxgl.Map({
      container: 'map',
      style: this.mapStyle, // Utilizar el estilo de mapa seleccionado
      center: [-74.199, 11.2408], // Coordenadas iniciales
      zoom: 13
    });

    this.map.addControl(new mapboxgl.NavigationControl());

    // Manejar los clics en el mapa para definir el punto de llegada
    this.map.on('click', (event) => this.onMapClick(event));
  }

  private setUserLocationAsStartPoint(): void {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          this.startPoint = [position.coords.longitude, position.coords.latitude];
          this.addMarker(this.startPoint, 'start');
          this.map?.flyTo({ center: this.startPoint, zoom: 14 });
        },
        (error) => console.error('Error al obtener la ubicación del usuario:', error),
        { enableHighAccuracy: true }
      );
    } else {
      console.error('La geolocalización no es compatible con este navegador.');
    }
  }
  private onMapClick(event: mapboxgl.MapMouseEvent): void {
    const coordinates: [number, number] = [event.lngLat.lng, event.lngLat.lat];

    if (!this.endPoint) {
      this.endPoint = coordinates;
      this.addMarker(coordinates, 'end');
      this.calculateRoute(); 
    } else {
      this.clearMarkers();
      if (this.startPoint) { 
        this.addMarker(this.startPoint, 'start');
      }
      this.endPoint = coordinates;
      this.addMarker(this.endPoint, 'end');
      this.calculateRoute();
    }
  }

  private addMarker(coordinates: [number, number], type: 'start' | 'end'): void {
    const marker = new mapboxgl.Marker({ color: type === 'start' ? 'green' : 'red' })
      .setLngLat(coordinates)
      .addTo(this.map!);

    if (type === 'start') {
      if (this.startMarker) this.startMarker.remove();
      this.startMarker = marker;
    } else {
      if (this.endMarker) this.endMarker.remove();
      this.endMarker = marker;
    }
  }

  // Limpiar marcadores existentes
  private clearMarkers(): void {
    if (this.startMarker) this.startMarker.remove();
    if (this.endMarker) this.endMarker.remove();
    this.startMarker = null;
    this.endMarker = null;
    this.distance = '';
    this.duration = ''; 
  }

  public changeMapStyle(newStyle: string): void {
    this.mapStyle = newStyle;
    if (this.map) {
      this.map.setStyle(this.mapStyle);
    }
  }

  public calculateRoute(): void {
    if (!this.startPoint || !this.endPoint) return;

    const url = `https://api.mapbox.com/directions/v5/mapbox/${this.mode}/${this.startPoint.join(',')};${this.endPoint.join(',')}?geometries=geojson&access_token=${mapboxgl.default.accessToken}`;

    fetch(url)
      .then(response => response.json())
      .then(data => {
        const route = data.routes[0].geometry.coordinates;
        const distanceInMeters = data.routes[0].distance;
        const durationInSeconds = data.routes[0].duration;

        this.distance = (distanceInMeters / 1000).toFixed(2) + ' km'; // Convertir metros a kilómetros
        
        this.duration = this.convertSecondsToTime(durationInSeconds);
        
        this.addRouteToMap(route); 
      })
      .catch(error => console.error('Error al calcular la ruta:', error));
  }

  private convertSecondsToTime(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    if (hours > 0) {
      return `${hours} hrs ${remainingMinutes} mins`;
    } else {
      return `${remainingMinutes} mins`;
    }
  }

  private addRouteToMap(coordinates: [number, number][]): void {
    // Eliminar la ruta existente si la hay
    if (this.map && this.routeLayer) {
      this.map.removeLayer('route');
      this.map.removeSource('route');
    }

    // Añadir la ruta como una capa nueva
    this.map?.addSource('route', {
      type: 'geojson',
      data: {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: coordinates
        }
      }
    });

    this.routeLayer = {
      id: 'route',
      type: 'line',
      source: 'route',
      layout: {
        'line-join': 'round',
        'line-cap': 'round'
      },
      paint: {
        'line-color': '#1DA1F2',
        'line-width': 4
      }
    };

    this.map?.addLayer(this.routeLayer);
  }

  public changeMode(newMode: string): void {
    this.mode = newMode;
    if (this.startPoint && this.endPoint) this.calculateRoute(); // Recalcular la ruta con el nuevo modo de transporte
  }
}
