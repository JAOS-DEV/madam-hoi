export const formatDateTime = (value: unknown): string => {
  if (!value) {
    return "-";
  }

  if (typeof value === "object" && value !== null && "toDate" in value) {
    const date = (value as { toDate: () => Date }).toDate();
    return date.toLocaleString("th-TH");
  }

  return String(value);
};
