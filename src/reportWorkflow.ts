import type { Report } from './types';

export type CitizenReportSubmission = Pick<Report, 'imageUrl' | 'location' | 'lat' | 'lng' | 'description'> & {
  citizenTags?: string[];
  locationSource?: 'gps' | 'manual' | 'unknown';
};

export interface CitizenReportCreation extends CitizenReportSubmission {
  id: string;
  date: string;
  at: string;
}

export function createCitizenReport(input: CitizenReportCreation): Report {
  return {
    id: input.id,
    imageUrl: input.imageUrl,
    location: input.location,
    lat: input.lat,
    lng: input.lng,
    description: input.description,
    citizenTags: input.citizenTags || [],
    locationSource: input.locationSource || (input.lat !== undefined && input.lng !== undefined ? 'gps' : 'manual'),
    status: 'pending',
    date: input.date,
    statusHistory: [{ status: 'pending', at: input.at, by: 'citizen' }],
  };
}
