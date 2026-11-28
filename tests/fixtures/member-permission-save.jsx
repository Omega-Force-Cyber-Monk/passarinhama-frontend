// Browser regression fixture only. Mounts the production editor, modal, providers,
// store and API middleware. All API requests terminate here, never at a live API.
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { I18nProvider } from '../../src/i18n';
import { AppToastProvider } from '../../src/components/ui/AppToastProvider';
import Modal from '../../src/components/ui/Modal';
import { AdminPermissionsEditor } from '../../src/pages/admin/AdminPermissionsEditor';
import { store } from '../../src/redux/store';
import { setCredentials, sessionResolved } from '../../src/redux/features/auth/authSlice';
import { membersApi } from '../../src/redux/features/members/membersApi';
import { PERMISSION_FEATURES, PERMISSION_ACTIONS } from '../../src/redux/features/auth/permissionUtils';
import '../../src/index.css';

if (!['127.0.0.1', 'localhost'].includes(location.hostname)) throw new Error('Local test fixture only');
const actor = { id: 'fixture-admin', status: 'active', is_deleted: false, is_superuser: true, role: 'fixture', permissions: [], user_permissions: [] };
const actions = { can_view: true, can_create: false, can_edit: true, can_delete: false };
const members = Object.fromEntries(['fixture-new', 'fixture-existing'].map(id => [id, {
  id, permissions: PERMISSION_FEATURES.map(feature => ({ feature, ...actions })),
  rows: PERMISSION_FEATURES.map(feature => ({ id: id === 'fixture-existing' ? `${id}-${feature}` : null,
    user_id: id, feature, ...Object.fromEntries(PERMISSION_ACTIONS.map(action => [action, id === 'fixture-existing' ? actions[action] : null])) })),
}]));
const writes = [];
let holdReads = false, releaseReads = [], notify = () => {};
const json = value => new Response(JSON.stringify(value), { headers: { 'Content-Type': 'application/json' } });
window.fetch = async input => {
  const request = input instanceof Request ? input : new Request(input);
  const path = new URL(request.url).pathname.replace(/^\/fixture-api/, '');
  if (path === '/user/users/me') return json(actor);
  if (request.method === 'POST' || request.method === 'PATCH') {
    const body = await request.json();
    if (!path.startsWith('/user/user-permissions')) throw new Error(`Unexpected test write: ${path}`);
    const member = request.method === 'POST' ? members[body.user_id] : Object.values(members).find(user => user.rows.some(row => row.id === path.split('/').at(-1)));
    if (!member) throw new Error('Unexpected test member');
    const index = member.rows.findIndex(row => request.method === 'POST' ? row.feature === body.feature : row.id === path.split('/').at(-1));
    if (request.method === 'POST' && member.rows[index].id) return new Response('{"detail":"Duplicate override"}', { status: 409 });
    const row = { ...member.rows[index], ...body, id: `${member.id}-${member.rows[index].feature}` };
    member.rows[index] = row;
    member.permissions = member.permissions.map(permission => permission.feature === row.feature ? { feature: row.feature, ...Object.fromEntries(PERMISSION_ACTIONS.map(action => [action, row[action]])) } : permission);
    writes.push({ method: request.method, path, body }); notify();
    return json(row);
  }
  if (holdReads) await new Promise(resolve => { releaseReads.push(resolve); });
  if (path === '/user/user-permissions') return json(members[new URL(request.url).searchParams.get('user_id')].rows);
  const member = members[path.split('/').at(-1)];
  if (path.startsWith('/user/users/') && member) return json({ ...member, status: 'active', role: 'fixture', user_permissions: member.rows.filter(row => row.id) });
  throw new Error(`Unexpected test read: ${path}`);
};
localStorage.setItem('archicopro-language', 'en');
store.dispatch(setCredentials({ access_token: 'local-fixture-token' }));
store.dispatch(sessionResolved({ user: actor, sessionVersion: store.getState().auth.sessionVersion }));

function Fixture() {
  const [target, setTarget] = useState('fixture-new');
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false);
  const [, render] = useState(0), [inspection, setInspection] = useState('Not inspected');
  notify = () => render(value => value + 1);
  const inspect = () => {
    const fieldset = [...document.querySelectorAll('fieldset')].find(element => element.querySelector('legend')?.textContent === 'Articles');
    setInspection(fieldset ? JSON.stringify({ disabled: fieldset.querySelector('button').matches(':disabled'),
      parentDisabled: fieldset.disabled, checkboxes: [...fieldset.querySelectorAll('input')].map(input => input.checked) }) : 'Editor not open');
  };
  return <main className="p-4 space-y-3">
    <h1 className="text-xl font-bold">Local Member Permission Save Regression</h1>
    <p>Test API only. Production permissions are never changed.</p>
    <div className="flex flex-wrap gap-3">
      <button onClick={() => { setTarget('fixture-new'); setOpen(true); }}>Open member without overrides</button>
      <button onClick={() => { setTarget('fixture-existing'); setOpen(true); }}>Open member with overrides</button>
    </div>
    <pre aria-label="Captured writes">{JSON.stringify(writes, null, 2)}</pre>
    <Modal isOpen={open} title={`Member Permissions (${target})`} onClose={() => setOpen(false)} closeDisabled={busy} layout="sectioned">
      <div className="flex flex-wrap gap-4 mb-4">
        <button onClick={() => {
          holdReads = true;
          store.dispatch(membersApi.util.invalidateTags([{ type: 'User', id: `USER-PERMISSIONS-${target}` }, { type: 'User', id: target }]));
        }}>Hold background reads</button>
        <button onClick={() => { holdReads = false; releaseReads.splice(0).forEach(resolve => resolve()); }}>Release background reads</button>
        <button onClick={inspect}>Inspect Article Save</button>
      </div>
      <output aria-label="Rendered button state">{inspection}</output>
      <AdminPermissionsEditor key={target} kind="member" targetId={target} canManage onBusyChange={setBusy} />
    </Modal>
  </main>;
}
createRoot(document.getElementById('root')).render(<Provider store={store}><I18nProvider><AppToastProvider><Fixture /></AppToastProvider></I18nProvider></Provider>);
