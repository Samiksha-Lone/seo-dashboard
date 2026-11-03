const clientFields = ["businessName", "businessType", "city", "state", "phone"];
const websiteFields = ["name", "url", "clientId"];

function validateString(value, label, maxLength, optional = false) {
  if (optional && (value === undefined || value === null || value === "")) {
    return { value: null };
  }
  if (typeof value !== "string" || !value.trim()) {
    return { error: `${label} is required.` };
  }
  const trimmed = value.trim();
  if (trimmed.length > maxLength) {
    return { error: `${label} must be ${maxLength} characters or fewer.` };
  }
  return { value: trimmed };
}

function validateObject(body, fields) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return "Request body must be a JSON object.";
  }
  const unexpected = Object.keys(body).find((key) => !fields.includes(key));
  return unexpected ? `Unexpected field: ${unexpected}.` : null;
}

export function validateClientInput(body, { partial = false } = {}) {
  const objectError = validateObject(body, clientFields);
  if (objectError) return { error: objectError };

  const limits = {
    businessName: ["Business name", 160],
    businessType: ["Business type", 100],
    city: ["City", 100],
    state: ["State", 100],
    phone: ["Phone", 40],
  };
  const data = {};

  for (const field of clientFields) {
    if (partial && !Object.hasOwn(body, field)) continue;
    const [label, limit] = limits[field];
    const result = validateString(body[field], label, limit, field === "phone");
    if (result.error) return { error: result.error };
    data[field] = result.value;
  }

  if (partial && Object.keys(data).length === 0) {
    return { error: "Provide at least one client field to update." };
  }
  return { data };
}

export function normalizeWebsiteUrl(value) {
  if (typeof value !== "string" || !value.trim()) {
    return { error: "Website URL is required." };
  }
  if (value.trim().length > 2048) {
    return { error: "Website URL must be 2048 characters or fewer." };
  }

  let parsed;
  try {
    parsed = new URL(value.trim());
  } catch {
    return { error: "Enter a valid HTTP or HTTPS URL." };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { error: "Website URL must use HTTP or HTTPS." };
  }
  if (parsed.username || parsed.password) {
    return { error: "Website URL must not contain credentials." };
  }

  const normalizedPath = parsed.pathname.replace(/\/+$/, "") || "/";
  const duplicateKey = `${parsed.protocol}//${parsed.host.toLowerCase()}${normalizedPath}`;
  return { value: parsed.href, duplicateKey };
}

export function validateWebsiteInput(body, { partial = false } = {}) {
  const objectError = validateObject(body, websiteFields);
  if (objectError) return { error: objectError };

  const data = {};
  if (!partial || Object.hasOwn(body, "name")) {
    const name = validateString(body.name, "Website name", 160);
    if (name.error) return { error: name.error };
    data.name = name.value;
  }
  if (!partial || Object.hasOwn(body, "url")) {
    const url = normalizeWebsiteUrl(body.url);
    if (url.error) return { error: url.error };
    data.url = url.value;
    data.duplicateKey = url.duplicateKey;
  }
  if (!partial || Object.hasOwn(body, "clientId")) {
    const clientId = validateString(body.clientId, "Client", 200);
    if (clientId.error) return { error: clientId.error };
    data.clientId = clientId.value;
  }

  if (partial && Object.keys(data).length === 0) {
    return { error: "Provide at least one website field to update." };
  }
  return { data };
}

export function websiteUrlDuplicateKey(value) {
  const result = normalizeWebsiteUrl(value);
  return result.error ? null : result.duplicateKey;
}
