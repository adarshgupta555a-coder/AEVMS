import { apiClient } from "@/lib/api";
import type { Event, Quotation, Invoice, Payment, CalendarEntry } from "@/types/models";
import type { PaginationMeta } from "@/types/api.types";
import type {
  CreateClientInput,
  UpdateClientInput,
  ClientQueryInput,
  AssignPortalInput,
  UpdateClientStatusInput,
  CreateClientActivityInput,
  ClientItem,
  ClientDetail,
  PortalStatusResponse,
  AssignPortalResponse,
  UpdateClientStatusResponse,
} from "../schemas/client.schema";

function buildQueryString(params?: Record<string, unknown>): string {
  if (!params) return "";
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      searchParams.append(key, String(value));
    }
  });
  const qs = searchParams.toString();
  return qs ? `?${qs}` : "";
}

export interface ClientListResponse {
  clients: ClientItem[];
  meta?: PaginationMeta;
}

export interface ClientEventsResponse {
  client: { id: string; name: string; email: string | null };
  events: Event[];
  meta?: PaginationMeta;
}

export interface ClientQuotationsResponse {
  client: { id: string; name: string; email: string | null };
  quotations: Quotation[];
  meta?: PaginationMeta;
}

export interface ClientInvoicesResponse {
  client: { id: string; name: string; email: string | null };
  invoices: Invoice[];
  meta?: PaginationMeta;
}

export interface ClientPaymentsResponse {
  client: { id: string; name: string; email: string | null };
  payments: Payment[];
  meta?: PaginationMeta;
}

export const clientService = {
  /**
   * Fetch paginated list of clients
   */
  async getClients(params?: ClientQueryInput): Promise<ClientListResponse> {
    const qs = buildQueryString(params as Record<string, unknown>);
    const res = await apiClient<ClientItem[]>(`/clients${qs}`, {
      method: "GET",
    });

    return {
      clients: res.data ?? [],
      meta: res.meta,
    };
  },

  /**
   * Register a new client profile
   */
  async createClient(data: CreateClientInput): Promise<ClientItem> {
    const res = await apiClient<ClientItem>("/clients", {
      method: "POST",
      body: JSON.stringify(data),
    });

    if (!res.data) {
      throw new Error(res.message || "Failed to create client");
    }

    return res.data;
  },

  /**
   * Fetch single client details with associated summary and history
   */
  async getClientById(id: string): Promise<ClientDetail> {
    const res = await apiClient<ClientDetail>(`/clients/${id}`, {
      method: "GET",
    });

    if (!res.data) {
      throw new Error(res.message || `Client ${id} not found`);
    }

    return res.data;
  },

  /**
   * Update client profile details
   */
  async updateClient(id: string, data: UpdateClientInput): Promise<ClientItem> {
    const res = await apiClient<ClientItem>(`/clients/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });

    if (!res.data) {
      throw new Error(res.message || "Failed to update client");
    }

    return res.data;
  },

  /**
   * Delete client profile (only when no linked records exist)
   */
  async deleteClient(id: string): Promise<void> {
    await apiClient<null>(`/clients/${id}`, {
      method: "DELETE",
    });
  },

  /**
   * Assign portal access to an existing client with registered email
   */
  async assignPortal(id: string, data?: AssignPortalInput): Promise<AssignPortalResponse> {
    const res = await apiClient<AssignPortalResponse>(`/clients/${id}/assign-portal`, {
      method: "POST",
      body: JSON.stringify(data ?? { expiresInHours: 24 }),
    });

    if (!res.data) {
      throw new Error(res.message || "Failed to assign portal access");
    }

    return res.data;
  },

  /**
   * Check client portal assignment and status
   */
  async getPortalStatus(id: string): Promise<PortalStatusResponse> {
    const res = await apiClient<PortalStatusResponse>(`/clients/${id}/portal-status`, {
      method: "GET",
    });

    if (!res.data) {
      throw new Error(res.message || "Failed to fetch portal status");
    }

    return res.data;
  },

  /**
   * Resend portal invitation link to inactive client
   */
  async resendInvite(id: string, data?: AssignPortalInput): Promise<AssignPortalResponse> {
    const res = await apiClient<AssignPortalResponse>(`/clients/${id}/resend-invite`, {
      method: "POST",
      body: JSON.stringify(data ?? { expiresInHours: 24 }),
    });

    if (!res.data) {
      throw new Error(res.message || "Failed to resend portal invitation");
    }

    return res.data;
  },

  /**
   * Activate or deactivate client portal access
   */
  async updateClientStatus(
    id: string,
    data: UpdateClientStatusInput
  ): Promise<UpdateClientStatusResponse> {
    const res = await apiClient<UpdateClientStatusResponse>(`/clients/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });

    if (!res.data) {
      throw new Error(res.message || "Failed to update client status");
    }

    return res.data;
  },

  /**
   * Sub-resource: Client's events
   */
  async getClientEvents(
    id: string,
    params?: { page?: number; limit?: number; status?: string }
  ): Promise<ClientEventsResponse> {
    const qs = buildQueryString(params);
    const res = await apiClient<ClientEventsResponse>(`/clients/${id}/events${qs}`, {
      method: "GET",
    });

    return (
      res.data ?? {
        client: { id, name: "", email: null },
        events: [],
        meta: res.meta,
      }
    );
  },

  /**
   * Sub-resource: Client's quotations
   */
  async getClientQuotations(
    id: string,
    params?: { page?: number; limit?: number; status?: string }
  ): Promise<ClientQuotationsResponse> {
    const qs = buildQueryString(params);
    const res = await apiClient<ClientQuotationsResponse>(`/clients/${id}/quotations${qs}`, {
      method: "GET",
    });

    return (
      res.data ?? {
        client: { id, name: "", email: null },
        quotations: [],
        meta: res.meta,
      }
    );
  },

  /**
   * Sub-resource: Client's invoices
   */
  async getClientInvoices(
    id: string,
    params?: { page?: number; limit?: number; status?: string }
  ): Promise<ClientInvoicesResponse> {
    const qs = buildQueryString(params);
    const res = await apiClient<ClientInvoicesResponse>(`/clients/${id}/invoices${qs}`, {
      method: "GET",
    });

    return (
      res.data ?? {
        client: { id, name: "", email: null },
        invoices: [],
        meta: res.meta,
      }
    );
  },

  /**
   * Sub-resource: Client's payments
   */
  async getClientPayments(
    id: string,
    params?: { page?: number; limit?: number; status?: string }
  ): Promise<ClientPaymentsResponse> {
    const qs = buildQueryString(params);
    const res = await apiClient<ClientPaymentsResponse>(`/clients/${id}/payments${qs}`, {
      method: "GET",
    });

    return (
      res.data ?? {
        client: { id, name: "", email: null },
        payments: [],
        meta: res.meta,
      }
    );
  },

  /**
   * Sub-resource: Client's calendar activities / meetings / calls
   */
  async getClientActivities(
    id: string,
    params?: { page?: number; limit?: number; type?: string }
  ): Promise<CalendarEntry[]> {
    const qs = buildQueryString(params);
    const res = await apiClient<CalendarEntry[]>(`/clients/${id}/activities${qs}`, {
      method: "GET",
    });

    return res.data ?? [];
  },

  /**
   * Sub-resource: Create activity entry directly for this client
   */
  async createClientActivity(
    id: string,
    data: CreateClientActivityInput
  ): Promise<CalendarEntry> {
    const typeMapping: Record<string, string> = {
      SITE_VISIT: "SITE_VISIT",
      CLIENT_MEETING: "MEETING",
      VENDOR_MEETING: "VENDOR_MEETING",
      REHEARSAL: "OTHER",
      EVENT_DATE: "OTHER",
      FOLLOW_UP: "OTHER",
      MEETING: "MEETING",
      OFFICE_ACTIVITY: "OFFICE_ACTIVITY",
      OTHER: "OTHER",
    };

    const payload = {
      title: data.title,
      type: typeMapping[data.entryType] || "OTHER",
      startAt: new Date(data.startTime).toISOString(),
      endAt: data.endTime && data.endTime.trim() !== "" ? new Date(data.endTime).toISOString() : undefined,
      description: data.description,
      location: data.location,
    };

    const res = await apiClient<CalendarEntry>(`/clients/${id}/activities`, {
      method: "POST",
      body: JSON.stringify(payload),
    });

    if (!res.data) {
      throw new Error(res.message || "Failed to record client activity");
    }

    return res.data;
  },
};
