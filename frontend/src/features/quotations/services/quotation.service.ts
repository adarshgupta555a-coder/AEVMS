import { apiClient } from "@/lib/api";
import type { PaginationMeta } from "@/types/api.types";
import type {
  CreateQuotationInput,
  UpdateQuotationInput,
  UpdateQuotationStatusInput,
  QuotationQueryInput,
  ConvertToEventInput,
  QuotationWithRelations,
  ConvertToEventResponse,
} from "../schemas/quotation.schema";

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

export interface QuotationListResponse {
  quotations: QuotationWithRelations[];
  meta?: PaginationMeta;
}

export const quotationService = {
  /**
   * Fetch paginated list of quotations with search and status filters
   */
  async getQuotations(params?: QuotationQueryInput): Promise<QuotationListResponse> {
    const qs = buildQueryString(params as Record<string, unknown>);
    const res = await apiClient<QuotationWithRelations[]>(`/quotations${qs}`, {
      method: "GET",
    });

    return {
      quotations: res.data ?? [],
      meta: res.meta,
    };
  },

  /**
   * Fetch a single quotation by ID with its client, line items, and linked event info
   */
  async getQuotationById(id: string): Promise<QuotationWithRelations> {
    const res = await apiClient<QuotationWithRelations>(`/quotations/${id}`, {
      method: "GET",
    });

    if (!res.data) {
      throw new Error(res.message || `Quotation ${id} not found`);
    }

    return res.data;
  },

  /**
   * Create a new itemized quotation
   */
  async createQuotation(data: CreateQuotationInput): Promise<QuotationWithRelations> {
    const res = await apiClient<QuotationWithRelations>("/quotations", {
      method: "POST",
      body: JSON.stringify(data),
    });

    if (!res.data) {
      throw new Error(res.message || "Failed to create quotation");
    }

    return res.data;
  },

  /**
   * Update quotation details and line items (Admin only)
   */
  async updateQuotation(
    id: string,
    data: UpdateQuotationInput
  ): Promise<QuotationWithRelations> {
    const res = await apiClient<QuotationWithRelations>(`/quotations/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });

    if (!res.data) {
      throw new Error(res.message || "Failed to update quotation");
    }

    return res.data;
  },

  /**
   * Transition quotation lifecycle status (e.g. SENT, ACCEPTED, REJECTED, CANCELLED)
   */
  async updateQuotationStatus(
    id: string,
    data: UpdateQuotationStatusInput
  ): Promise<QuotationWithRelations> {
    const res = await apiClient<QuotationWithRelations>(`/quotations/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });

    if (!res.data) {
      throw new Error(res.message || "Failed to update quotation status");
    }

    return res.data;
  },

  /**
   * Convert an accepted quotation directly into a confirmed Event
   */
  async convertToEvent(
    id: string,
    data: ConvertToEventInput
  ): Promise<ConvertToEventResponse> {
    const res = await apiClient<ConvertToEventResponse>(
      `/quotations/${id}/convert-to-event`,
      {
        method: "POST",
        body: JSON.stringify(data),
      }
    );

    if (!res.data) {
      throw new Error(res.message || "Failed to convert quotation to event");
    }

    return res.data;
  },

  /**
   * Delete quotation (Admin only; disallowed if linked to event or invoices)
   */
  async deleteQuotation(id: string): Promise<{ id: string; message: string }> {
    const res = await apiClient<{ id: string; message: string }>(`/quotations/${id}`, {
      method: "DELETE",
    });

    return res.data ?? { id, message: "Quotation deleted successfully" };
  },
};
