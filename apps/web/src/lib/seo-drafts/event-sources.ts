export type SeoEventSource = {
  id: string;
  label: string;
  url: string;
  city: 'Frisco';
};

export const friscoEventSources: SeoEventSource[] = [
  {
    id: 'visit-frisco-events',
    label: 'Visit Frisco Events',
    url: 'https://www.visitfrisco.com/events/',
    city: 'Frisco',
  },
  {
    id: 'toyota-stadium-events',
    label: 'Toyota Stadium Events',
    url: 'https://www.toyotastadium.com/events/',
    city: 'Frisco',
  },
  {
    id: 'riders-field-events',
    label: 'Riders Field Events',
    url: 'https://www.milb.com/frisco/schedule',
    city: 'Frisco',
  },
];
