import type { DocField } from "@/lib/frappe/types";

export interface FieldControlProps {
  field: DocField;
  value: unknown;
  onChange: (value: unknown) => void;
  error?: string;
  disabled?: boolean;
  /** Current document values — needed by controls that depend on other fields (Dynamic Link, set_query) */
  doc?: Record<string, unknown>;
  /** dense styling for grid cells */
  compact?: boolean;
  /** unique DOM id for the input (label htmlFor) — fieldnames repeat across forms/dialogs */
  inputId?: string;
  /** set_query result for Link fields: { filters, query } */
  getQuery?: () => { filters?: unknown; query?: string; params?: Record<string, unknown> } | undefined;
  /** Button fields: Desk triggers the form event named after the field */
  onClick?: () => void;
}

export { default as FormField } from "./FormField";
export { default as LinkField } from "./LinkField";
export { default as SelectField } from "./SelectField";
export { default as DateField } from "./DateField";
export { default as DateTimeField } from "./DateTimeField";
export { default as CheckField } from "./CheckField";
export { default as TextEditorField } from "./TextEditorField";
export { default as AttachmentField } from "./AttachmentField";
export { default as TableField } from "./TableField";
export { default as HTMLField } from "./HTMLField";
export { default as CodeField } from "./CodeField";
export { default as ReadOnlyField } from "./ReadOnlyField";
export { default as PasswordField } from "./PasswordField";
export { default as GeolocationField } from "./GeolocationField";
export { default as SignatureField } from "./SignatureField";
export { default as RatingField } from "./RatingField";
export { default as BarcodeField } from "./BarcodeField";
export { default as DurationField } from "./DurationField";
export { default as JSONField } from "./JSONField";
export { default as TableMultiSelectField } from "./TableMultiSelectField";
export { default as ColorField } from "./ColorField";
export { default as IconField } from "./IconField";
export { default as MarkdownField } from "./MarkdownField";
export { default as HTMLEditorField } from "./HTMLEditorField";
export { default as PhoneField } from "./PhoneField";
export { default as AutocompleteField } from "./AutocompleteField";
export { default as MultiselectField } from "./MultiselectField";
export { default as AddressField } from "./AddressField";
export { default as TimeField } from "./TimeField";
export { default as ImageField } from "./ImageField";
export { default as ButtonField } from "./ButtonField";
export { default as DateRangeField } from "./DateRangeField";
export { default as MulticheckField } from "./MulticheckField";
export { default as MultiselectListField } from "./MultiselectListField";
export { default as SwitchField } from "./SwitchField";
export { default as CommentField } from "./CommentField";
export { default as HeadingField } from "./HeadingField";
