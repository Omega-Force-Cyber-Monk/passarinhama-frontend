import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
import { format, parse, isBefore, parseISO } from 'date-fns';

const files = ['src/pages/Agenda/Agenda.tsx', 'src/pages/DocumentLibrary.tsx'];
const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const printer = ts.createPrinter({ removeComments: true });
const print = (n, sf) => printer.printNode(ts.EmitHint.Unspecified, n, sf).replace(/\s+/g, ' ').trim();
function find(root, predicate) {
  const result = [];
  function visit(n) { if (predicate(n)) result.push(n); ts.forEachChild(n, visit); }
  visit(root); return result;
}
const opening = (n) => ts.isJsxElement(n) ? n.openingElement : n;
const elements = (root, tag) => find(root, (n) => (ts.isJsxElement(n) || ts.isJsxSelfClosingElement(n)) && opening(n).tagName.getText() === tag);
const attrs = (n, sf, skip = []) => Object.fromEntries(opening(n).attributes.properties.filter((p) => ts.isJsxAttribute(p) && !skip.includes(p.name.text)).map((p) => [p.name.text, p.initializer ? print(p.initializer, sf) : true]));
function inspect(file) {
  const source = read(file), sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  return { source, sf, modals: elements(sf, 'Modal') };
}

{
  function evaluate(expression, context) {
    runInNewContext(ts.transpileModule(`result = (${expression});`, { compilerOptions: { target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React } }).outputText, context);
    return context.result;
  }
  function model(file) {
    const { sf, modals } = inspect(file);
    const context = {
      sanitizeRichContent: html => html,
      React: { createElement: (type, props, ...children) => ({ type, props: { ...props, children } }), Fragment: 'Fragment' },
      motion: { div: 'motion.div' }, format, parse, parseISO, isBefore, dateLocale: undefined,
      translate: (key) => key, calls: [], notifications: [],
      canModify: () => true, canChangeTarget: () => true, canUploadHere: true, canCreateFolderHere: true, isSuperuser: true, apiEvents: [], canViewEvent: true,
      navigate: (...args) => context.calls.push(['navigate', ...args]),
      notifySuccess: (...args) => context.notifications.push(['success', ...args]),
      notifyError: (...args) => context.notifications.push(['error', ...args]),
      notify: (...args) => context.notifications.push(args),
      toast: { error: (...args) => context.notifications.push(['error', ...args]) }, getApiErrorDisplayMessage: () => 'error',
      isModalOpen: true, isEditMode: false, editingEventId: null, isCreatingEvent: false, isUpdatingEvent: false,
      canCreateEvent: true, canEditEvent: true, canDeleteEventPermission: true, eventCategories: [{ id: 'cat', name: 'Category' }],
      getPreviewName: (url) => url.split('/').pop(), getEventCategoryStyle: () => ({}), getEventCategoryLabel: () => 'Category',
      agendaId: 'event', selectedEventId: 'event', selectedEventDescription: '<p>Event body</p>', activeTab: 'info',
      canSeeParticipants: false, isLoadingRegistrations: false, isFetchingRegistrations: false, registrationsData: { registrations: [] }, isRegistering: false, isUnregistering: false,
      selectedEvent: { id: 'event', title: 'Event', description: '<p>Body</p>', event_date: '2026-10-18', end_date: '2026-10-19', event_time: '14:00', location: 'Place', attendee_count: 1, max_attendees: 2, spots_left: 1, is_registered: false, is_public: false, attachments: [] },
      dayViewModal: { isOpen: true, date: new Date(2026, 9, 18), events: [] },
      isFolderModalOpen: true, isRenameModalOpen: true, isUploadModalOpen: true, newFolderName: ' Folder ', renamingName: ' Renamed ', renameInfo: { type: 'folder', id: 'target' },
      canCreateDocument: true, canEditDocument: true, canDeleteDocument: true, currentFolder: { id: 'folder' },
      selectedFile: null, isDragActive: false, isUploading: false, fileInputRef: { current: { click: () => context.calls.push(['choose']) } },
      fileId: 'file', selectedPreviewFile: { id: 'file', original_name: 'Original.pdf', file_size_display: '1 KB', mime_type: 'application/pdf' },
      isLoadingPreview: false, previewUrl: 'blob:authenticated', openPreviewUrl: 'blob:authenticated', previewType: 'pdf', downloadingIds: [],
      window: { open: (...args) => context.calls.push(['open', ...args]) },
    };
    for (const n of find(sf, (n) => ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n))) {
      const name = n.tagName.getText(sf);
      if (/^[A-Z]\w*$/.test(name)) context[name] = name;
    }
    for (const state of ['formData', 'isModalOpen', 'isEditMode', 'editingEventId', 'selectedEventId', 'deletingId', 'isConfirmOpen', 'dayViewModal', 'activeTab', 'selectedFile', 'isUploadModalOpen', 'isDragActive', 'isFolderModalOpen', 'newFolderName', 'isRenameModalOpen', 'renameInfo', 'renamingName', 'downloadingIds']) {
      context[`set${state[0].toUpperCase()}${state.slice(1)}`] = (value) => { context[state] = typeof value === 'function' ? value(context[state]) : value; };
    }
    function handler(name) {
      const node = find(sf, (n) => ts.isVariableDeclaration(n) && n.name.getText(sf) === name)[0];
      assert.ok(node, `Missing ${name}`); return evaluate(node.initializer.getText(sf), context);
    }
    const agenda = file.includes('Agenda');
    const names = agenda ? ['isEndDateBeforeStartDate', 'getDefaultEventFormData', 'getAttachmentName', 'getAttachmentPreviewType', 'handleCreateAttachmentsChange', 'handleNewAttachmentsChange', 'removeCreateAttachment', 'removeNewAttachment', 'removeExistingAttachment', 'handleAddEvent', 'openEditModal', 'confirmDeleteEvent', 'handleToggleRegistration', 'handleEventClick', 'handleCloseDetails', 'handleImageUpload'] : ['closeUploadModal', 'handleFileSelection', 'handleDragOver', 'handleDragLeave', 'handleDrop', 'handleUploadFile', 'handleAddFolder', 'handleRename', 'handleDownload', 'handleClosePreview'];
    for (const name of names) context[name] = handler(name);
    if (agenda) context.formData = { ...context.getDefaultEventFormData(), title: 'Event', event_category_id: 'cat', event_date: '2026-10-18', end_date: '2026-10-19', status: 'published' };
    return { context, sf, modals, handler, render: (index) => evaluate(modals[index].getText(sf), context) };
  }
  function all(tree, type) {
    const result = [];
    function visit(n) { if (Array.isArray(n)) return n.forEach(visit); if (!n?.props) return; if (n.type === type) result.push(n); visit(n.props.children); visit(n.props.footer); visit(n.props.preview); }
    visit(tree); return result;
  }
  const plain = (value) => JSON.parse(JSON.stringify(value));

  test('shared compact forms, form-associated footers, drawers and native category/confirmation policies are reused', () => {
    for (const file of files) {
      const m = model(file), agenda = file.includes('Agenda');
      for (const [index, layout] of (agenda ? ['compact', 'drawer', 'drawer'] : ['compact', 'compact', 'compact', 'drawer']).entries()) {
        const tree = m.render(index); assert.equal(tree.props.layout, layout);
        if (layout === 'compact') {
          const form = all(tree, 'form')[0], submit = all(tree, 'ModalSubmitButton')[0];
          assert.ok(form.props.id); assert.equal(submit.props.formId, form.props.id); assert.equal(form.props.noValidate, true);
        }
      }
      const confirm = elements(m.sf, 'ConfirmModal')[0]; assert.equal(attrs(confirm, m.sf).presentation, '"compact"');
      if (agenda) assert.equal(attrs(elements(m.sf, 'CategoryManagerDialog')[0], m.sf).supportsColor, true);
    }
  });

  test('Agenda date/time fields keep end-date adjustment, minimum date, number and checkbox behavior without a status field', () => {
    const m = model(files[0]); let tree = m.render(0);
    const [start, end, time] = all(tree, 'BeautifulDateTimePicker');
    assert.equal(start.props.type, 'date'); assert.equal(time.props.type, 'time'); assert.equal(end.props.minDate, '2026-10-18');
    start.props.onChange('2026-10-21'); assert.equal(m.context.formData.end_date, '2026-10-21');
    tree = m.render(0); assert.equal(all(tree, 'BeautifulDateTimePicker')[1].props.minDate, '2026-10-21');
    all(tree, 'BeautifulDateTimePicker')[2].props.onChange('09:45'); assert.equal(m.context.formData.event_time, '09:45');
    all(m.render(0), 'input').find((n) => n.props.type === 'number').props.onChange({ target: { value: '' } }); assert.equal(m.context.formData.max_attendees, 0);
    all(m.render(0), 'input').find((n) => n.props.type === 'checkbox').props.onChange({ target: { checked: true } }); assert.equal(m.context.formData.is_public, true);
    assert.equal(all(tree, 'select').length, 1); assert.equal(m.context.formData.status, 'published');
  });

  test('Agenda appends original files, displays all persisted attachments once, and preserves distinct removal tracking', () => {
    const m = model(files[0]), a = new File(['a'], 'a.png', { type: 'image/png' }), b = new File(['b'], 'b.pdf');
    let upload = all(m.render(0), 'FileUploadDropzone')[0]; upload.props.onFilesSelected([a]); upload.props.onFilesSelected([b]);
    assert.equal(m.context.formData.attachments[0], a); assert.equal(m.context.formData.attachments[1], b);
    m.context.isEditMode = true; m.context.formData.existing_attachments = ['one.pdf', 'two.png'];
    upload = all(m.render(0), 'FileUploadDropzone')[0]; upload.props.onFilesSelected([a]); upload.props.onFilesSelected([b]);
    const tree = m.render(0), cards = all(tree, 'FilePreviewCard'); assert.equal(cards.length, 2); assert.equal(cards[1].props.url, 'two.png');
    for (const n of [...cards, ...all(tree, 'SelectedFilesPreview'), ...all(tree, 'FileUploadDropzone')]) assert.equal(n.props.presentation, 'compact');
    cards[1].props.onRemove(); m.context.removeExistingAttachment('two.png');
    assert.deepEqual(plain(m.context.formData.existing_attachments), ['one.pdf']); assert.deepEqual(plain(m.context.formData.remove_attachment_urls), ['two.png']);
    all(tree, 'SelectedFilesPreview')[0].props.onRemove(0); assert.equal(m.context.formData.new_attachments[0], b); assert.equal(m.context.formData.attachments[0], a);
  });

  test('Agenda actual create/edit payloads retain status, attachment mappings, date validation and edit navigation', async () => {
    for (const editing of [false, true]) {
      const m = model(files[0]), calls = [], file = new File(['a'], 'a.pdf');
      Object.assign(m.context, { isEditMode: editing, editingEventId: editing ? 'event' : null,
        createEvent: (payload) => ({ unwrap: async () => calls.push(payload) }), updateEvent: (payload) => ({ unwrap: async () => calls.push(payload) }) });
      Object.assign(m.context.formData, { attachments: [file], new_attachments: [file], remove_attachment_urls: ['original-ref'] });
      const before = m.context.formData;
      await m.context.handleAddEvent({ preventDefault() {} }); assert.equal(calls.length, 1);
      const payload = editing ? calls[0].data : calls[0]; assert.equal(payload.status, 'published'); assert.equal(payload.event_time, '14:00'); assert.equal(payload.is_public, false);
      assert.equal(payload[editing ? 'new_attachments' : 'attachments'][0], file);
      if (editing) { assert.equal(payload.remove_attachment_urls, before.remove_attachment_urls); assert.deepEqual(m.context.calls[0], ['navigate', '/agenda/event']); }
      assert.equal(m.context.isModalOpen, false);
    }
    const m = model(files[0]); let calls = 0; m.context.createEvent = () => { calls++; throw new Error('must not submit'); };
    m.context.formData.end_date = '2026-10-17'; await m.context.handleAddEvent({ preventDefault() {} }); assert.equal(calls, 0); assert.equal(m.context.notifications.length, 1);
    m.context.formData.end_date = '2026-10-19'; m.context.canCreateEvent = false; await m.context.handleAddEvent({ preventDefault() {} }); assert.equal(calls, 0);
  });

  test('Agenda drawer preserves privacy, capacity, registration actions and day-to-detail routes', async () => {
    const m = model(files[0]), event = m.context.selectedEvent;
    const calls = []; m.context.registerForEvent = (id) => ({ unwrap: async () => calls.push(['register', id]) }); m.context.unregisterFromEvent = (id) => ({ unwrap: async () => calls.push(['unregister', id]) });
    let tree = m.render(1); assert.equal(tree.props.isOpen, true);
    const register = all(tree, 'button').find((n) => n.props.onClick?.toString().includes('handleToggleRegistration'));
    assert.equal(register.props.disabled, false); await register.props.onClick();
    event.attendee_count = 2; tree = m.render(1); assert.equal(all(tree, 'button').find((n) => n.props.onClick?.toString().includes('handleToggleRegistration')).props.disabled, true);
    event.is_registered = true; tree = m.render(1); const unregister = all(tree, 'button').find((n) => n.props.onClick?.toString().includes('handleToggleRegistration')); assert.equal(unregister.props.disabled, false); await unregister.props.onClick();
    m.context.activeTab = 'participants'; m.context.registrationsData = { registrations: [{ id: 'reg', user: { first_name: 'PRIVATE_NAME', last_name: 'Secret' }, registered_at: '2026-10-18' }] };
    assert.doesNotMatch(JSON.stringify(m.render(1)), /PRIVATE_NAME/); m.context.canSeeParticipants = true; assert.match(JSON.stringify(m.render(1)), /PRIVATE_NAME/);
    m.context.dayViewModal.events = [event]; all(m.render(2), 'button')[0].props.onClick(); assert.equal(m.context.dayViewModal.isOpen, false); assert.deepEqual(m.context.calls.at(-1), ['navigate', '/agenda/event']);
    m.render(1).props.onClose(); assert.deepEqual(m.context.calls.at(-1), ['navigate', '/agenda']);
    assert.deepEqual(calls, [['register', 'event'], ['unregister', 'event']]);
  });

  test('Documents native chooser, keyboard/drop zone, upload preview and payload preserve the original single File', async () => {
    const m = model(files[1]), a = new File(['a'], 'image.png', { type: 'image/png' }), b = new File(['pdf'], 'document.pdf', { type: 'application/pdf' });
    let tree = m.render(2); const input = all(tree, 'input')[0]; assert.equal(input.props.multiple, undefined); assert.equal(input.props.accept, undefined);
    input.props.onChange({ target: { files: [a, b] } }); tree = m.render(2); assert.equal(all(tree, 'FilePreviewCard')[0].props.file, a);
    const zone = all(tree, 'div').find((n) => n.props.role === 'button'); let prevented = 0;
    zone.props.onKeyDown({ target: zone, currentTarget: zone, key: 'Enter', preventDefault: () => prevented++ }); assert.equal(prevented, 1); assert.deepEqual(m.context.calls.at(-1), ['choose']);
    zone.props.onDrop({ preventDefault() {}, dataTransfer: { files: [b, a] } }); assert.equal(m.context.selectedFile, b);
    assert.equal(all(m.render(2), 'FilePreviewCard')[0].props.file, b); assert.equal(all(m.render(2), 'FilePreviewCard')[0].props.onRemove, undefined);
    let payload; m.context.uploadDocument = (value) => ({ unwrap: async () => { payload = value; } });
    await m.context.handleUploadFile({ preventDefault() {} }); assert.equal(payload.file, b); assert.equal(payload.folder_id, 'folder'); assert.equal(m.context.selectedFile, null); assert.equal(m.context.isUploadModalOpen, false);
  });

  test('Documents folder creation, target-specific rename, preview/download actions and route close remain intact', async () => {
    const m = model(files[1]), calls = [];
    for (const name of ['createFolder', 'updateFolderMutation', 'renameDocumentMutation']) m.context[name] = (payload) => ({ unwrap: async () => calls.push([name, plain(payload)]) });
    await m.context.handleAddFolder({ preventDefault() {} }); assert.deepEqual(calls[0], ['createFolder', { name: 'Folder', parent_id: 'folder' }]);
    for (const type of ['folder', 'file']) { m.context.renameInfo = { type, id: type }; await m.context.handleRename({ preventDefault() {} }); }
    assert.deepEqual(calls[1], ['updateFolderMutation', { id: 'folder', body: { name: 'Renamed' } }]); assert.deepEqual(calls[2], ['renameDocumentMutation', { id: 'file', body: { original_name: 'Renamed' }, folderId: 'folder' }]);
    m.context.downloadTrigger = (id) => ({ unwrap: async () => ({ download_url: 'https://files.example/download', filename: 'Server.pdf' }) });
    m.context.downloadUrlAsFile = async (...args) => calls.push(['download', ...args]);
    await m.context.handleDownload('file', 'Fallback.pdf'); assert.deepEqual(calls.at(-1), ['download', 'https://files.example/download', 'Server.pdf']); assert.equal(m.context.downloadingIds.length, 0);
    for (const type of ['image', 'video', 'audio', 'pdf', 'text', 'file']) { m.context.previewType = type; const tree = m.render(3); if (type !== 'file') assert.ok(all(tree, { image: 'img', video: 'video', audio: 'audio', pdf: 'iframe', text: 'iframe' }[type]).length); }
    const tree = m.render(3); all(tree, 'button').find((n) => n.props.onClick?.toString().includes('window.open')).props.onClick(); assert.deepEqual(m.context.calls.at(-1), ['open', 'blob:authenticated', '_blank', 'noopener,noreferrer']);
    tree.props.onClose(); assert.deepEqual(m.context.calls.at(-1), ['navigate', '/documents/folder/folder']);
  });

  test('Documents authenticated preview effect keeps the original Blob loader, MIME, settled cleanup and loading/unsupported states', async () => {
    const m = model(files[1]), c = m.context;
    const effects = find(m.sf, (n) => ts.isCallExpression(n) && n.expression.getText(m.sf) === 'React.useEffect');
    const effect = effects.find((n) => n.arguments[0].getText(m.sf).includes('fetchUrlAsObjectUrl'));
    const calls = [], file = { id: 'file', mime_type: 'application/pdf' };
    Object.assign(c, { files: [file], folderId: 'folder', isLoadingContent: false,
      previewSourceUrl: 'https://api.example/protected.pdf', previewMimeType: file.mime_type,
      getDocumentPreviewUrl: (value) => { assert.equal(value, file); return 'https://api.example/protected.pdf'; },
      fetchUrlAsObjectUrl: async (...args) => { calls.push(['load', ...args]); return 'blob:loaded'; },
      URL: { revokeObjectURL: (url) => calls.push(['revoke', url]) },
      setPreviewUrl: (value) => { c.previewUrl = value; }, setIsLoadingPreview: (value) => { c.isLoadingPreview = value; },
    });
    const cleanup = evaluate(effect.arguments[0].getText(m.sf), c)();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(c.previewUrl, 'blob:loaded'); assert.equal(c.isLoadingPreview, false);
    assert.deepEqual(calls[0], ['load', 'https://api.example/protected.pdf', 'application/pdf']); cleanup(); assert.deepEqual(calls[1], ['revoke', 'blob:loaded']);
    c.isLoadingPreview = true; let tree = m.render(3); assert.equal(tree.props.footer, undefined); assert.equal(all(tree, 'PreviewSkeleton').length, 1);
    c.isLoadingPreview = false; c.previewUrl = null; assert.match(JSON.stringify(m.render(3)), /previewUnavailable/);
    c.previewUrl = 'blob:loaded'; c.previewType = 'file'; assert.match(JSON.stringify(m.render(3)), /previewNotAvailableTitle/);
  });

  test('original deletion handlers keep target-specific mutations and route navigation', async () => {
    const docs = model(files[1]), c = docs.context, calls = [];
    // React's setter schedules another render; the current handler retains its captured target.
    c.setDeletingInfo = () => {};
    c.path = [{ id: 'parent' }, { id: 'target' }];
    c.deleteFolderMutation = (id) => ({ unwrap: async () => calls.push(['folder', id]) });
    c.deleteDocumentMutation = (id) => ({ unwrap: async () => calls.push(['file', id]) });
    for (const type of ['folder', 'file']) {
      c.deletingInfo = { type, id: 'target' }; c.fileId = 'target';
      await docs.handler('handleDelete')();
      assert.deepEqual(plain(calls.at(-1)), [type, type === 'file' ? { id: 'target', folderId: 'folder' } : 'target']);
      assert.deepEqual(c.calls.at(-1), ['navigate', type === 'folder' ? '/documents/folder/parent' : '/documents/folder/folder']);
    }
    const agenda = model(files[0]); agenda.context.deletingId = 'event'; agenda.context.deleteEvent = (id) => ({ unwrap: async () => calls.push(['event', id]) });
    await agenda.handler('handleDeleteEvent')(); assert.deepEqual(calls.at(-1), ['event', 'event']); assert.deepEqual(agenda.context.calls.at(-1), ['navigate', '/agenda']);
  });
}
