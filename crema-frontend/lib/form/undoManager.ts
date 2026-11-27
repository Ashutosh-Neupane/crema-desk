/**
 * Form undo / redo (Desk form/undo_manager.js): what the user typed or picked, not what scripts set. Crema's text
 * inputs report every keystroke, so back-to-back edits of the same field within MERGE_MS are one step, like
 * Desk's one change event per field edit.
 */
export interface Change {
  fieldname: string;
  old_value: unknown;
  new_value: unknown;
  /** child row edits */
  cdt?: string;
  cdn?: string;
}

const MERGE_MS = 1200;
const LIMIT = 200;

export class UndoManager {
  private undoStack: Change[] = [];
  private redoStack: Change[] = [];
  private lastAt = 0;

  record(c: Change, now = Date.now()) {
    if (Object.is(c.old_value, c.new_value)) return;
    const top = this.undoStack.at(-1);
    if (top && top.fieldname === c.fieldname && top.cdn === c.cdn && now - this.lastAt < MERGE_MS)
      top.new_value = c.new_value;
    else this.undoStack.push({ ...c });
    if (this.undoStack.length > LIMIT) this.undoStack.shift();
    this.redoStack = [];
    this.lastAt = now;
  }

  erase() {
    this.undoStack = [];
    this.redoStack = [];
    this.lastAt = 0;
  }

  /** the change to apply to undo (its old_value), moved to the redo stack; null when there is nothing */
  undo(): Change | null {
    return this.move(this.undoStack, this.redoStack);
  }

  redo(): Change | null {
    return this.move(this.redoStack, this.undoStack);
  }

  private move(from: Change[], to: Change[]): Change | null {
    const c = from.pop();
    if (!c) return null;
    to.push({ ...c, old_value: c.new_value, new_value: c.old_value });
    this.lastAt = 0;
    return c;
  }
}
