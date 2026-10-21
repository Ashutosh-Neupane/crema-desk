// Client-side validation for Data fields with an `options` of Email, Phone, URL or Name.
// Transcribed from Frappe Desk:
//   - public/js/frappe/utils/utils.js       frappe.utils.validate_type / split_emails
//   - public/js/frappe/utils/datatype.js    validate_email / validate_phone / validate_name / validate_url
//   - public/js/frappe/form/controls/data.js ControlData.validate (which option runs which check)
// Message text mirrors the server (frappe/utils/__init__.py), which is what Desk shows on save.
// Desk has no client-side IBAN check (it only formats on blur), so IBAN is intentionally not validated here.

export type DataOption = "Email" | "Phone" | "URL" | "Name" | "IBAN";

type ValidateType = "phone" | "name" | "email" | "url";

const PATTERNS: Record<ValidateType, RegExp> = {
  phone: /^([0-9 +_\-,.*#()]){1,20}$/,
  name: /^[\w][\w'-]*([ \w][\w'-]+)*$/,
  // from https://emailregex.com/
  email:
    /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/,
  url: /^((([A-Za-z0-9.+-]+:(?:\/\/)?)(?:[-;:&=+,\w]@)?[A-Za-z0-9.-]+(:[0-9]+)?|(?:www.|[-;:&=+$,\w]+@)[A-Za-z0-9.-]+)((?:\/[+~%/.\w-_]*)?\??(?:[-+=&;%@.\w_]*)#?(?:\w*))?)$/i,
};

/** frappe.utils.validate_type: an empty value is never valid. */
export function validateType(val: string, type: ValidateType): boolean {
  return val !== "" && PATTERNS[type].test(val);
}

/** frappe.utils.split_emails: split on commas or newlines (not inside quotes), trim, drop empties. */
export function splitEmails(txt: string): string[] {
  if (!txt) return [];
  return txt
    .split(/[,\n](?=(?:[^"]|"[^"]*")*$)/)
    .map((email) => email.trim())
    .filter(Boolean);
}

export function validateEmail(txt: string): boolean {
  return validateType(txt, "email");
}

export function validatePhone(txt: string): boolean {
  return validateType(txt, "phone");
}

export function validateName(txt: string): boolean {
  return validateType(txt, "name");
}

export function validateUrl(txt: string): boolean {
  return validateType(txt, "url");
}

/**
 * Desk's ControlData.validate for a Data field. Returns the message to show under the
 * field, or null when the value is acceptable (including an empty value).
 */
export function getDataFieldError(value: string, option: string | null | undefined): string | null {
  if (!value) return null;
  switch (option) {
    case "Phone":
      return validatePhone(value) ? null : `${value} is not a valid Phone Number`;
    case "Name":
      return validateName(value) ? null : `${value} is not a valid Name`;
    case "Email": {
      // Desk allows several comma-separated addresses; the first bad one is reported.
      const bad = splitEmails(value).find((email) => !validateEmail(email));
      return bad === undefined ? null : `${bad} is not a valid Email Address`;
    }
    case "URL":
      return validateUrl(value) ? null : `'${value}' is not a valid URL`;
    default:
      return null;
  }
}
