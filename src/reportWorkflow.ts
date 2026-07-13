import type { Report } from './types';

export type CitizenReportSubmission = Pick<Report, 'imageUrl' | 'location' | 'lat' | 'lng' | 'description'>;

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
    status: 'pending',
    date: input.date,
    statusHistory: [{ status: 'pending', at: input.at, by: 'citizen' }],
  };
}
