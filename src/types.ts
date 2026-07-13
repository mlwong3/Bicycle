import type { ReportStatus, StatusHistoryEntry } from './admin';

export interface Bike {
  id: string;
  model: string;
  frameNo: string;
  ownerName: string;
  nfcBound: boolean;
  nfcTagId?: string;
}

export interface Report {
  id: string;
  imageUrl?: string;
  location: string;
  lat?: number;
  lng?: number;
  description: string;
  status: ReportStatus;
  date: string;
  noticeDate?: string;
  statusHistory?: StatusHistoryEntry[];
  handledBy?: string;
}

export interface RecycleStation {
  id: string;
  name: string;
  distance: string;
  logoUrl: string;
  logoAlt: string;
  contactNo: string;
}

export interface EcoPartner {
  id: string;
  name: string;
  rating: number;
  description: string;
  distance: string;
  imageUrl: string;
  imageAlt: string;
  address: string;
  services: string[];
}

export interface ParkingSpot {
  id: string;
  name: string;
  distance: string;
  availableSlots: number;
  totalSlots: number;
  type: string;
  lat: number;
  lng: number;
}
