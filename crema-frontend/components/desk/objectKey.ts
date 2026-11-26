/**
 * A stable React key for an object that has no id of its own (script-built dialog actions, navbar rows): the same
 * object always gets the same key, so a list keeps its identity when entries are added, removed or reordered.
 */
const keys = new WeakMap<object, string>();
let seq = 0;

export function objectKey(o: object): string {
  let k = keys.get(o);
  if (!k) {
    k = `k${++seq}`;
    keys.set(o, k);
  }
  return k;
}
