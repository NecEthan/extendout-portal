import type { DocumentVersionStatus } from "@/interfaces";

export const STATUS_STYLES: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-800",
  PROCESSING: "bg-yellow-100 text-yellow-800",
  SUPERSEDED: "bg-gray-100 text-gray-500",
  FAILED: "bg-red-100 text-red-700",
  DELETED: "bg-gray-100 text-gray-400",
  REVIEW_REQUIRED: "bg-orange-100 text-orange-800",
};

export function isProcessing(status: DocumentVersionStatus | string | null | undefined) {
  return status === "PROCESSING";
}
