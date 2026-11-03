import { ShieldCheck } from "lucide-react";

import { AlbumProducer } from "./AlbumProducer";
import { useAdminStatus } from "./auth";
import { Panel } from "./Field";
import { LabPicksAdmin } from "./LabPicksAdmin";

/** The admin's Lab: Lab Picks and the Album Producer. Everyone else sees a short note. */
export function LabStudio({ onGoTab }: { onGoTab: (tab: string) => void }) {
  const { isAdmin } = useAdminStatus();
  if (!isAdmin) {
    return (
      <Panel title="Lab" subtitle="This page is for the site admin.">
        <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
          <ShieldCheck className="size-4" /> Sign in with the admin account to use the Lab.
        </p>
      </Panel>
    );
  }
  return (
    <div className="space-y-5">
      <LabPicksAdmin />
      <AlbumProducer onGoTab={onGoTab} />
    </div>
  );
}
