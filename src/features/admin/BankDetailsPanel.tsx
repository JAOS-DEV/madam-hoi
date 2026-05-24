import { useState } from "react";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import type { Translation } from "../../i18n";
import type { MainSettingsDoc } from "../../types/firestore";
import { updateSettingsPatch } from "./adminService";

interface BankDetailsPanelProps {
  settings: MainSettingsDoc;
  t: Translation;
}

export function BankDetailsPanel({ settings, t }: BankDetailsPanelProps): JSX.Element {
  const [bankName, setBankName] = useState(settings.bankTransfer.bankName);
  const [accountName, setAccountName] = useState(settings.bankTransfer.accountName);
  const [accountNumber, setAccountNumber] = useState(settings.bankTransfer.accountNumber);
  const [noteTh, setNoteTh] = useState(settings.bankTransfer.noteTh);
  const [noteEn, setNoteEn] = useState(settings.bankTransfer.noteEn);

  const save = async (): Promise<void> => {
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
  };

  return (
    <Card title={t.adminBankTitle}>
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
        <Button onClick={save}>{t.saveBankDetails}</Button>
      </div>
    </Card>
  );
}
