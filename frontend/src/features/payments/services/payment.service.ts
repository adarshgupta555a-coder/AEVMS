import { apiClient } from "@/lib/api";
import type {
  CreatePaymentInput,
  PaymentQueryInput,
  PaymentItem,
  PaymentDetail,
  PaymentListResponse,
  ClientPendingInvoice,
} from "../schemas/payment.schema";

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

export const paymentService = {
  /**
   * Fetch paginated list of payments
   */
  async getPayments(params?: PaymentQueryInput): Promise<PaymentListResponse> {
    const qs = buildQueryString(params as Record<string, unknown>);
    const res = await apiClient<PaymentItem[]>(`/payments${qs}`, {
      method: "GET",
    });

    return {
      payments: res.data ?? [],
      meta: res.meta,
    };
  },

  /**
   * Fetch single payment details by ID
   */
  async getPaymentById(id: string): Promise<PaymentDetail> {
    const res = await apiClient<PaymentDetail>(`/payments/${id}`, {
      method: "GET",
    });

    if (!res.data) {
      throw new Error(`Failed to load payment '${id}'`);
    }

    return res.data;
  },

  /**
   * Record a new client payment with optional multi-invoice allocations
   */
  async recordPayment(data: CreatePaymentInput): Promise<PaymentDetail> {
    const payload = {
      ...data,
      paymentDate:
        data.paymentDate instanceof Date
          ? data.paymentDate.toISOString()
          : data.paymentDate,
    };
    const res = await apiClient<PaymentDetail>("/payments", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    if (!res.data) {
      throw new Error(res.message || "Failed to record payment");
    }

    return res.data;
  },

  /**
   * Delete a payment and revert affected invoice statuses
   */
  async deletePayment(id: string): Promise<{ success: boolean; message: string }> {
    const res = await apiClient<{ success: boolean; message: string }>(`/payments/${id}`, {
      method: "DELETE",
    });

    return {
      success: Boolean(res.success),
      message: res.message || "Payment deleted successfully",
    };
  },

  /**
   * Get pending / partially paid / sent invoices for a specific client
   */
  async getClientPendingInvoices(clientId: string): Promise<ClientPendingInvoice[]> {
    if (!clientId) return [];
    const res = await apiClient<ClientPendingInvoice[]>(
      `/invoices?clientId=${encodeURIComponent(clientId)}&limit=100`,
      { method: "GET" }
    );

    const invoices = res.data ?? [];
    return invoices.filter(
      (inv) =>
        Number(inv.balanceAmount) > 0 &&
        inv.status !== "CANCELLED" &&
        inv.status !== "PAID"
    );
  },
};
