import Link from 'next/link';
import { notFound } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { properties } from '@walt/db';
import { db } from '@/lib/db';
import { PropertySettingsTabs } from '../PropertySettingsTabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

function Badge({ children, variant = 'default' }: { children: React.ReactNode; variant?: 'default' | 'success' | 'destructive' }) {
  const styles = {
    default: 'bg-gray-100 text-gray-700',
    success: 'bg-green-100 text-green-700',
    destructive: 'bg-red-100 text-red-700',
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[variant]}`}>
      {children}
    </span>
  );
}

function RuleBadge({ label, allowed }: { label: string; allowed: boolean | null }) {
  if (allowed === null) return null;
  return (
    <Badge variant={allowed ? 'success' : 'destructive'}>
      {allowed ? `${label} allowed` : `No ${label.toLowerCase()}`}
    </Badge>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined) return null;
  return (
    <div className="flex justify-between py-2 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-medium text-gray-900">{value}</span>
    </div>
  );
}

export default async function PropertyDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [property] = await db
    .select()
    .from(properties)
    .where(eq(properties.id, id))
    .limit(1);

  if (!property) {
    notFound();
  }

  return (
    <div className="p-4 sm:p-8 max-w-5xl">
      <Link
        href="/properties"
        className="text-sm text-gray-500 hover:text-gray-700 mb-6 inline-flex items-center gap-1"
      >
        &larr; Properties
      </Link>
      <h1 className="text-2xl font-semibold mt-4 mb-1">{property.name}</h1>
      {property.publicName && property.publicName !== property.name && (
        <p className="text-sm text-gray-500 mb-4">{property.publicName}</p>
      )}
      <p className="text-xs text-gray-400 mb-6">
        Last synced: {property.syncedAt.toLocaleString()}
      </p>

      <PropertySettingsTabs propertyId={id} current="details" />

      <div className="grid gap-6 md:grid-cols-2">
        {/* Overview */}
        <Card>
          <CardHeader><CardTitle>Overview</CardTitle></CardHeader>
          <CardContent>
            {property.pictureUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={property.pictureUrl}
                alt={property.name}
                className="w-full h-48 object-cover rounded-md mb-4"
              />
            )}
            <DetailRow label="Property type" value={property.propertyType} />
            <DetailRow label="Room type" value={property.roomType} />
            <DetailRow label="Currency" value={property.currency} />
            {property.description && (
              <div className="mt-3">
                <p className="text-sm text-gray-500 mb-1">Description</p>
                <p className="text-sm text-gray-700 whitespace-pre-line">{property.description}</p>
              </div>
            )}
            {property.summary && property.summary !== property.description && (
              <div className="mt-3">
                <p className="text-sm text-gray-500 mb-1">Summary</p>
                <p className="text-sm text-gray-700">{property.summary}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Capacity */}
        <Card>
          <CardHeader><CardTitle>Capacity</CardTitle></CardHeader>
          <CardContent>
            <DetailRow label="Max guests" value={property.maxGuests} />
            <DetailRow label="Bedrooms" value={property.bedrooms} />
            <DetailRow label="Beds" value={property.beds} />
            <DetailRow label="Bathrooms" value={property.bathrooms} />
            {property.roomDetails && property.roomDetails.length > 0 && (
              <div className="mt-3">
                <p className="text-sm text-gray-500 mb-1">Room details</p>
                <div className="flex flex-wrap gap-1">
                  {property.roomDetails.map((rd, i) => (
                    <Badge key={i}>{rd.quantity}x {rd.type}</Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Timing */}
        <Card>
          <CardHeader><CardTitle>Timing</CardTitle></CardHeader>
          <CardContent>
            <DetailRow label="Check-in" value={property.checkInTime} />
            <DetailRow label="Check-out" value={property.checkOutTime} />
            <DetailRow label="Timezone" value={property.timezone} />
          </CardContent>
        </Card>

        {/* House Rules */}
        <Card>
          <CardHeader><CardTitle>House Rules</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <RuleBadge label="Pets" allowed={property.petsAllowed} />
              <RuleBadge label="Smoking" allowed={property.smokingAllowed} />
              <RuleBadge label="Events" allowed={property.eventsAllowed} />
            </div>
            {property.petsAllowed === null && property.smokingAllowed === null && property.eventsAllowed === null && (
              <p className="text-sm text-gray-400 mt-2">No house rules data available.</p>
            )}
          </CardContent>
        </Card>

        {/* Guest Info (WiFi, access, house manual) */}
        {(property.wifiName || property.wifiPassword || property.guestAccess || property.houseManual) && (
          <Card>
            <CardHeader><CardTitle>Guest Info</CardTitle></CardHeader>
            <CardContent>
              <DetailRow label="WiFi network" value={property.wifiName} />
              <DetailRow label="WiFi password" value={property.wifiPassword} />
              {property.guestAccess && (
                <div className="mt-3">
                  <p className="text-sm text-gray-500 mb-1">Guest access</p>
                  <p className="text-sm text-gray-700 whitespace-pre-line">{property.guestAccess}</p>
                </div>
              )}
              {property.houseManual && (
                <div className="mt-3">
                  <p className="text-sm text-gray-500 mb-1">House manual</p>
                  <p className="text-sm text-gray-700 whitespace-pre-line">{property.houseManual}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Neighborhood & Getting Around */}
        {(property.spaceOverview || property.neighborhoodDescription || property.gettingAround) && (
          <Card>
            <CardHeader><CardTitle>Area Guide</CardTitle></CardHeader>
            <CardContent>
              {property.spaceOverview && (
                <div className="mb-3">
                  <p className="text-sm text-gray-500 mb-1">Space overview</p>
                  <p className="text-sm text-gray-700 whitespace-pre-line">{property.spaceOverview}</p>
                </div>
              )}
              {property.neighborhoodDescription && (
                <div className="mb-3">
                  <p className="text-sm text-gray-500 mb-1">Neighborhood</p>
                  <p className="text-sm text-gray-700 whitespace-pre-line">{property.neighborhoodDescription}</p>
                </div>
              )}
              {property.gettingAround && (
                <div>
                  <p className="text-sm text-gray-500 mb-1">Getting around</p>
                  <p className="text-sm text-gray-700 whitespace-pre-line">{property.gettingAround}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Additional Rules */}
        {property.additionalRules && (
          <Card>
            <CardHeader><CardTitle>Additional Rules</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm text-gray-700 whitespace-pre-line">{property.additionalRules}</p>
            </CardContent>
          </Card>
        )}

        {/* Amenities */}
        {property.amenities && property.amenities.length > 0 && (
          <Card>
            <CardHeader><CardTitle>Amenities</CardTitle></CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-1">
                {property.amenities.map((a) => (
                  <Badge key={a}>{a}</Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Location */}
        <Card>
          <CardHeader><CardTitle>Location</CardTitle></CardHeader>
          <CardContent>
            <DetailRow label="Street" value={property.address} />
            <DetailRow label="Number" value={property.addressNumber} />
            <DetailRow label="City" value={property.city} />
            <DetailRow label="State" value={property.addressState} />
            <DetailRow label="Country" value={property.country} />
            <DetailRow label="Postcode" value={property.postcode} />
            {property.latitude != null && property.longitude != null && (
              <DetailRow label="Coordinates" value={`${property.latitude}, ${property.longitude}`} />
            )}
          </CardContent>
        </Card>

        {/* Platforms */}
        {property.listings && property.listings.length > 0 && (
          <Card>
            <CardHeader><CardTitle>Connected Platforms</CardTitle></CardHeader>
            <CardContent>
              {property.listings.map((listing, i) => (
                <DetailRow
                  key={i}
                  label={listing.platform}
                  value={listing.platform_name ?? listing.platform_id}
                />
              ))}
            </CardContent>
          </Card>
        )}

        {/* Meta */}
        {(property.tags?.length || property.calendarRestricted != null || property.parentChild) && (
          <Card>
            <CardHeader><CardTitle>Meta</CardTitle></CardHeader>
            <CardContent>
              <DetailRow label="Calendar restricted" value={property.calendarRestricted != null ? (property.calendarRestricted ? 'Yes' : 'No') : null} />
              {property.tags && property.tags.length > 0 && (
                <div className="mt-2">
                  <p className="text-sm text-gray-500 mb-1">Tags</p>
                  <div className="flex flex-wrap gap-1">
                    {property.tags.map((t) => <Badge key={t}>{t}</Badge>)}
                  </div>
                </div>
              )}
              {property.parentChild && (
                <DetailRow label="Relationship" value={property.parentChild.type} />
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
