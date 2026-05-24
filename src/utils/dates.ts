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

export const toDateOrNull = (value: unknown): Date | null => {
  if (!value) {
    return null;
  }
  if (typeof value === "object" && value !== null && "toDate" in value) {
    return (value as { toDate: () => Date }).toDate();
  }
  return null;
};
