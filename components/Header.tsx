import { authEnabled } from "@/lib/auth";
import { isSampleMode } from "@/lib/config";
import { Rail, type Section } from "./nest/Rail";

/** Team pages: the Nest rail down the left, the page beside it. */
export function TeamShell({ active, children }: { active?: Section; children: React.ReactNode }) {
  return (
    <Rail active={active} signOut={authEnabled()}>
      {isSampleMode() && (
        <div className="banner">
          <strong>Sample data.</strong> Add your Airtable keys to go live.
        </div>
      )}
      {children}
    </Rail>
  );
}
