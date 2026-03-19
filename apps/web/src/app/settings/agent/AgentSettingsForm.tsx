'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';

type AgentConfig = {
  id: string;
  organizationId: string;
  scope: 'global' | 'property';
  propertyId: string | null;
  tone: string | null;
  emojiUse: string | null;
  responseLength: string | null;
  escalationRules: string | null;
  specialInstructions: string | null;
  createdAt: string;
  updatedAt: string;
};

type AgentConfigFormState = {
  tone: string;
  emojiUse: string;
  responseLength: string;
  escalationRules: string;
  specialInstructions: string;
};

type AgentConfigEditorProps = {
  mode: 'global' | 'property';
  loadUrl: string;
  saveUrl: string;
  successMessage: string;
  inheritedLoadUrl?: string;
};

const toneOptions = [
  'warm and friendly',
  'neutral and professional',
  'formal and concise',
] as const;

const emojiOptions = ['none', 'light (1-2 emoji max)', 'friendly'] as const;

const responseLengthOptions = [
  'short (1-2 sentences)',
  'balanced (2-3 sentences)',
  'detailed (4-5 sentences)',
] as const;

const inputClass =
  'w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-400';

const helperClass = 'mt-1 text-xs text-gray-500';

function buildFormState(config: AgentConfig | null, mode: 'global' | 'property'): AgentConfigFormState {
  if (mode === 'property') {
    return {
      tone: config?.tone ?? '',
      emojiUse: config?.emojiUse ?? '',
      responseLength: config?.responseLength ?? '',
      escalationRules: config?.escalationRules ?? '',
      specialInstructions: config?.specialInstructions ?? '',
    };
  }

  return {
    tone: config?.tone ?? 'warm and friendly',
    emojiUse: config?.emojiUse ?? 'light (1-2 emoji max)',
    responseLength: config?.responseLength ?? 'balanced (2-3 sentences)',
    escalationRules: config?.escalationRules ?? '',
    specialInstructions: config?.specialInstructions ?? '',
  };
}

function withCurrentOption(options: readonly string[], currentValue: string) {
  if (!currentValue || options.includes(currentValue)) {
    return options;
  }

  return [currentValue, ...options];
}

function toNullablePayloadValue(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function AgentConfigEditor({ mode, loadUrl, saveUrl, successMessage, inheritedLoadUrl }: AgentConfigEditorProps) {
  const [form, setForm] = useState<AgentConfigFormState>(() => buildFormState(null, mode));
  const [savedForm, setSavedForm] = useState<AgentConfigFormState>(() => buildFormState(null, mode));
  const [inheritedForm, setInheritedForm] = useState<AgentConfigFormState | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let isMounted = true;

    async function loadConfig() {
      setLoading(true);
      setLoadError(null);

      try {
        const requests = [fetch(loadUrl, { cache: 'no-store' })];
        if (inheritedLoadUrl) {
          requests.push(fetch(inheritedLoadUrl, { cache: 'no-store' }));
        }

        const responses = await Promise.all(requests);
        const configResponse = responses[0];
        const inheritedResponse = responses[1];

        if (!configResponse) {
          throw new Error('Unable to load agent settings.');
        }

        const configPayload = (await configResponse.json()) as {
          config?: AgentConfig | null;
          error?: string;
        };
        if (!configResponse.ok) {
          throw new Error(configPayload.error ?? 'Unable to load agent settings.');
        }

        if (!isMounted) {
          return;
        }

        const nextForm = buildFormState(configPayload.config ?? null, mode);
        setForm(nextForm);
        setSavedForm(nextForm);

        if (inheritedLoadUrl && inheritedResponse) {
          const inheritedPayload = (await inheritedResponse.json()) as {
            config?: AgentConfig | null;
            error?: string;
          };

          if (!inheritedResponse.ok) {
            throw new Error(inheritedPayload.error ?? 'Unable to load inherited defaults.');
          }

          if (!isMounted) {
            return;
          }

          setInheritedForm(buildFormState(inheritedPayload.config ?? null, 'global'));
        }
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setLoadError(error instanceof Error ? error.message : 'Unable to load agent settings.');
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    void loadConfig();

    return () => {
      isMounted = false;
    };
  }, [inheritedLoadUrl, loadUrl, mode]);

  const toneChoices = useMemo(() => withCurrentOption(toneOptions, form.tone), [form.tone]);
  const emojiChoices = useMemo(
    () => withCurrentOption(emojiOptions, form.emojiUse),
    [form.emojiUse],
  );
  const responseLengthChoices = useMemo(
    () => withCurrentOption(responseLengthOptions, form.responseLength),
    [form.responseLength],
  );

  const isDirty =
    form.tone !== savedForm.tone ||
    form.emojiUse !== savedForm.emojiUse ||
    form.responseLength !== savedForm.responseLength ||
    form.escalationRules !== savedForm.escalationRules ||
    form.specialInstructions !== savedForm.specialInstructions;

  function updateField<Key extends keyof AgentConfigFormState>(key: Key, value: AgentConfigFormState[Key]) {
    setForm((current) => ({ ...current, [key]: value }));
    setSaveError(null);
    setSuccess(null);
  }

  function resetForm() {
    setForm(savedForm);
    setSaveError(null);
    setSuccess(null);
  }

  function clearOverrides() {
    setForm(buildFormState(null, 'property'));
    setSaveError(null);
    setSuccess(null);
  }

  function saveForm() {
    setSaveError(null);
    setSuccess(null);

    startTransition(async () => {
      try {
        const response = await fetch(saveUrl, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tone: toNullablePayloadValue(form.tone),
            emojiUse: toNullablePayloadValue(form.emojiUse),
            responseLength: toNullablePayloadValue(form.responseLength),
            escalationRules: toNullablePayloadValue(form.escalationRules),
            specialInstructions: toNullablePayloadValue(form.specialInstructions),
          }),
        });

        const payload = (await response.json()) as { config?: AgentConfig | null; error?: string };
        if (!response.ok) {
          throw new Error(payload.error ?? 'Unable to save agent settings.');
        }

        const nextForm = buildFormState(payload.config ?? null, mode);
        setForm(nextForm);
        setSavedForm(nextForm);
        setSuccess(successMessage);
      } catch (error) {
        setSaveError(error instanceof Error ? error.message : 'Unable to save agent settings.');
      }
    });
  }

  if (loading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-500">
        Loading agent settings…
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6">
        <p className="text-sm text-red-700">{loadError}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {mode === 'property' && inheritedForm && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-6">
          <div className="mb-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-blue-800">
              Inherited Global Defaults
            </h2>
            <p className="mt-1 text-xs text-blue-700">
              Leave a property field empty to inherit the global value shown here.
            </p>
          </div>

          <dl className="grid gap-4 md:grid-cols-3">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-blue-700">Tone</dt>
              <dd className="mt-1 text-sm text-blue-950">{inheritedForm.tone}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-blue-700">
                Emoji use
              </dt>
              <dd className="mt-1 text-sm text-blue-950">{inheritedForm.emojiUse}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-blue-700">
                Response length
              </dt>
              <dd className="mt-1 text-sm text-blue-950">{inheritedForm.responseLength}</dd>
            </div>
            <div className="md:col-span-3">
              <dt className="text-xs font-medium uppercase tracking-wide text-blue-700">
                Escalation rules
              </dt>
              <dd className="mt-1 whitespace-pre-wrap text-sm text-blue-950">
                {inheritedForm.escalationRules || 'No global escalation rules set.'}
              </dd>
            </div>
            <div className="md:col-span-3">
              <dt className="text-xs font-medium uppercase tracking-wide text-blue-700">
                Special instructions
              </dt>
              <dd className="mt-1 whitespace-pre-wrap text-sm text-blue-950">
                {inheritedForm.specialInstructions || 'No global special instructions set.'}
              </dd>
            </div>
          </dl>
        </div>
      )}

      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="mb-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-700">
            Reply Defaults
          </h2>
          <p className={helperClass}>
            {mode === 'global'
              ? 'These defaults shape how the inbox agent writes replies unless a property-specific override replaces them.'
              : 'Set property-specific reply behavior. Any blank field will inherit the global default.'}
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Tone</span>
            <select
              className={`${inputClass} mt-1`}
              value={form.tone}
              onChange={(event) => updateField('tone', event.target.value)}
            >
              {mode === 'property' && <option value="">Inherit global default</option>}
              {toneChoices.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-sm font-medium text-gray-700">Emoji use</span>
            <select
              className={`${inputClass} mt-1`}
              value={form.emojiUse}
              onChange={(event) => updateField('emojiUse', event.target.value)}
            >
              {mode === 'property' && <option value="">Inherit global default</option>}
              {emojiChoices.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-sm font-medium text-gray-700">Response length</span>
            <select
              className={`${inputClass} mt-1`}
              value={form.responseLength}
              onChange={(event) => updateField('responseLength', event.target.value)}
            >
              {mode === 'property' && <option value="">Inherit global default</option>}
              {responseLengthChoices.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="mb-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-700">
            Escalation Rules
          </h2>
          <p className={helperClass}>
            {mode === 'global'
              ? 'Describe when the AI should stop, ask for manual review, or hand off to a human.'
              : 'Add property-specific escalation rules only when they differ from the global policy.'}
          </p>
        </div>

        <label className="block">
          <span className="sr-only">Escalation rules</span>
          <textarea
            className={`${inputClass} min-h-32`}
            value={form.escalationRules}
            onChange={(event) => updateField('escalationRules', event.target.value)}
            placeholder={
              mode === 'global'
                ? 'Escalate refund threats, safety issues, legal disputes, or any booking change that needs approval.'
                : 'Leave empty to inherit the global escalation rules.'
            }
          />
        </label>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="mb-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-700">
            Special Instructions
          </h2>
          <p className={helperClass}>
            {mode === 'global'
              ? 'Add any portfolio-wide reply guidance that should apply across all properties.'
              : 'Add property-specific instructions only for this listing. Leave blank to inherit the global guidance.'}
          </p>
        </div>

        <label className="block">
          <span className="sr-only">Special instructions</span>
          <textarea
            className={`${inputClass} min-h-40`}
            value={form.specialInstructions}
            onChange={(event) => updateField('specialInstructions', event.target.value)}
            placeholder={
              mode === 'global'
                ? "Mention upsell opportunities only after the guest's question is fully answered."
                : 'Leave empty to inherit the global special instructions.'
            }
          />
        </label>
      </div>

      {(saveError || success) && (
        <div
          className={`rounded-md px-4 py-3 text-sm ${
            saveError
              ? 'border border-red-200 bg-red-50 text-red-700'
              : 'border border-green-200 bg-green-50 text-green-700'
          }`}
        >
          {saveError ?? success}
        </div>
      )}

      <div className="flex flex-wrap justify-end gap-3">
        {mode === 'property' && (
          <button
            type="button"
            onClick={clearOverrides}
            disabled={isPending}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
          >
            Use inherited defaults
          </button>
        )}
        <button
          type="button"
          onClick={resetForm}
          disabled={!isDirty || isPending}
          className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
        >
          Reset
        </button>
        <button
          type="button"
          onClick={saveForm}
          disabled={!isDirty || isPending}
          className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700 disabled:opacity-50"
        >
          {isPending ? 'Saving…' : 'Save settings'}
        </button>
      </div>
    </div>
  );
}

export function AgentSettingsForm() {
  return (
    <AgentConfigEditor
      mode="global"
      loadUrl="/api/agent-config"
      saveUrl="/api/agent-config"
      successMessage="Global agent settings saved."
    />
  );
}

export function PropertyAgentSettingsForm({ propertyId }: { propertyId: string }) {
  return (
    <AgentConfigEditor
      mode="property"
      loadUrl={`/api/properties/${propertyId}/agent-config`}
      saveUrl={`/api/properties/${propertyId}/agent-config`}
      inheritedLoadUrl="/api/agent-config"
      successMessage="Property agent settings saved."
    />
  );
}
