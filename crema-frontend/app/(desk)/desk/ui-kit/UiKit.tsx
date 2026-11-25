"use client";

import { useState } from "react";
import { FilePlus2, Upload } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { BottomBar, DensitySwitch, EmptyState, LayoutSwitch, PageHeader, Section, SidePanel, StatusPill, Stepper, type Step } from "@/components/crema-ui";
import { useDensity, useNewLayout, type Density } from "@/lib/ui/newLayout";

const STEPS: Step[] = [
  { label: "Draft", state: "complete" },
  { label: "Pending approval", state: "current", description: "Waiting on Sales Manager" },
  { label: "Approved", state: "upcoming" },
  { label: "Delivered", state: "upcoming" },
];

const PILLS = [
  { label: "Draft", tone: "neutral" },
  { label: "To deliver", tone: "info" },
  { label: "Paid", tone: "success" },
  { label: "Overdue", tone: "warning" },
  { label: "Cancelled", tone: "danger" },
] as const;

const btnCls = "h-control! px-3 crema-focus";

function DensityDemo({ density }: { density: Density }) {
  const [panelOpen, setPanelOpen] = useState(false);
  const [dirty, setDirty] = useState(true);
  const name = density === "compact" ? "Compact" : "Comfortable";
  return (
    <div data-density={density} data-testid={`demo-${density}`} className="flex min-w-0 flex-col gap-stack rounded-card border border-dashed border-[var(--dark-border-color)] p-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">{name}</p>
      <PageHeader
        title={`SAL-ORD-0001 (${name})`}
        subtitle="Customer: Demo Customer · 3 items"
        status={<StatusPill tone="info">To deliver</StatusPill>}
        actions={
          <Button variant="outline" className={btnCls}>
            More
          </Button>
        }
        primaryAction={<Button className={btnCls}>Confirm order</Button>}
      >
        <Stepper steps={STEPS} label={`Order progress (${name})`} />
      </PageHeader>

      <Section title={`Status pills (${name})`} description="Plain word, colour and icon.">
        <div className="flex flex-wrap gap-2">
          {PILLS.map((p) => (
            <StatusPill key={p.label} tone={p.tone}>
              {p.label}
            </StatusPill>
          ))}
          <StatusPill indicator="green">Completed</StatusPill>
        </div>
      </Section>

      <Section title={`More details (${name})`} collapsible defaultOpen={false}>
        <p>Optional fields stay out of the way until needed.</p>
      </Section>

      <Section title={`Side panel (${name})`}>
        <Button variant="outline" className={btnCls} onClick={() => setPanelOpen(true)}>
          Open panel ({name})
        </Button>
        <SidePanel
          open={panelOpen}
          onOpenChange={setPanelOpen}
          title={`Preview (${name})`}
          description="SAL-ORD-0001 without leaving the page"
          footer={
            <>
              <Button variant="outline" className={btnCls} onClick={() => setPanelOpen(false)}>
                Cancel
              </Button>
              <Button className={btnCls} onClick={() => setPanelOpen(false)}>
                Save
              </Button>
            </>
          }
        >
          <label className="flex flex-col gap-1 text-sm">
            Customer name
            <input data-autofocus defaultValue="Demo Customer" className="crema-focus h-control rounded-control border border-[var(--dark-border-color)] bg-[var(--bg-color)] px-[var(--density-pad-x)]" />
          </label>
        </SidePanel>
      </Section>

      <Section title={`Empty state (${name})`}>
        <EmptyState
          headingLevel={3}
          title="No Sales Orders yet"
          description="Create your first order or import existing ones."
          icon={FilePlus2}
          actions={
            <>
              <Button className={btnCls}>Create Sales Order</Button>
              <Button variant="outline" className={btnCls}>
                <Upload className="mr-1 h-4 w-4" aria-hidden="true" /> Import
              </Button>
            </>
          }
        />
      </Section>

      <div className="relative h-40 overflow-y-auto rounded-card border border-[var(--border-color)]">
        <div className="h-48 p-3 text-sm text-[var(--text-muted)]">Scrollable content above a sticky bottom bar.</div>
        <BottomBar open={dirty} placement="sticky" label={`Unsaved changes (${name})`} message="You have unsaved changes">
          <Button variant="outline" className={btnCls} onClick={() => setDirty(false)}>
            Discard
          </Button>
          <Button className={btnCls} onClick={() => setDirty(false)}>
            Save
          </Button>
        </BottomBar>
      </div>
    </div>
  );
}

export default function UiKit() {
  const newLayout = useNewLayout();
  const density = useDensity();
  const [highContrast, setHighContrast] = useState(false);
  return (
    <div className="page-body px-gutter py-stack" data-contrast={highContrast ? "more" : undefined} data-testid="ui-kit">
      <PageHeader
        title="UI kit"
        subtitle="Phase 2 primitives (components/crema-ui) in both densities"
        status={<StatusPill tone={newLayout ? "success" : "neutral"}>{newLayout ? "New layout on" : "New layout off"}</StatusPill>}
        actions={
          <>
            <LayoutSwitch />
            <DensitySwitch />
            <label className="inline-flex min-h-control items-center gap-2 text-sm">
              <input type="checkbox" className="crema-focus h-4 w-4" checked={highContrast} onChange={(e) => setHighContrast(e.target.checked)} />
              High contrast
            </label>
          </>
        }
      />
      <p className="text-sm text-[var(--text-muted)]" data-testid="current-density">
        Your density: {density}
      </p>
      <div className="grid gap-stack lg:grid-cols-2">
        <DensityDemo density="comfortable" />
        <DensityDemo density="compact" />
      </div>
    </div>
  );
}
