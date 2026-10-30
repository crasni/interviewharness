import { useCallback, useEffect, useId, useState } from 'react';
import type { ProviderStatus } from '../../../shared/api.ts';
import { feedbackModel, modelKey } from '../../../shared/settings.ts';
import { useChatGPTLogin } from '../models/useChatGPTLogin.ts';
import { useSettings } from './settings.tsx';

/** Settings → Model: which model the interviewer and the Feedback use, and the login behind them. */
export function ModelPage() {
  const { settings, change } = useSettings();
  const [providers, setProviders] = useState<ProviderStatus[]>([]);
  const refresh = useCallback(() => void window.harness.models.providers().then(setProviders), []);
  const login = useChatGPTLogin();
  const interviewerId = useId();
  const feedbackId = useId();

  useEffect(refresh, [refresh]);

  // Only ChatGPT so far; Ollama and API keys join this list later.
  const chatgpt = providers.find((p) => p.provider === 'chatgpt');
  if (!chatgpt) return null;

  const grader = feedbackModel(settings);
  const graderKey = grader && modelKey(grader);
  const markedSmall = graderKey !== null && settings.smallModels.includes(graderKey);

  return (
    <>
      <div className="settings-row">
        <span>{chatgpt.loggedIn ? 'Signed in with ChatGPT' : 'ChatGPT'}</span>
        {chatgpt.loggedIn ? (
          <button
            type="button"
            onClick={async () => {
              await window.harness.models.logout('chatgpt');
              refresh();
            }}
          >
            Log out
          </button>
        ) : login.step.name === 'waiting' ? (
          <button type="button" onClick={login.cancel}>
            Cancel sign-in
          </button>
        ) : (
          <button type="button" className="primary" onClick={async () => (await login.start()) && refresh()}>
            Continue with ChatGPT
          </button>
        )}
      </div>
      {login.step.name === 'failed' && (
        <p className="settings-hint" role="alert">
          {login.step.error}
        </p>
      )}

      <div className="settings-row">
        <label htmlFor={interviewerId}>Interviewer model</label>
        <select
          id={interviewerId}
          value={settings.interviewerModel?.model ?? ''}
          disabled={!chatgpt.loggedIn}
          onChange={(event) => change({ interviewerModel: { provider: 'chatgpt', model: event.target.value } })}
        >
          {!settings.interviewerModel && <option value="">None</option>}
          {chatgpt.models.map((model) => (
            <option key={model.id} value={model.id}>
              {model.name}
            </option>
          ))}
        </select>
      </div>

      <div className="settings-row">
        <label htmlFor={feedbackId}>Feedback model</label>
        <select
          id={feedbackId}
          value={settings.feedbackModel?.model ?? ''}
          disabled={!chatgpt.loggedIn}
          onChange={(event) =>
            change({ feedbackModel: event.target.value ? { provider: 'chatgpt', model: event.target.value } : null })
          }
        >
          <option value="">Same as interviewer</option>
          {chatgpt.models.map((model) => (
            <option key={model.id} value={model.id}>
              {model.name}
            </option>
          ))}
        </select>
      </div>

      <label className="settings-row">
        <span>Treat the Feedback model as small</span>
        <input
          type="checkbox"
          role="switch"
          checked={markedSmall}
          disabled={!graderKey}
          onChange={(event) =>
            graderKey &&
            change({
              smallModels: event.target.checked
                ? [...settings.smallModels, graderKey]
                : settings.smallModels.filter((key) => key !== graderKey),
            })
          }
        />
      </label>
      <p className="settings-hint">
        Feedback from a small model is marked rough. A model counts as small when it runs on this computer with fewer than
        14 billion parameters, or when you mark it here.
      </p>
    </>
  );
}
