/**
 * Shared Desk filter model for list-like views, kept as one import path: the model (filterModel.ts) and its two
 * controls (FilterEditor.tsx, GroupBy.tsx) live in their own modules so each component file exports only components.
 */
export {
  NO_VALUE,
  OPERATORS,
  STD_FIELD_LABELS,
  describeValue,
  fieldLabel,
  filterableFields,
  filtersFromParams,
} from "@/components/list/filterModel";
export { default as FilterEditor } from "@/components/list/FilterEditor";
export { default as GroupBy } from "@/components/list/GroupBy";
