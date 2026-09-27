# T3-b — Tab Custos & Capacidade (frontend)

## What I did

Replaced the placeholder stub at `src/components/tabs/custos-capacidade-tab.tsx` with a full client component implementing the "Custos & Capacidade" tab — 4 sub-panels via internal `<Tabs>` plus a summary card at the top.

## Files modified

- `src/components/tabs/custos-capacidade-tab.tsx` (only this file, per the brief)

## Key decisions

1. **State management**: All data via TanStack Query with keys `["despesas"]`, `["capacidade"]`, `["ativos"]`, `["insumos"]`, `["resumo"]`. Each mutation invalidates its own key plus `["resumo"]` (since the resumo summary depends on all data sources).

2. **Avoiding `react-hooks/set-state-in-effect` (React 19 / ESLint)**: My first draft used the classic "sync local state to prop via useEffect" pattern (`useEffect(() => setNome(despesa.nome), [despesa.nome])`). That fails lint under React 19's new rule. Refactored to:
   - For row components (`DespesaRow`, `AtivoRow`, `InsumoRow`): **uncontrolled inputs** with `defaultValue={serverValue}` and `onBlur` to commit. Parent passes `key={item.id}` so a row remounts when its id changes.
   - For `CapacidadeForm`: extracted as a child component receiving `initial` props; parent passes `key={capQ.data?.clinicaId ?? "novo"}` so the form remounts (and `useState` re-initializes) when transitioning from null→configured.

3. **Resumo 400 handling**: The brief said "If resumo returns 400 (capacidade missing), show a warning". Since `apiFetch` throws on any non-2xx, I wrote a custom fetcher `fetchResumo` that treats `400 → null` as the expected "capacidade not configured" signal and only throws on other errors. The `ResumoCard` then renders a warning banner when data is `null`.

4. **Percentage display**: UI shows 0-100, stored as 0-1. The `CapacidadeField` for `% de ocupação` displays the 0-100 number; the PUT mutation converts `pct/100` before sending. The preview computations (horasEfetivas, custoFixoPorHora) also use `pct/100` for the occupation factor.

5. **Computed summaries in CapacidadePanel**: Preview `custoFixoPorHora` and `custoFixoPorMinuto` are computed live from current input values + the despesas/ativos queries (cached). When custoFixo = 0 (no despesas/ativos), shows "—" with a hint to "Cadastre despesas fixas ou equipamentos…".

6. **Styling**: All inputs/buttons/tables override the shadcn defaults with the app-specific CSS vars (`--surface-app`, `--border-app`, `--text-app`, `--accent-app`, `--warning-app`, `--danger-app`). Number inputs are `text-right font-mono tabular-nums`. Container is `h-full overflow-y-auto scroll-thin` so it fills the AppShell viewport.

7. **Permissions**: `useAuth((s) => s.podeEditar())` disables all write controls (forms, save buttons, trash buttons) for `recepcao` role; read access always allowed for authenticated users. Empty-state hints are contextual: dono/financeiro sees "Use o formulário…", recepção sees "Aguarde o gestor…".

## What other agents can find useful

- **Pattern for editable table rows with TanStack Query + React 19**: uncontrolled `<Input defaultValue={...} onBlur={commit} />` + parent `key={item.id}`. No `useEffect` needed; lint-clean; preserves user input on re-render. Other tabs (procedimentos, agenda, financeiro) that need editable rows can copy this pattern.
- **Pattern for "first time config" forms**: child component with `key={data?.id ?? "novo"}` to force remount when server data transitions from null to object. Avoids `useEffect`-based syncing.
- **`fetchResumo` pattern**: how to handle a backend that returns 400 to mean "not yet configured" instead of an error — distinguish status code in a custom fetcher rather than via `apiFetch`.
- **Query key convention**: `["resumo"]` is invalidated by every mutation in this tab (despesas, ativos, capacidade, insumos) since it depends on all of them. Other tabs that mutate data affecting the resumo should also invalidate `["resumo"]`.
- **Toast feedback**: every mutation calls `toast.success(...)` in `onSuccess` and `toast.error(e.message)` in `onError`. The error message comes from the backend's `{ erro: "..." }` shape (via `apiFetch`).

## Lint status

PASS — 0 errors, exit 0
