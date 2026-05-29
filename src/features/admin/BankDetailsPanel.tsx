import { useState } from "react";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import type { ToastTone } from "../../hooks/useToast";
import type { Translation } from "../../i18n";
import type { MainSettingsDoc } from "../../types/firestore";
import { getAdminErrorMessage } from "./adminToastErrors";
import { updateSettingsPatch } from "./adminService";

interface BankDetailsPanelProps {
  settings: MainSettingsDoc;
  t: Translation;
  onToast: (message: string, tone: ToastTone) => void;
}

export function BankDetailsPanel({ settings, t, onToast }: BankDetailsPanelProps): JSX.Element {
  const [bankName, setBankName] = useState(settings.bankTransfer.bankName);
  const [accountName, setAccountName] = useState(settings.bankTransfer.accountName);
  const [accountNumber, setAccountNumber] = useState(settings.bankTransfer.accountNumber);
  const [noteTh, setNoteTh] = useState(settings.bankTransfer.noteTh);
  const [noteEn, setNoteEn] = useState(settings.bankTransfer.noteEn);
  const [isSaving, setIsSaving] = useState(false);

  const save = async (): Promise<void> => {
    setIsSaving(true);
    try {
      await updateSettingsPatch({
        bankTransfer: {
          ...settings.bankTransfer,
          bankName,
          accountName,
          accountNumber,
          noteTh,
          noteEn,
        },
      });
      onToast(t.toastBankDetailsSaved, "success");
    } catch (error) {
      onToast(getAdminErrorMessage(error, t), "error");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card title={t.adminBankTitle} collapsible collapseStorageKey="admin.section.bank">
      <div className="space-y-3">
        <Input label={t.bankNameLabel} value={bankName} onChange={(event) => setBankName(event.target.value)} />
        <Input label={t.accountNameLabel} value={accountName} onChange={(event) => setAccountName(event.target.value)} />
        <Input
          label={t.accountNumberLabel}
          value={accountNumber}
          onChange={(event) => setAccountNumber(event.target.value)}
        />
        <Input label={t.thaiNoteLabel} value={noteTh} onChange={(event) => setNoteTh(event.target.value)} />
        <Input label={t.englishNoteLabel} value={noteEn} onChange={(event) => setNoteEn(event.target.value)} />
        <Button onClick={() => void save()} disabled={isSaving} aria-busy={isSaving}>
          {isSaving ? (
            <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent align-middle" />
          ) : null}
          {t.saveBankDetails}
        </Button>
      </div>
    </Card>
  );
}
