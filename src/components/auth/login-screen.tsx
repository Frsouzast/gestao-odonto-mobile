"use client";

import { useState, useEffect } from "react";
import { useAuth, apiFetch } from "@/lib/auth-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Stethoscope } from "lucide-react";
import { toast } from "sonner";

interface LoginResp {
  token: string;
  usuario: {
    id: string;
    nome: string;
    email: string;
    papel: "dono" | "financeiro" | "recepcao";
  };
  clinica: { id: string; nome: string };
}

export function LoginScreen() {
  const setSessao = useAuth((s) => s.setSessao);

  // ---- login state ----
  const [loginEmail, setLoginEmail] = useState("");
  const [loginSenha, setLoginSenha] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  // ---- registro state ----
  const [regClinica, setRegClinica] = useState("");
  const [regNome, setRegNome] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regSenha, setRegSenha] = useState("");
  const [regLoading, setRegLoading] = useState(false);

  // Lembre do último e-mail usado (só o e-mail, nunca a senha).
  useEffect(() => {
    try {
      const lembrado = localStorage.getItem("ultimoEmail");
      if (lembrado) setLoginEmail(lembrado);
    } catch {}
  }, []);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setLoginLoading(true);
    try {
      const data = await apiFetch<LoginResp>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: loginEmail, senha: loginSenha }),
      });
      try {
        localStorage.setItem("ultimoEmail", loginEmail);
      } catch {}
      setSessao(data.token, { ...data.usuario, clinica: data.clinica });
      toast.success(`Bem-vindo, ${data.usuario.nome}!`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao entrar");
    } finally {
      setLoginLoading(false);
    }
  }

  async function registrar(e: React.FormEvent) {
    e.preventDefault();
    if (regSenha.length < 8) {
      toast.error("A senha precisa ter pelo menos 8 caracteres.");
      return;
    }
    setRegLoading(true);
    try {
      const data = await apiFetch<LoginResp>("/api/auth/registrar", {
        method: "POST",
        body: JSON.stringify({
          clinicaNome: regClinica,
          usuarioNome: regNome,
          email: regEmail,
          senha: regSenha,
        }),
      });
      try {
        localStorage.setItem("ultimoEmail", regEmail);
      } catch {}
      setSessao(data.token, { ...data.usuario, clinica: data.clinica });
      toast.success(`Conta criada! Bem-vindo, ${data.usuario.nome}.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao registrar");
    } finally {
      setRegLoading(false);
    }
  }

  return (
    <div className="flex-1 flex items-center justify-center px-4 py-10 bg-gradient-to-br from-[var(--bg-app)] to-[var(--bg-app-alt-strong)]">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-2 justify-center mb-6">
          <div className="w-10 h-10 rounded-xl bg-[var(--accent-app)] text-white grid place-items-center">
            <Stethoscope size={22} />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-[var(--text-app)]">
              Gestão Odonto-Radiológica
            </h1>
            <p className="text-xs text-[var(--text-app-muted)]">
              Precificação & Financeiro
            </p>
          </div>
        </div>

        <Card className="border-[var(--border-app)] bg-[var(--surface-app)] shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-[var(--text-app)] text-lg">
              Acessar
            </CardTitle>
            <CardDescription className="text-[var(--text-app-muted)]">
              Entre com seu e-mail e senha.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="login">
              <TabsList className="grid grid-cols-2 mb-4 bg-[var(--bg-app-alt-strong)]">
                <TabsTrigger value="login">Entrar</TabsTrigger>
                <TabsTrigger value="registro">Nova clínica</TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <form onSubmit={entrar} className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="email" className="text-[var(--text-app-secondary)] text-xs">
                      E-mail
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      autoComplete="email"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      required
                      className="bg-[var(--surface-app)] border-[var(--border-app)] text-[var(--text-app)]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="senha" className="text-[var(--text-app-secondary)] text-xs">
                      Senha
                    </Label>
                    <Input
                      id="senha"
                      type="password"
                      autoComplete="current-password"
                      value={loginSenha}
                      onChange={(e) => setLoginSenha(e.target.value)}
                      required
                      className="bg-[var(--surface-app)] border-[var(--border-app)] text-[var(--text-app)]"
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={loginLoading}
                    className="w-full bg-[var(--accent-app)] hover:bg-[var(--accent-app-hover)] text-white"
                  >
                    {loginLoading && <Loader2 className="size-4 animate-spin mr-2" />}
                    Entrar
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="registro">
                <form onSubmit={registrar} className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-[var(--text-app-secondary)] text-xs">
                      Nome da clínica
                    </Label>
                    <Input
                      value={regClinica}
                      onChange={(e) => setRegClinica(e.target.value)}
                      required
                      className="bg-[var(--surface-app)] border-[var(--border-app)] text-[var(--text-app)]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[var(--text-app-secondary)] text-xs">
                      Seu nome
                    </Label>
                    <Input
                      value={regNome}
                      onChange={(e) => setRegNome(e.target.value)}
                      required
                      className="bg-[var(--surface-app)] border-[var(--border-app)] text-[var(--text-app)]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[var(--text-app-secondary)] text-xs">
                      E-mail
                    </Label>
                    <Input
                      type="email"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      required
                      className="bg-[var(--surface-app)] border-[var(--border-app)] text-[var(--text-app)]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[var(--text-app-secondary)] text-xs">
                      Senha (mínimo 8 caracteres)
                    </Label>
                    <Input
                      type="password"
                      value={regSenha}
                      onChange={(e) => setRegSenha(e.target.value)}
                      required
                      minLength={8}
                      className="bg-[var(--surface-app)] border-[var(--border-app)] text-[var(--text-app)]"
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={regLoading}
                    className="w-full bg-[var(--accent-app)] hover:bg-[var(--accent-app-hover)] text-white"
                  >
                    {regLoading && <Loader2 className="size-4 animate-spin mr-2" />}
                    Criar conta (você será o dono)
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <p className="text-[11px] text-[var(--text-app-faint)] text-center mt-4">
          Dados guardados localmente (SQLite). Nada é enviado pra fora.
        </p>
      </div>
    </div>
  );
}
