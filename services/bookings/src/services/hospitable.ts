export type HospitableBookingParams = {
  propertyId: string;
  checkIn: string;
  checkOut: string;
  guestName: string;
  guestEmail: string;
  guestPhone?: string;
  totalAmountCents: number;
};

export type HospitableBookingResult = {
  ok: boolean;
  bookingId?: string;
  error?: string;
};

export type HospitableAvailabilityResult = {
  ok: boolean;
  available?: boolean;
  error?: string;
};

export async function checkAvailability(
  apiKey: string,
  propertyId: string,
  checkIn: string,
  checkOut: string
): Promise<HospitableAvailabilityResult> {
  try {
    const response = await fetch(
      `https://api.hospitable.com/v2/properties/${propertyId}/availability?start=${checkIn}&end=${checkOut}`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      return { ok: false, error: `Hospitable API error: ${response.status}` };
    }

    const data = (await response.json()) as { data?: Array<{ available: boolean }> };
    // Hospitable returns availability data - check if all days are available
    const available = data.data?.every((day) => day.available) ?? false;

    return { ok: true, available };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function createBooking(
  apiKey: string,
  params: HospitableBookingParams
): Promise<HospitableBookingResult> {
  try {
    const response = await fetch("https://api.hospitable.com/v2/reservations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        property_id: params.propertyId,
        check_in: params.checkIn,
        check_out: params.checkOut,
        guest: {
          name: params.guestName,
          email: params.guestEmail,
          phone: params.guestPhone,
        },
        total_price: params.totalAmountCents / 100, // Hospitable expects dollars
        currency: "USD",
        source: "direct",
      }),
    });

    if (!response.ok) {
      const errorData = (await response.json().catch(() => ({}))) as { message?: string };
      return {
        ok: false,
        error: errorData.message || `Hospitable API error: ${response.status}`,
      };
    }

    const data = (await response.json()) as { data?: { id?: string } };
    return { ok: true, bookingId: data.data?.id };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function cancelBooking(
  apiKey: string,
  bookingId: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const response = await fetch(
      `https://api.hospitable.com/v2/reservations/${bookingId}/cancel`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      return { ok: false, error: `Hospitable API error: ${response.status}` };
    }

    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
