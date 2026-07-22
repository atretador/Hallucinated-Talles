import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../../stores';
import type { McpServerInfo } from '../../../../shared/types';
import { notifySettingsChanged } from './utils';
import { ConfirmDialog } from '../shared/ConfirmDialog';

export function McpServersTab() {
  const { t } = useTranslation('app');
  const prefersReduced = useReducedMotion();
  const {
    mcpServers, activeMcpServerIds, mcpServersLoading,
    fetchMcpServers, fetchActiveMcpServerIds, createMcpServer, updateMcpServer, deleteMcpServer, toggleMcpServer,
  } = useAppStore();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formCommand, setFormCommand] = useState('');
  const [formArgs, setFormArgs] = useState('');
  const [formEnv, setFormEnv] = useState('');
  const [formEnabled, setFormEnabled] = useState(true);
  const [formTimeout, setFormTimeout] = useState('30000');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  useEffect(() => {
    fetchMcpServers();
    fetchActiveMcpServerIds();
  }, [fetchMcpServers, fetchActiveMcpServerIds]);

  const generateId = (name: string) =>
    name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `mcp-${Date.now()}`;

  const startAdd = () => {
    setEditingId('__new__');
    setFormName('');
    setFormCommand('npx');
    setFormArgs('-y, @modelcontextprotocol/server-filesystem, /path/to/dir');
    setFormEnv('');
    setFormEnabled(true);
    setFormTimeout('30000');
    setMessage('');
  };

  const startEdit = (server: McpServerInfo) => {
    setEditingId(server.config.id);
    setFormName(server.config.name);
    setFormCommand(server.config.command);
    setFormArgs(server.config.args?.join(', ') ?? '');
    setFormEnv(
      server.config.env
        ? Object.entries(server.config.env).map(([k, v]) => `${k}=${v}`).join('\n')
        : ''
    );
    setFormEnabled(server.config.enabled);
    setFormTimeout(String(server.config.timeoutMs ?? 30000));
    setMessage('');
  };

  const cancelForm = () => {
    setEditingId(null);
    setMessage('');
  };

  const parseArgs = (raw: string): string[] =>
    raw.split(',').map(s => s.trim()).filter(Boolean);

  const parseEnv = (raw: string): Record<string, string> | undefined => {
    const lines = raw.split('\n').map(s => s.trim()).filter(Boolean);
    if (lines.length === 0) return undefined;
    const env: Record<string, string> = {};
    for (const line of lines) {
      const idx = line.indexOf('=');
      if (idx > 0) {
        env[line.slice(0, idx)] = line.slice(idx + 1);
      }
    }
    return Object.keys(env).length > 0 ? env : undefined;
  };

  const handleSave = async () => {
    if (!formName.trim()) { setMessage(t('settings.mcpServers.nameRequired')); return; }
    if (!formCommand.trim()) { setMessage(t('settings.mcpServers.commandRequired')); return; }
    setSaving(true); setMessage('');
    try {
      const args = parseArgs(formArgs);
      const env = parseEnv(formEnv);
      const timeoutMs = formTimeout ? Number(formTimeout) : undefined;

      if (editingId === '__new__') {
        const id = generateId(formName.trim());
        await createMcpServer({ id, name: formName.trim(), command: formCommand.trim(), args, env, enabled: formEnabled, timeoutMs });
        setMessage(t('settings.mcpServers.serverCreated'));
      } else if (editingId) {
        await updateMcpServer(editingId, { name: formName.trim(), command: formCommand.trim(), args, env, enabled: formEnabled, timeoutMs });
        setMessage(t('settings.mcpServers.serverUpdated'));
      }
      cancelForm();
      notifySettingsChanged();
    } catch (err) {
      setMessage(t('settings.mcpServers.error', { error: err instanceof Error ? err.message : String(err) }));
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    setDeleteTargetId(id);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTargetId) return;
    try { await deleteMcpServer(deleteTargetId); notifySettingsChanged(); }
    catch (err) { setMessage(t('common.status.error') + ': ' + (err instanceof Error ? err.message : String(err))); }
    finally { setDeleteTargetId(null); }
  };

  const statusColor: Record<string, string> = {
    connected: 'bg-green-400',
    connecting: 'bg-yellow-400',
    error: 'bg-red-400',
    disconnected: 'bg-gray-500',
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-300">{t('settings.mcpServers.title')}</h3>
        <motion.button
          onClick={startAdd}
          disabled={editingId !== null}
          className="focus-ring rounded bg-green-700 px-2 py-1 text-xs text-white hover:bg-green-600 disabled:opacity-50"
          whileTap={prefersReduced ? undefined : { scale: 0.97 }}
        >
          {t('settings.mcpServers.addServer')}
        </motion.button>
      </div>

      <p className="mb-3 text-xs text-gray-500">
        {t('settings.mcpServers.description')}
      </p>

      {mcpServersLoading && <p className="text-xs text-gray-500">{t('settings.mcpServers.loading')}</p>}

      {!mcpServersLoading && mcpServers.length === 0 && !editingId && (
        <p className="text-xs text-gray-500">{t('settings.mcpServers.noServers')}</p>
      )}

      {/* Edit/Create form */}
      {editingId && (
        <div className="mb-3 rounded border border-blue-600 bg-gray-700 p-3">
          <h4 className="mb-2 text-xs font-semibold text-gray-200">
            {editingId === '__new__' ? t('settings.mcpServers.newMcpServer') : t('settings.mcpServers.editMcpServer')}
          </h4>
          <div className="space-y-2">
            <div>
              <label className="block text-xs text-gray-400">{t('labels.name', { ns: 'common' })}</label>
              <input type="text" value={formName} onChange={(e) => setFormName(e.target.value)}
                placeholder={t('settings.mcpServers.namePlaceholder')}
                className="focus-ring w-full rounded border border-gray-600 bg-gray-800 px-2 py-1 text-sm text-gray-100" />
            </div>
            <div>
              <label className="block text-xs text-gray-400">{t('settings.mcpServers.command')}</label>
              <input type="text" value={formCommand} onChange={(e) => setFormCommand(e.target.value)}
                placeholder={t('settings.mcpServers.commandPlaceholder')}
                className="focus-ring w-full rounded border border-gray-600 bg-gray-800 px-2 py-1 text-sm text-gray-100" />
            </div>
            <div>
              <label className="block text-xs text-gray-400">{t('settings.mcpServers.arguments')} <span className="text-gray-500">{t('settings.mcpServers.argumentsHint')}</span></label>
              <input type="text" value={formArgs} onChange={(e) => setFormArgs(e.target.value)}
                placeholder={t('settings.mcpServers.argumentsPlaceholder')}
                className="focus-ring w-full rounded border border-gray-600 bg-gray-800 px-2 py-1 text-sm text-gray-100" />
            </div>
            <div>
              <label className="block text-xs text-gray-400">{t('settings.mcpServers.envVars')} <span className="text-gray-500">{t('settings.mcpServers.envVarsHint')}</span></label>
              <textarea value={formEnv} onChange={(e) => setFormEnv(e.target.value)}
                placeholder={t('settings.mcpServers.envVarsPlaceholder')}
                rows={2}
                className="focus-ring w-full resize-y rounded border border-gray-600 bg-gray-800 px-2 py-1 text-sm text-gray-100" />
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-1.5 text-xs text-gray-400">
                <input type="checkbox" checked={formEnabled} onChange={(e) => setFormEnabled(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-gray-500 bg-gray-700 text-green-500 focus:ring-green-500 focus:ring-offset-0" />
                {t('settings.mcpServers.enabled')}
              </label>
              <div className="flex items-center gap-1.5">
                <label className="text-xs text-gray-400">{t('settings.mcpServers.timeoutMs')}</label>
                <input type="number" min={1000} step={1000} value={formTimeout} onChange={(e) => setFormTimeout(e.target.value)}
                  className="focus-ring w-20 rounded border border-gray-600 bg-gray-800 px-2 py-1 text-sm text-gray-100" />
              </div>
            </div>
          </div>
          <div className="mt-2 flex gap-2">
            <motion.button onClick={handleSave} disabled={saving}
              className="focus-ring rounded bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-500 disabled:opacity-50"
              whileTap={prefersReduced ? undefined : { scale: 0.97 }}>
              {saving ? t('buttons.saving', { ns: 'common' }) : t('buttons.save', { ns: 'common' })}
            </motion.button>
            <motion.button onClick={cancelForm}
              className="focus-ring rounded bg-gray-600 px-3 py-1 text-xs text-gray-200 hover:bg-gray-500"
              whileTap={prefersReduced ? undefined : { scale: 0.97 }}>
              {t('buttons.cancel', { ns: 'common' })}
            </motion.button>
          </div>
          {message && <div className="mt-2 text-xs text-gray-300">{message}</div>}
        </div>
      )}

      {/* Server cards */}
      <div className="space-y-2">
        {mcpServers.map((server) => {
          const isActive = activeMcpServerIds.includes(server.config.id);
          return (
            <div key={server.config.id}
              className={`rounded border px-3 py-2 ${isActive ? 'border-green-600 bg-gray-700' : 'border-gray-600 bg-gray-800'}`}>
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full shrink-0" title={server.status}>
                      {(() => {
                        const color = statusColor[server.status] ?? 'bg-gray-500';
                        const animate = server.status === 'connecting';
                        return <span className={`inline-block h-2 w-2 rounded-full ${color}${animate ? ' animate-pulse' : ''}`} />;
                      })()}
                    </span>
                    <span className="text-sm font-medium text-gray-100">{server.config.name}</span>
                    {isActive && (
                      <span className="rounded bg-green-800 px-1.5 py-0.5 text-[10px] text-green-300">{t('status.active', { ns: 'common' })}</span>
                    )}
                    {server.status === 'error' && server.error && (
                      <span className="rounded bg-red-800/50 px-1.5 py-0.5 text-[10px] text-red-300" title={server.error}>{t('status.error', { ns: 'common' })}</span>
                    )}
                  </div>
                  <div className="mt-0.5 text-xs text-gray-400 font-mono truncate">
                    {server.config.command} {server.config.args?.join(' ') ?? ''}
                  </div>
                  <div className="mt-0.5 text-[10px] text-gray-500">
                    {t('settings.mcpServers.toolCount', { count: server.toolCount })}
                    {!server.config.enabled && <span className="ml-1 text-gray-600">{t('settings.mcpServers.disabled')}</span>}
                  </div>
                </div>
                <div className="ml-2 flex gap-1 shrink-0">
                  <button onClick={() => toggleMcpServer(server.config.id)}
                    className={`focus-ring rounded px-2 py-0.5 text-xs ${isActive ? 'bg-green-700 text-green-200 hover:bg-green-600' : 'bg-gray-600 text-gray-300 hover:bg-gray-500'}`}>
                    {isActive ? t('buttons.on', { ns: 'common' }) : t('buttons.off', { ns: 'common' })}
                  </button>
                  <button onClick={() => startEdit(server)} disabled={editingId !== null}
                    className="focus-ring rounded bg-gray-600 px-2 py-0.5 text-xs text-gray-200 hover:bg-gray-500 disabled:opacity-30">
                    {t('buttons.edit', { ns: 'common' })}
                  </button>
                  <button onClick={() => handleDelete(server.config.id)} disabled={editingId !== null}
                    className="focus-ring rounded bg-red-800 px-2 py-0.5 text-xs text-red-200 hover:bg-red-700 disabled:opacity-30">
                    {t('buttons.del', { ns: 'common' })}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {message && !editingId && <div className="mt-2 text-xs text-gray-300">{message}</div>}

      <ConfirmDialog
        open={deleteTargetId !== null}
        message={t('settings.mcpServers.deleteConfirm')}
        confirmLabel={t('buttons.delete', { ns: 'common' })}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTargetId(null)}
      />
    </div>
  );
}
