import { NextResponse } from 'next/server';

import { getHospitableApiConfig } from '@/lib/integrations-env';

export async function GET() {
  const hospitableApiConfigured = getHospitableApiConfig() !== null;

  return NextResponse.json({
    integrations: {
      hospitable: {
        inboundChannel: 'webhook',
        status: 'live',
        mode: 'v1',
        outboundApiConfigured: hospitableApiConfigured
      },
      airbnb: {
        status: 'in-progress',
        mode: 'partner-track',
        blocksV1: false
      }
    }
  });
}
