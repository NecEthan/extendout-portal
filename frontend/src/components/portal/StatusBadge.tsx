import { Badge, type BadgeVariant } from "@/components/ui/badge";

const STATUS_VARIANTS: Record<string, BadgeVariant> = {
  // generic progress
  Complete: "success",
  Completed: "success",
  Ready: "success",
  Approved: "success",
  Paid: "success",
  Delivered: "success",
  Passed: "success",
  Resolved: "success",
  Active: "success",
  "In progress": "default",
  Scheduled: "neutral",
  Upcoming: "neutral",
  Draft: "outline",
  Pending: "warning",
  "Awaiting approval": "warning",
  Due: "warning",
  Open: "warning",
  Ordered: "neutral",
  "RFQ sent": "neutral",
  Required: "outline",
  "Needs attention": "destructive",
  Overdue: "destructive",
  Rejected: "destructive",
  Failed: "destructive",
  "Changes requested": "destructive",
  Delayed: "destructive",
};

export function StatusBadge({ status }: { status: string }) {
  return <Badge variant={STATUS_VARIANTS[status] ?? "neutral"}>{status}</Badge>;
}
