"use client";

import { memo, useId } from "react";
import type { FieldControlProps } from "./index";
import FormField from "./FormField";
import SelectField from "./SelectField";
import DateField from "./DateField";
import DateTimeField from "./DateTimeField";
import CheckField from "./CheckField";
import TextEditorField from "./TextEditorField";
import LinkField from "./LinkField";
import AttachmentField from "./AttachmentField";
import TableField from "./TableField";
import HTMLField from "./HTMLField";
import CodeField from "./CodeField";
import ReadOnlyField from "./ReadOnlyField";
import PasswordField from "./PasswordField";
import GeolocationField from "./GeolocationField";
import SignatureField from "./SignatureField";
import RatingField from "./RatingField";
import BarcodeField from "./BarcodeField";
import DurationField from "./DurationField";
import JSONField from "./JSONField";
import TableMultiSelectField from "./TableMultiSelectField";
import ColorField from "./ColorField";
import IconField from "./IconField";
import MarkdownField from "./MarkdownField";
import HTMLEditorField from "./HTMLEditorField";
import PhoneField from "./PhoneField";
import AutocompleteField from "./AutocompleteField";
import MultiselectField from "./MultiselectField";
import AddressField from "./AddressField";
import TimeField from "./TimeField";
import ImageField from "./ImageField";
import ButtonField from "./ButtonField";
import DateRangeField from "./DateRangeField";
import MulticheckField from "./MulticheckField";
import MultiselectListField from "./MultiselectListField";
import SwitchField from "./SwitchField";
import CommentField from "./CommentField";
import HeadingField from "./HeadingField";
import NumberField from "./NumberField";
import DynamicLinkField from "./DynamicLinkField";

function FieldControl({ field, value, onChange, error, disabled = false, doc, getQuery }: FieldControlProps) {
  const inputId = `${useId()}-${field.fieldname}`;
  const props = {
    inputId,
    field,
    value,
    onChange,
    disabled: disabled || !!field.read_only,
    error,
    doc,
    getQuery,
  };

  const renderInput = () => {
    switch (field.fieldtype) {
      case "Select":
        return <SelectField {...props} />;
      case "Autocomplete":
        return <AutocompleteField {...props} />;
      case "MultiSelect":
        return <MultiselectField {...props} />;
      case "Date":
        return <DateField {...props} />;
      case "Datetime":
        return <DateTimeField {...props} />;
      case "Check":
        return <CheckField {...props} />;
      case "Int":
        return <NumberField {...props} />;
      case "Float":
        return <NumberField {...props} />;
      case "Currency":
        return <NumberField {...props} />;
      case "Text Editor":
        return <TextEditorField {...props} />;
      case "Link":
        return <LinkField {...props} />;
      case "Dynamic Link":
        // options names the field holding the target DocType
        return <DynamicLinkField {...props} parentValues={doc} />;
      case "Attach":
      case "Attach Image":
        return <AttachmentField {...props} />;
      case "Table":
        return <TableField {...props} />;
      case "HTML":
        return <HTMLField {...props} />;
      case "Code":
        return <CodeField {...props} />;
      case "Read Only":
        return <ReadOnlyField {...props} />;
      case "Password":
        return <PasswordField {...props} />;
      case "Geolocation":
        return <GeolocationField {...props} />;
      case "Signature":
        return <SignatureField {...props} />;
      case "Rating":
        return <RatingField {...props} />;
      case "Barcode":
        return <BarcodeField {...props} />;
      case "Duration":
        return <DurationField {...props} />;
      case "JSON":
        return <JSONField {...props} />;
      case "Table MultiSelect":
        return <TableMultiSelectField {...props} />;
      case "Color":
        return <ColorField {...props} />;
      case "Icon":
        return <IconField {...props} />;
      case "Markdown Editor":
        return <MarkdownField {...props} />;
      case "HTML Editor":
        return <HTMLEditorField {...props} />;
      case "Phone":
        return <PhoneField {...props} />;
      case "Address":
        return <AddressField {...props} />;
      case "Time":
        return <TimeField {...props} />;
      case "Percent":
        return <NumberField {...props} />;
      case "Image":
        return <ImageField {...props} />;
      case "Button":
        return <ButtonField {...props} />;
      case "Date Range":
        return <DateRangeField {...props} />;
      case "MultiCheck":
        return <MulticheckField {...props} />;
      case "MultiSelect List":
        return <MultiselectListField {...props} />;
      case "Switch":
        return <SwitchField {...props} />;
      case "Comment":
        return <CommentField {...props} />;
      case "Heading":
        return <HeadingField {...props} />;
      default:
        return <FormField {...props} />;
    }
  };

  // Layout-only fieldtypes don't render a field label
  const showLabel = !["HTML", "Button", "Heading", "Check"].includes(field.fieldtype);

  return (
    <div className={`flex flex-col gap-1.5 ${field.fullWidth ? "col-span-full" : ""}`}>
      {showLabel && (
        <label htmlFor={inputId} className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          {field.label || field.fieldname}
          {/* reqd is 0/1 from Frappe — `{0 && …}` would render a literal "0" */}
          {!!field.reqd && <span aria-hidden="true" className="ml-1 text-red-500">*</span>}
        </label>
      )}
      {renderInput()}
      {error && <span className="text-xs text-red-600 dark:text-red-400">{error}</span>}
      {field.description && !error && (
        <span className="text-xs text-zinc-500 dark:text-zinc-400">{field.description}</span>
      )}
    </div>
  );
}

export default memo(FieldControl);
