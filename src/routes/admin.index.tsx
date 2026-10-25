import { createFileRoute, redirect } from "@tanstack/react-router";

/** Short address for the admin dashboard: /admin goes to the feedback and usage page. */
export const Route = createFileRoute("/admin/")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/feedback" });
  },
});
