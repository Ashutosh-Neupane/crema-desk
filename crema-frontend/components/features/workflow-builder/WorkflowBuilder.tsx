"use client";

import { useState, useCallback } from "react";
import { Card } from "@/components/shadcn/card";
import { Button } from "@/components/shadcn/button";
import { Input } from "@/components/shadcn/input";
import { Label } from "@/components/shadcn/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/shadcn/dialog";
import {
  Plus,
  Trash2,
  Save,
  ArrowRight,
  GripVertical,
} from "lucide-react";

interface WorkflowState {
  name: string;
  title: string;
  color: string;
  isInitial?: boolean;
  isFinal?: boolean;
}

interface WorkflowTransition {
  name: string;
  fromState: string;
  toState: string;
  action: string;
  condition?: string;
  allowedRoles?: string[];
}

interface WorkflowConfig {
  name: string;
  doctype: string;
  states: WorkflowState[];
  transitions: WorkflowTransition[];
  isActive: boolean;
}

interface WorkflowBuilderProps {
  doctype?: string;
  initialConfig?: WorkflowConfig;
  onSave?: (config: WorkflowConfig) => void;
}

const STATE_COLORS = ["#3b82f6", "#22c55e", "#ef4444", "#f59e0b", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"];

export function WorkflowBuilder({ doctype, initialConfig, onSave }: WorkflowBuilderProps) {
  const [config, setConfig] = useState<WorkflowConfig>(
    initialConfig ?? {
      name: `${doctype ?? "Document"} Workflow`,
      doctype: doctype ?? "Document",
      states: [
        { name: "Draft", title: "Draft", color: "#f59e0b", isInitial: true },
        { name: "Submitted", title: "Submitted", color: "#22c55e", isFinal: true },
        { name: "Cancelled", title: "Cancelled", color: "#ef4444" },
      ],
      transitions: [
        { name: "Submit", fromState: "Draft", toState: "Submitted", action: "Submit" },
        { name: "Cancel", fromState: "Submitted", toState: "Cancelled", action: "Cancel" },
        { name: "Amend", fromState: "Cancelled", toState: "Draft", action: "Amend" },
      ],
      isActive: false,
    },
  );
  const [stateDialogOpen, setStateDialogOpen] = useState(false);
  const [transitionDialogOpen, setTransitionDialogOpen] = useState(false);
  const [editingState, setEditingState] = useState<WorkflowState | null>(null);
  const [editingTransition, setEditingTransition] = useState<WorkflowTransition | null>(null);

  const addState = useCallback(() => {
    const newState: WorkflowState = {
      name: `state_${config.states.length + 1}`,
      title: `State ${config.states.length + 1}`,
      color: STATE_COLORS[config.states.length % STATE_COLORS.length],
    };
    setEditingState(newState);
    setStateDialogOpen(true);
  }, [config.states.length]);

  const saveState = useCallback(() => {
    if (!editingState) return;
    setConfig((prev) => {
      const existing = prev.states.findIndex((s) => s.name === editingState.name);
      if (existing >= 0) {
        const states = [...prev.states];
        states[existing] = editingState;
        return { ...prev, states };
      }
      return { ...prev, states: [...prev.states, editingState] };
    });
    setStateDialogOpen(false);
    setEditingState(null);
  }, [editingState]);

  const removeState = useCallback((stateName: string) => {
    setConfig((prev) => ({
      ...prev,
      states: prev.states.filter((s) => s.name !== stateName),
      transitions: prev.transitions.filter((t) => t.fromState !== stateName && t.toState !== stateName),
    }));
  }, []);

  const addTransition = useCallback(() => {
    const newTransition: WorkflowTransition = {
      name: `trans_${config.transitions.length + 1}`,
      fromState: config.states[0]?.name ?? "",
      toState: config.states[1]?.name ?? "",
      action: `Action ${config.transitions.length + 1}`,
    };
    setEditingTransition(newTransition);
    setTransitionDialogOpen(true);
  }, [config.states, config.transitions.length]);

  const saveTransition = useCallback(() => {
    if (!editingTransition) return;
    setConfig((prev) => {
      const existing = prev.transitions.findIndex((t) => t.name === editingTransition.name);
      if (existing >= 0) {
        const transitions = [...prev.transitions];
        transitions[existing] = editingTransition;
        return { ...prev, transitions };
      }
      return { ...prev, transitions: [...prev.transitions, editingTransition] };
    });
    setTransitionDialogOpen(false);
    setEditingTransition(null);
  }, [editingTransition]);

  const removeTransition = useCallback((transName: string) => {
    setConfig((prev) => ({
      ...prev,
      transitions: prev.transitions.filter((t) => t.name !== transName),
    }));
  }, []);

  const handleSave = useCallback(() => {
    onSave?.(config);
  }, [config, onSave]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Input
            value={config.name}
            onChange={(e) => setConfig((prev) => ({ ...prev, name: e.target.value }))}
            className="w-64 text-sm font-medium"
          />
          <span className="text-xs text-zinc-500">{doctype}</span>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={config.isActive}
              onChange={(e) => setConfig((prev) => ({ ...prev, isActive: e.target.checked }))}
              className="rounded border-zinc-300"
            />
            Active
          </label>
          <Button size="sm" onClick={handleSave}>
            <Save className="h-4 w-4 mr-1" />
            Save
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* States */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">States</h3>
            <Button variant="outline" size="sm" onClick={addState}>
              <Plus className="h-3 w-3 mr-1" />
              Add State
            </Button>
          </div>
          <div className="space-y-2">
            {config.states.map((state) => (
              <div
                key={state.name}
                className="flex items-center justify-between rounded-lg border border-zinc-200 p-3 dark:border-zinc-700"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="h-4 w-4 rounded-full"
                    style={{ backgroundColor: state.color }}
                  />
                  <div>
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{state.title}</p>
                    <p className="text-xs text-zinc-500">{state.name}</p>
                  </div>
                  <div className="flex gap-1 ml-2">
                    {state.isInitial && (
                      <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                        Initial
                      </span>
                    )}
                    {state.isFinal && (
                      <span className="rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                        Final
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => {
                      setEditingState(state);
                      setStateDialogOpen(true);
                    }}
                  >
                    <GripVertical className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-red-500"
                    onClick={() => removeState(state.name)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
            {config.states.length === 0 && (
              <p className="text-sm text-zinc-500 text-center py-4">No states defined</p>
            )}
          </div>
        </Card>

        {/* Transitions */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Transitions</h3>
            <Button variant="outline" size="sm" onClick={addTransition}>
              <Plus className="h-3 w-3 mr-1" />
              Add Transition
            </Button>
          </div>
          <div className="space-y-2">
            {config.transitions.map((trans) => (
              <div
                key={trans.name}
                className="flex items-center justify-between rounded-lg border border-zinc-200 p-3 dark:border-zinc-700"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{trans.action}</span>
                  <ArrowRight className="h-3 w-3 text-zinc-400" />
                  <span className="text-xs text-zinc-500">{trans.fromState} → {trans.toState}</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-red-500"
                  onClick={() => removeTransition(trans.name)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
            {config.transitions.length === 0 && (
              <p className="text-sm text-zinc-500 text-center py-4">No transitions defined</p>
            )}
          </div>
        </Card>
      </div>

      {/* Visual workflow diagram */}
      <Card className="p-6">
        <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-4">Workflow Diagram</h3>
        <div className="flex items-center justify-center gap-2 flex-wrap">
          {config.states.map((state, i) => (
            <div key={state.name} className="flex items-center gap-2">
              <div className="flex flex-col items-center gap-1">
                <div
                  className="flex h-12 w-24 items-center justify-center rounded-lg text-xs font-medium text-white shadow-sm"
                  style={{ backgroundColor: state.color }}
                >
                  {state.title}
                </div>
                {state.isInitial && <span className="text-[10px] text-blue-500">START</span>}
                {state.isFinal && <span className="text-[10px] text-green-500">END</span>}
              </div>
              {i < config.states.length - 1 && (
                <ArrowRight className="h-5 w-5 text-zinc-400" />
              )}
            </div>
          ))}
        </div>
        {config.states.length === 0 && (
          <p className="text-sm text-zinc-500 text-center">Add states to see the workflow diagram</p>
        )}
      </Card>

      {/* State dialog */}
      <Dialog open={stateDialogOpen} onOpenChange={setStateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingState && config.states.some(s => s.name === editingState.name) ? "Edit State" : "Add State"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Name</Label>
              <Input
                value={editingState?.name ?? ""}
                onChange={(e) => setEditingState((prev) => prev ? { ...prev, name: e.target.value } : null)}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Title</Label>
              <Input
                value={editingState?.title ?? ""}
                onChange={(e) => setEditingState((prev) => prev ? { ...prev, title: e.target.value } : null)}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Color</Label>
              <input aria-label="State color"
                type="color"
                value={editingState?.color ?? "#3b82f6"}
                onChange={(e) => setEditingState((prev) => prev ? { ...prev, color: e.target.value } : null)}
                className="mt-1 h-10 w-full rounded-lg border border-zinc-300 p-1 dark:border-zinc-700"
              />
            </div>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={editingState?.isInitial ?? false}
                  onChange={(e) => setEditingState((prev) => prev ? { ...prev, isInitial: e.target.checked } : null)}
                  className="rounded border-zinc-300"
                />
                Initial State
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={editingState?.isFinal ?? false}
                  onChange={(e) => setEditingState((prev) => prev ? { ...prev, isFinal: e.target.checked } : null)}
                  className="rounded border-zinc-300"
                />
                Final State
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStateDialogOpen(false)}>Cancel</Button>
            <Button onClick={saveState}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transition dialog */}
      <Dialog open={transitionDialogOpen} onOpenChange={setTransitionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Transition</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Action</Label>
              <Input
                value={editingTransition?.action ?? ""}
                onChange={(e) => setEditingTransition((prev) => prev ? { ...prev, action: e.target.value } : null)}
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>From State</Label>
                <select aria-label="From state"
                  value={editingTransition?.fromState ?? ""}
                  onChange={(e) => setEditingTransition((prev) => prev ? { ...prev, fromState: e.target.value } : null)}
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                >
                  {config.states.map((s) => (
                    <option key={s.name} value={s.name}>{s.title}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label>To State</Label>
                <select aria-label="To state"
                  value={editingTransition?.toState ?? ""}
                  onChange={(e) => setEditingTransition((prev) => prev ? { ...prev, toState: e.target.value } : null)}
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                >
                  {config.states.map((s) => (
                    <option key={s.name} value={s.name}>{s.title}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <Label>Condition (optional)</Label>
              <Input
                value={editingTransition?.condition ?? ""}
                onChange={(e) => setEditingTransition((prev) => prev ? { ...prev, condition: e.target.value } : null)}
                placeholder="e.g. doc.total > 0"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Allowed Roles (comma-separated)</Label>
              <Input
                value={editingTransition?.allowedRoles?.join(", ") ?? ""}
                onChange={(e) => setEditingTransition((prev) => prev ? { ...prev, allowedRoles: e.target.value.split(",").map(r => r.trim()) } : null)}
                placeholder="e.g. System Manager, Accounts Manager"
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransitionDialogOpen(false)}>Cancel</Button>
            <Button onClick={saveTransition}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
