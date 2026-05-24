import { useState } from "react";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import type { Translation } from "../../i18n";
import { loginAdmin } from "./adminService";

interface AdminLoginProps {
  t: Translation;
}

export function AdminLogin({ t }: AdminLoginProps): JSX.Element {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (): Promise<void> => {
    setLoading(true);
    setError("");
    try {
      await loginAdmin(email, password);
    } catch (loginError) {
      const message = loginError instanceof Error ? loginError.message : "Login failed";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto max-w-md p-4">
      <Card title={t.adminLogin}>
        <div className="space-y-3">
          <Input label={t.adminEmail} value={email} onChange={(event) => setEmail(event.target.value)} />
          <Input
            label={t.adminPassword}
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          {error ? <p className="text-sm text-red-700">{error}</p> : null}
          <Button fullWidth onClick={handleLogin} disabled={loading}>
            {loading ? "..." : t.signIn}
          </Button>
        </div>
      </Card>
    </main>
  );
}
