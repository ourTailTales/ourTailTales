import { readEnv, requireEnv } from "@/lib/env";
import type { ShippingAddress } from "@/types/order";

/**
 * Lulu Print API client.
 *
 * Server-only: the client key and secret are never sent to the browser, and
 * every Lulu call is proxied through a route handler.
 */

const SANDBOX_BASE = "https://api.sandbox.lulu.com";
const PRODUCTION_BASE = "https://api.lulu.com";

const TOKEN_PATH = "/auth/realms/glasstree/protocol/openid-connect/token";

/** Refresh a little early so a request never races expiry. */
const TOKEN_SAFETY_WINDOW_MS = 60_000;

const PT_PER_INCH = 72;

let cachedToken: { value: string; expiresAt: number } | null = null;

export function luluBaseUrl(): string {
  return readEnv("LULU_ENV") === "production" ? PRODUCTION_BASE : SANDBOX_BASE;
}

export function luluPodPackageId(): string {
  const [id] = requireEnv("LULU_POD_PACKAGE_ID");
  return id;
}

async function accessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.value;

  const [key, secret] = requireEnv("LULU_CLIENT_KEY", "LULU_CLIENT_SECRET");
  const basic = Buffer.from(`${key}:${secret}`).toString("base64");

  const response = await fetch(`${luluBaseUrl()}${TOKEN_PATH}`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: "client_credentials" }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(
      `Lulu authentication failed (${response.status}). Check LULU_CLIENT_KEY and LULU_CLIENT_SECRET.`,
    );
  }

  const data = (await response.json()) as {
    access_token: string;
    expires_in: number;
  };

  cachedToken = {
    value: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000 - TOKEN_SAFETY_WINDOW_MS,
  };
  return cachedToken.value;
}

async function luluFetch<T>(
  path: string,
  init: RequestInit & { authenticated?: boolean } = {},
): Promise<T> {
  const { authenticated = true, ...rest } = init;
  const headers = new Headers(rest.headers);
  headers.set("Content-Type", "application/json");
  headers.set("Accept", "application/json");
  if (authenticated) {
    headers.set("Authorization", `Bearer ${await accessToken()}`);
  }

  const response = await fetch(`${luluBaseUrl()}${path}`, {
    ...rest,
    headers,
    cache: "no-store",
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Lulu ${path} failed (${response.status}): ${text.slice(0, 400)}`);
  }
  return (text ? JSON.parse(text) : {}) as T;
}

/* ------------------------------ cover dimensions ----------------------------- */

export type CoverDimensions = {
  /** PDF points (1/72 in). Converted from Lulu's inch response. */
  width: number;
  height: number;
  unit: "pt";
  /** Raw Lulu calculator values for validation / fixtures. */
  widthInches: number;
  heightInches: number;
};

/**
 * The one true source for cover size. Never guess a spine width — it depends on
 * the exact paper stock behind `pod_package_id` and the interior page count.
 *
 * Lulu is queried in inches (per Print API contract); we convert to PDF points
 * for `pdf-lib`.
 */
export async function fetchCoverDimensions(
  interiorPageCount: number,
): Promise<CoverDimensions> {
  const data = await luluFetch<{
    width: string;
    height: string;
    unit: string;
  }>("/cover-dimensions/", {
    method: "POST",
    body: JSON.stringify({
      pod_package_id: luluPodPackageId(),
      interior_page_count: interiorPageCount,
      unit: "inch",
    }),
  });

  const widthInches = Number(data.width);
  const heightInches = Number(data.height);

  return {
    width: widthInches * PT_PER_INCH,
    height: heightInches * PT_PER_INCH,
    unit: "pt",
    widthInches,
    heightInches,
  };
}

/* ------------------------------ shipping + cost ------------------------------ */

/** Levels we surface at checkout when Lulu returns them for the destination. */
export const OFFERED_SHIPPING_LEVELS = [
  "MAIL",
  "GROUND",
  "GROUND_HD",
  "PRIORITY_MAIL",
  "EXPEDITED",
] as const;

export type OfferedShippingLevel = (typeof OFFERED_SHIPPING_LEVELS)[number];

export const SHIPPING_LEVEL_LABELS: Record<string, string> = {
  MAIL: "Economy mail",
  GROUND: "Ground",
  GROUND_HD: "Ground (home delivery)",
  PRIORITY_MAIL: "Priority mail",
  EXPEDITED: "Expedited",
};

export function isOfferedShippingLevel(level: string): level is OfferedShippingLevel {
  return (OFFERED_SHIPPING_LEVELS as readonly string[]).includes(level);
}

export type LuluShippingOption = {
  id: number;
  level: string;
  cost_excl_tax: string | null;
  currency: string | null;
  traceable: boolean;
  total_days_min?: number;
  total_days_max?: number;
  min_delivery_date?: string;
  max_delivery_date?: string;
};

export async function fetchShippingOptions(
  pageCount: number,
  address: ShippingAddress,
): Promise<LuluShippingOption[]> {
  return luluFetch<LuluShippingOption[]>("/shipping-options/", {
    method: "POST",
    body: JSON.stringify({
      currency: "USD",
      line_items: [
        {
          page_count: pageCount,
          pod_package_id: luluPodPackageId(),
          quantity: 1,
        },
      ],
      shipping_address: {
        country: address.country,
        city: address.city,
        postcode: address.postcode,
        // Lulu's schema names this `state` here and `state_code` elsewhere.
        state: address.state,
        state_code: address.state,
        street1: address.street1,
      },
    }),
  });
}

export type LuluSuggestedAddress = {
  street1?: string | null;
  street2?: string | null;
  city?: string | null;
  state_code?: string | null;
  postcode?: string | null;
  country_code?: string | null;
};

export type LuluCostCalculation = {
  line_item_costs?: { total_cost_excl_discounts?: string }[];
  shipping_cost?: { total_cost_excl_tax?: string; total_cost_incl_tax?: string };
  total_tax?: string;
  total_cost_excl_tax?: string;
  total_cost_incl_tax?: string;
  warnings?: { type?: string; message?: string }[];
  shipping_address?: {
    warnings?: { type?: string; message?: string }[];
    suggested_address?: LuluSuggestedAddress;
  };
};

export async function calculatePrintJobCost(args: {
  pageCount: number;
  address: ShippingAddress;
  shippingLevel: string;
  email: string;
}): Promise<LuluCostCalculation> {
  return luluFetch<LuluCostCalculation>("/print-job-cost-calculations/", {
    method: "POST",
    body: JSON.stringify({
      line_items: [
        {
          page_count: args.pageCount,
          pod_package_id: luluPodPackageId(),
          quantity: 1,
        },
      ],
      shipping_address: toLuluAddress(args.address, args.email),
      shipping_option: args.shippingLevel,
    }),
  });
}

/* -------------------------------- print jobs -------------------------------- */

export type LuluPrintJob = {
  id: number;
  external_id?: string;
  status?: { name: string; message?: string };
  line_items?: {
    status?: { name: string; messages?: Record<string, unknown> };
  }[];
  tracking_id?: string | null;
  tracking_urls?: string[];
};

/**
 * Submit one print job. Interior/cover are line-item source URLs (live schema),
 * not nested under printable_normalization.
 */
export async function createPrintJob(args: {
  orderId: string;
  title: string;
  pageCount: number;
  interiorUrl: string;
  coverUrl: string;
  address: ShippingAddress;
  email: string;
  shippingLevel: string;
}): Promise<LuluPrintJob> {
  const [contactEmail] = requireEnv("LULU_CONTACT_EMAIL");

  return luluFetch<LuluPrintJob>("/print-jobs/", {
    method: "POST",
    body: JSON.stringify({
      contact_email: contactEmail,
      external_id: args.orderId,
      line_items: [
        {
          external_id: `${args.orderId}-book`,
          title: args.title,
          quantity: 1,
          pod_package_id: luluPodPackageId(),
          interior: { source_url: args.interiorUrl },
          cover: { source_url: args.coverUrl },
        },
      ],
      shipping_address: toLuluAddress(args.address, args.email),
      shipping_level: args.shippingLevel,
    }),
  });
}

export async function fetchPrintJob(printJobId: string): Promise<LuluPrintJob> {
  return luluFetch<LuluPrintJob>(`/print-jobs/${printJobId}/`, {
    method: "GET",
  });
}

/** Look up by our order UUID when create response was ambiguous. */
export async function findPrintJobByExternalId(
  externalId: string,
): Promise<LuluPrintJob | null> {
  const data = await luluFetch<{ results?: LuluPrintJob[] }>(
    `/print-jobs/?external_id=${encodeURIComponent(externalId)}`,
    { method: "GET" },
  );
  return data.results?.[0] ?? null;
}

function toLuluAddress(address: ShippingAddress, email: string) {
  return {
    name: address.name,
    email,
    street1: address.street1,
    street2: address.street2 || undefined,
    city: address.city,
    state_code: address.state,
    postcode: address.postcode,
    country_code: address.country,
    phone_number: address.phone,
  };
}

/* ------------------------------ status mapping ------------------------------ */

/** Lulu print-job status -> ourTailTales order status. */
export function mapLuluStatus(
  luluStatus: string,
):
  | "submitted"
  | "production"
  | "shipped"
  | "delivered"
  | "rejected"
  | "canceled"
  | null {
  switch (luluStatus) {
    case "CREATED":
    case "UNPAID":
    case "PAYMENT_IN_PROGRESS":
    case "PRODUCTION_DELAYED":
      return "submitted";
    case "IN_PRODUCTION":
      return "production";
    case "SHIPPED":
      return "shipped";
    case "DELIVERED":
      return "delivered";
    case "REJECTED":
      return "rejected";
    case "CANCELED":
      return "canceled";
    default:
      return null;
  }
}
