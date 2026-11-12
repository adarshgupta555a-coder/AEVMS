"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Download,
  Printer,
  Loader2,
  AlertCircle,
  FileText,
  RotateCw,
} from "lucide-react";
import { invoiceService, downloadInvoicePdf } from "../services/invoice.service";
import { toast } from "sonner";

export interface InvoicePdfModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceId: string;
  invoiceNumber?: string;
}

export function InvoicePdfModal({
  open,
  onOpenChange,
  invoiceId,
  invoiceNumber,
}: InvoicePdfModalProps) {
  const [isDownloading, setIsDownloading] = React.useState<boolean>(false);
  const iframeRef = React.useRef<HTMLIFrameElement>(null);

  const {
    data: pdfBlob,
    isLoading,
    error,
    refetch,
  } = useQuery<Blob, Error>({
    queryKey: ["invoice-pdf-blob", invoiceId],
    queryFn: () => invoiceService.getInvoicePdfBlob(invoiceId),
    enabled: open && Boolean(invoiceId),
    staleTime: 5 * 60 * 1000,
  });

  const pdfUrl = React.useMemo(() => {
    if (!pdfBlob) return null;
    return window.URL.createObjectURL(pdfBlob);
  }, [pdfBlob]);

  React.useEffect(() => {
    return () => {
      if (pdfUrl) {
        window.URL.revokeObjectURL(pdfUrl);
      }
    };
  }, [pdfUrl]);

  const handlePrint = () => {
    if (!iframeRef.current) return;
    try {
      const contentWindow = iframeRef.current.contentWindow;
      if (contentWindow) {
        contentWindow.focus();
        contentWindow.print();
      }
    } catch {
      toast.error(
        "Could not trigger browser print directly. Please download the PDF to print."
      );
    }
  };

  const handleDownload = async () => {
    if (!invoiceId) return;
    setIsDownloading(true);
    try {
      await downloadInvoicePdf(invoiceId, invoiceNumber);
      toast.success(
        `Invoice ${invoiceNumber || ""} downloaded successfully`
      );
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Failed to download invoice PDF"
      );
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl sm:max-w-4xl h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-4 sm:p-5 border-b border-border/70 flex flex-row items-center justify-between space-y-0">
          <div>
            <div className="flex items-center gap-2">
              <FileText className="size-5 text-primary" />
              <DialogTitle className="text-lg font-semibold">
                Invoice PDF Preview
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-muted-foreground mt-0.5">
              Official tax invoice document {invoiceNumber ? `(${invoiceNumber})` : ""}
            </DialogDescription>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handlePrint}
              disabled={!pdfUrl || isLoading}
              className="gap-1.5 h-8 text-xs"
            >
              <Printer className="size-3.5" />
              Print
            </Button>
            <Button
              size="sm"
              onClick={handleDownload}
              disabled={isLoading || isDownloading}
              className="gap-1.5 h-8 text-xs"
            >
              {isDownloading ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Download className="size-3.5" />
              )}
              Download PDF
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 w-full h-full relative bg-muted/20 min-h-[400px]">
          {isLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/80 backdrop-blur-xs z-10">
              <Loader2 className="size-8 animate-spin text-primary" />
              <p className="text-xs text-muted-foreground">Streaming invoice PDF document...</p>
            </div>
          )}

          {error && !isLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
              <div className="size-12 rounded-full bg-rose-500/10 text-rose-600 flex items-center justify-center">
                <AlertCircle className="size-6" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-semibold">Failed to stream PDF</h4>
                <p className="text-xs text-muted-foreground max-w-sm">{error.message}</p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => refetch()}
                className="gap-1.5 text-xs"
              >
                <RotateCw className="size-3.5" />
                Retry
              </Button>
            </div>
          )}

          {pdfUrl && !isLoading && (
            <iframe
              ref={iframeRef}
              src={pdfUrl}
              title={`Invoice PDF ${invoiceNumber || invoiceId}`}
              className="w-full h-full border-0"
            />
          )}
        </div>

        <DialogFooter className="p-3 border-t border-border/70 flex items-center justify-between sm:justify-between bg-muted/10">
          <span className="text-[11px] font-mono text-muted-foreground">
            {invoiceNumber || invoiceId}
          </span>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="text-xs h-8"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
