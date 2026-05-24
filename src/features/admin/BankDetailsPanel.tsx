import { useState } from "react";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import type { MainSettingsDoc } from "../../types/firestore";
import { updateSettingsPatch } from "./adminService";

interface BankDetailsPanelProps {
  settings: MainSettingsDoc;
}

export function BankDetailsPanel({ settings }: BankDetailsPanelProps): JSX.Element {
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
    <Card title="Bank details">
      <div className="space-y-3">
        <Input label="Bank name" value={bankName} onChange={(event) => setBankName(event.target.value)} />
        <Input label="Account name" value={accountName} onChange={(event) => setAccountName(event.target.value)} />
        <Input
          label="Account number"
          value={accountNumber}
          onChange={(event) => setAccountNumber(event.target.value)}
        />
        <Input label="Thai note" value={noteTh} onChange={(event) => setNoteTh(event.target.value)} />
        <Input label="English note" value={noteEn} onChange={(event) => setNoteEn(event.target.value)} />
        <Button onClick={save}>Save bank details</Button>
      </div>
    </Card>
  );
}
