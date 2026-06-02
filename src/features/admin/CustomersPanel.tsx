import { useMemo, useState } from "react";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import type { ToastTone } from "../../hooks/useToast";
import type { Language } from "../../i18n";
import type { CustomerProfileDoc } from "../../types/firestore";
import { formatDateTime } from "../../utils/dates";
import { deleteCustomerProfile, updateCustomerProfile } from "./adminService";

interface CustomersPanelProps {
  customers: CustomerProfileDoc[];
  language: Language;
  onToast: (message: string, tone: ToastTone) => void;
}

interface CustomerDraft {
  name: string;
  phone: string;
  email: string;
  defaultDeliveryLocation: string;
  notes: string;
}

function toCustomerDraft(customer: CustomerProfileDoc): CustomerDraft {
  return {
    name: customer.name,
    phone: customer.phone,
    email: customer.email ?? "",
    defaultDeliveryLocation: customer.defaultDeliveryLocation ?? "",
    notes: customer.notes ?? "",
  };
}

export function CustomersPanel({ customers, language, onToast }: CustomersPanelProps): JSX.Element {
  const [search, setSearch] = useState("");
  const [editingById, setEditingById] = useState<Record<string, CustomerDraft>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const visibleCustomers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return customers;
    }
    return customers.filter((customer) =>
      `${customer.name} ${customer.phone} ${customer.email ?? ""} ${customer.defaultDeliveryLocation ?? ""} ${customer.notes ?? ""}`
        .toLowerCase()
        .includes(query),
    );
  }, [customers, search]);

  const updateDraft = (customerId: string, patch: Partial<CustomerDraft>): void => {
    setEditingById((prev) => ({
      ...prev,
      [customerId]: {
        ...prev[customerId],
        ...patch,
      },
    }));
  };

  const cancelEdit = (customerId: string): void => {
    setEditingById((prev) => {
      const next = { ...prev };
      delete next[customerId];
      return next;
    });
  };

  const handleSave = async (customerId: string): Promise<void> => {
    const draft = editingById[customerId];
    if (!draft?.name.trim() || !draft.phone.trim()) {
      onToast(language === "th" ? "กรุณากรอกชื่อลูกค้าและเบอร์โทร" : "Please enter customer name and phone.", "error");
      return;
    }
    setSavingId(customerId);
    try {
      await updateCustomerProfile(customerId, {
        name: draft.name.trim(),
        phone: draft.phone.trim(),
        email: draft.email.trim(),
        defaultDeliveryLocation: draft.defaultDeliveryLocation.trim(),
        notes: draft.notes.trim(),
      });
      cancelEdit(customerId);
      onToast(language === "th" ? "บันทึกลูกค้าแล้ว" : "Customer saved.", "success");
    } catch {
      onToast(language === "th" ? "เกิดข้อผิดพลาด" : "Something went wrong.", "error");
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async (customer: CustomerProfileDoc): Promise<void> => {
    const confirmed = window.confirm(
      language === "th" ? `ลบลูกค้า ${customer.name}?` : `Delete customer ${customer.name}?`,
    );
    if (!confirmed) {
      return;
    }
    setDeletingId(customer.id);
    try {
      await deleteCustomerProfile(customer.id);
      onToast(language === "th" ? "ลบลูกค้าแล้ว" : "Customer deleted.", "success");
    } catch {
      onToast(language === "th" ? "เกิดข้อผิดพลาด" : "Something went wrong.", "error");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Card
      title={language === "th" ? "ลูกค้า" : "Customers"}
      collapsible
      collapseStorageKey="admin.section.customers"
      defaultCollapsed
    >
      <div className="space-y-3">
        <Input
          label={language === "th" ? "ค้นหาลูกค้า" : "Search customers"}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={language === "th" ? "ชื่อ เบอร์โทร ที่อยู่ หรือโน้ต" : "Name, phone, address, or notes"}
        />
        <p className="text-xs text-slate-600">
          {language === "th"
            ? "ลูกค้าเหล่านี้ถูกบันทึกจากออเดอร์ที่แอดมินกรอกเอง"
            : "These customers are saved from admin-entered orders."}
        </p>

        <div className="space-y-3">
          {visibleCustomers.map((customer) => {
            const draft = editingById[customer.id];
            return (
              <article key={customer.id} className="rounded-lg border border-brand-gold/30 bg-white p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-brand-redDark">{customer.name}</p>
                    <p className="text-sm text-slate-700">{customer.phone}</p>
                    {customer.defaultDeliveryLocation ? (
                      <p className="mt-1 line-clamp-2 text-xs text-slate-600">{customer.defaultDeliveryLocation}</p>
                    ) : null}
                    {customer.lastOrderAt ? (
                      <p className="mt-1 text-[11px] text-slate-500">
                        {language === "th" ? "ออเดอร์ล่าสุด" : "Last order"}: {formatDateTime(customer.lastOrderAt)}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex w-full flex-wrap gap-2 sm:w-auto">
                    {draft ? (
                      <Button size="compact" variant="secondary" onClick={() => cancelEdit(customer.id)}>
                        {language === "th" ? "ยกเลิก" : "Cancel"}
                      </Button>
                    ) : (
                      <Button
                        size="compact"
                        variant="secondary"
                        onClick={() => setEditingById((prev) => ({ ...prev, [customer.id]: toCustomerDraft(customer) }))}
                      >
                        {language === "th" ? "แก้ไข" : "Edit"}
                      </Button>
                    )}
                    <Button
                      size="compact"
                      variant="danger"
                      onClick={() => void handleDelete(customer)}
                      disabled={deletingId === customer.id}
                    >
                      {deletingId === customer.id
                        ? language === "th"
                          ? "กำลังลบ..."
                          : "Deleting..."
                        : language === "th"
                          ? "ลบ"
                          : "Delete"}
                    </Button>
                  </div>
                </div>

                {draft ? (
                  <div className="mt-3 space-y-3 border-t border-brand-gold/30 pt-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Input
                        label={language === "th" ? "ชื่อลูกค้า" : "Customer name"}
                        value={draft.name}
                        onChange={(event) => updateDraft(customer.id, { name: event.target.value })}
                      />
                      <Input
                        label={language === "th" ? "เบอร์โทร" : "Phone"}
                        value={draft.phone}
                        onChange={(event) => updateDraft(customer.id, { phone: event.target.value })}
                      />
                      <Input
                        label={language === "th" ? "อีเมล" : "Email"}
                        value={draft.email}
                        onChange={(event) => updateDraft(customer.id, { email: event.target.value })}
                      />
                      <Input
                        label={language === "th" ? "สถานที่จัดส่งเริ่มต้น" : "Default delivery location"}
                        value={draft.defaultDeliveryLocation}
                        onChange={(event) => updateDraft(customer.id, { defaultDeliveryLocation: event.target.value })}
                      />
                    </div>
                    <Input
                      label={language === "th" ? "โน้ต" : "Notes"}
                      value={draft.notes}
                      onChange={(event) => updateDraft(customer.id, { notes: event.target.value })}
                    />
                    <Button
                      size="compact"
                      onClick={() => void handleSave(customer.id)}
                      disabled={savingId === customer.id}
                    >
                      {savingId === customer.id
                        ? language === "th"
                          ? "กำลังบันทึก..."
                          : "Saving..."
                        : language === "th"
                          ? "บันทึก"
                          : "Save"}
                    </Button>
                  </div>
                ) : null}
              </article>
            );
          })}
          {visibleCustomers.length === 0 ? (
            <p className="text-sm text-slate-500">
              {language === "th" ? "ยังไม่มีลูกค้าที่บันทึกไว้" : "No saved customers yet."}
            </p>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
