import { apiClient } from "@/lib/api";
import type { PaginationMeta } from "@/types/api.types";
import type {
  CreateInvoiceInput,
  UpdateInvoiceInput,
  UpdateInvoiceStatusInput,
  InvoiceQueryInput,
  InvoiceWithRelations,
  InvoiceBalanceResponse,
} from "../schemas/invoice.schema";

function buildQueryString(params?: Record<string, unknown>): string {
  if (!params) return "";
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      if (value instanceof Date) {
        searchParams.append(key, value.toISOString());
      } else {
        searchParams.append(key, String(value));
      }
    }
  });
  const qs = searchParams.toString();
  return qs ? `?${qs}` : "";
}

export interface InvoiceListResponse {
  invoices: InvoiceWithRelations[];
  meta?: PaginationMeta;
}

export const invoiceService = {
  /**
   * Fetch paginated list of invoices with search and status filters
   */
  async getInvoices(params?: InvoiceQueryInput): Promise<InvoiceListResponse> {
    const qs = buildQueryString(params as Record<string, unknown>);
    const res = await apiClient<InvoiceWithRelations[]>(`/invoices${qs}`, {
      method: "GET",
    });

    return {
      invoices: res.data ?? [],
      meta: res.meta,
    };
  },

  /**
   * Fetch a single invoice by ID with relations and calculated balances
   */
  async getInvoiceById(id: string): Promise<InvoiceWithRelations> {
    const res = await apiClient<InvoiceWithRelations>(`/invoices/${id}`, {
      method: "GET",
    });

    if (!res.data) {
      throw new Error(res.message || `Invoice ${id} not found`);
    }

    return res.data;
  },

  /**
   * Fetch invoice balance summary (total, paid, balanceAmount)
   */
  async calculateBalance(id: string): Promise<InvoiceBalanceResponse> {
    const res = await apiClient<InvoiceBalanceResponse>(`/invoices/${id}/balance`, {
      method: "GET",
    });

    if (!res.data) {
      throw new Error(res.message || `Failed to calculate balance for invoice ${id}`);
    }

    return res.data;
  },

  /**
   * Stream / fetch the invoice PDF as a binary Blob
   */
  async getInvoicePdfBlob(id: string): Promise<Blob> {
    const res = await apiClient<Blob>(`/invoices/${id}/pdf`, {
      method: "GET",
      responseType: "blob",
    });

    if (res.data instanceof Blob) {
      return res.data;
    }
    if (res instanceof Blob) {
      return res;
    }

    throw new Error("Invalid binary PDF response received from server");
  },

  /**
   * Create a new itemized invoice
   */
  async createInvoice(data: CreateInvoiceInput): Promise<InvoiceWithRelations> {
    const res = await apiClient<InvoiceWithRelations>("/invoices", {
      method: "POST",
      body: JSON.stringify(data),
    });

    if (!res.data) {
      throw new Error(res.message || "Failed to create invoice");
    }

    return res.data;
  },

  /**
   * Update invoice details and line items (Admin only)
   */
  async updateInvoice(
    id: string,
    data: UpdateInvoiceInput
  ): Promise<InvoiceWithRelations> {
    const res = await apiClient<InvoiceWithRelations>(`/invoices/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });

    if (!res.data) {
      throw new Error(res.message || "Failed to update invoice");
    }

    return res.data;
  },

  /**
   * Transition invoice lifecycle status
   */
  async updateInvoiceStatus(
    id: string,
    data: UpdateInvoiceStatusInput
  ): Promise<InvoiceWithRelations> {
    const res = await apiClient<InvoiceWithRelations>(`/invoices/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });

    if (!res.data) {
      throw new Error(res.message || "Failed to update invoice status");
    }

    return res.data;
  },

  /**
   * Delete an invoice (Admin only)
   */
  async deleteInvoice(id: string): Promise<{ success: boolean; message?: string }> {
    const res = await apiClient<{ success: boolean }>(`/invoices/${id}`, {
      method: "DELETE",
    });

    return {
      success: res.success,
      message: res.message,
    };
  },
};

/**
 * PDF helper: fetches the invoice PDF blob and triggers a browser download.
 */
export async function downloadInvoicePdf(
  id: string,
  invoiceNumber?: string
): Promise<void> {
  const blob = await invoiceService.getInvoicePdfBlob(id);
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.style.display = "none";
  a.href = url;
  const filename = invoiceNumber ? `${invoiceNumber}.pdf` : `invoice-${id}.pdf`;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    window.URL.revokeObjectURL(url);
    if (document.body.contains(a)) {
      document.body.removeChild(a);
    }
  }, 100);
}
