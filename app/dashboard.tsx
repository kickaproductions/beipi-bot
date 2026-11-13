'use client';
import { useEffect, useState, type CSSProperties, type FormEvent, type MouseEvent } from 'react';
import { House, Bell, ClipboardCheck, Lightbulb, Link2, Users, UserPlus, Plus, ArrowUpRight, ChevronRight, Check, Clock, Trash2, Pencil, Grid2X2, List, X, ChevronDown, ShieldCheck, Leaf, Menu, RotateCcw, Heart, Sparkles, Radio, Hash, Moon, Sun, Settings, BarChart3, LayoutDashboard, CalendarDays, MessageSquareText, LogOut, LockKeyhole, Accessibility, Type, Contrast, GripVertical, ArrowUp, ArrowDown, ExternalLink } from 'lucide-react';
import DiscordSetup from './discord-setup';
import MyCrew, { streamDetails } from './my-crew';
import StreamGameArt from './stream-game-art';
import { dashboardPaths, dashboardViewFromPath, type DashboardView as View } from '@/lib/dashboard-sections';
import { createClient } from '@/lib/supabase/client';
type Item = {
    id: string;
    kind: string;
    title: string;
    note: string;
    due: string | null;
    done: boolean;
    priority: 'low' | 'medium' | 'high';
    colorHex: string;
    checklistPhase: 'pre' | 'post';
    sortOrder: number;
    createdByPip: boolean;
    pinned: boolean;
    sharedAddedByName: string;
    createdAt: string;
};
type TwitchConnection = {
    connected: boolean;
    user?: {
        id: string;
        login: string;
        displayName: string;
        profileImageUrl: string;
    };
};
type DiscordConnection = {
    connected: boolean;
    user?: {
        id: string;
        username: string;
        displayName: string;
        avatarUrl: string;
    };
    guilds?: Array<{
        id: string;
        name: string;
        iconUrl: string;
    }>;
};
type GoogleConnection = {
    connected: boolean;
    user?: {
        id: string;
        email: string;
        name: string;
        picture: string;
    };
    channel?: {
        id: string;
        title: string;
        thumbnailUrl: string;
        handle?: string;
    };
};
type SettingsTab = 'account' | 'accessibility';
const DEFAULT_TEXT_SIZE = 100;
const LEGACY_LARGE_TEXT_SIZE = 120;
const MAX_TEXT_SIZE = 150;
const TEXT_SIZE_STEP = 10;
const TEXT_SIZE_KEY = 'beipi-a11y-text-size';

function getSavedTextSize(storage: Storage) {
    const savedSize = storage.getItem(TEXT_SIZE_KEY);
    if (savedSize === null) {
        return storage.getItem('beipi-a11y-large-text') === 'true' ? LEGACY_LARGE_TEXT_SIZE : DEFAULT_TEXT_SIZE;
    }
    const size = Number(savedSize);
    return size >= DEFAULT_TEXT_SIZE && size <= MAX_TEXT_SIZE && size % TEXT_SIZE_STEP === 0
        ? size
        : DEFAULT_TEXT_SIZE;
}
type StreamTab = 'overview' | 'checklist' | 'schedule' | 'analytics';
const navigation = [{ name: 'Home', icon: House }, { name: 'Reminders', icon: Bell }, { name: 'My Stream', icon: Radio }, { name: 'Idea Pocket', icon: Lightbulb }, { name: 'Discord Setup', icon: Hash }, { name: 'Connections', icon: Link2 }, { name: 'My Crew', icon: Users }] as const;
const betaFeatures = [
    { name: 'Gentle reminders', copy: 'Keep small tasks from becoming noisy thoughts.', icon: Bell, tone: 'lavender' },
    { name: 'My Stream', copy: 'Plan streams, use checklists and see clear insights.', icon: Radio, tone: 'mint' },
    { name: 'Idea Pocket', copy: 'Catch content ideas before they wander off.', icon: Lightbulb, tone: 'peach' },
    { name: 'Discord Setup', copy: 'Create channels, messages and reaction roles.', icon: Hash, tone: 'lavender' },
    { name: 'Connections', copy: 'Bring Twitch, Discord and YouTube together.', icon: Link2, tone: 'mint' },
    { name: 'Shared spaces', copy: 'Plan alongside the moderators you trust.', icon: Users, tone: 'peach' }
] as const;
const kinds: Record<string, string> = { 'Reminders': 'reminder', 'My Stream': 'checklist', 'Idea Pocket': 'idea', 'Connections': 'connection' };
function Beipi() { return <img src="/beipi-dashboard-peek-v3.png" alt="B.E.I.P.I, your cheerful purple-and-yellow bird companion"/>; }
function BeipiWriting() { return <img className="beipi-writing" src="/beipi-writing.png" alt="B.E.I.P.I writing in her notebook"/>; }
function TwitchLogo() { return <svg viewBox="0 0 24 24" role="img" aria-label="Twitch"><path fill="currentColor" d="M4 2h18v12.5L17 19.5h-4L10.5 22H7v-2.5H2V6l2-4Zm2 2L4 6v11.5h5V20l2.5-2.5H16l4-4V4H6Zm4 3h2v6h-2V7Zm5 0h2v6h-2V7Z"/></svg>; }
function YouTubeLogo() { return <svg viewBox="0 0 24 24" role="img" aria-label="YouTube"><path fill="currentColor" d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8ZM9.6 15.6V8.4l6.3 3.6-6.3 3.6Z"/></svg>; }
function DiscordLogo() { return <svg viewBox="0 0 24 24" role="img" aria-label="Discord"><path fill="currentColor" d="M19.5 5.3A16.3 16.3 0 0 0 15.4 4l-.5 1a15.1 15.1 0 0 0-5.8 0l-.5-1a16.5 16.5 0 0 0-4.1 1.3C1.9 9.2 1.2 13 1.5 16.8A16.8 16.8 0 0 0 6.6 19l1.2-1.7c-.7-.3-1.4-.6-2-1l.5-.4c3.8 1.8 7.8 1.8 11.5 0l.5.4c-.7.4-1.3.7-2 1l1.2 1.7a16.7 16.7 0 0 0 5.1-2.2c.4-4.4-.7-8.1-3.1-11.5ZM8.3 14.6c-1.1 0-2.1-1.1-2.1-2.5s.9-2.5 2.1-2.5 2.1 1.1 2.1 2.5-.9 2.5-2.1 2.5Zm7.4 0c-1.1 0-2.1-1.1-2.1-2.5s.9-2.5 2.1-2.5 2.1 1.1 2.1 2.5-.9 2.5-2.1 2.5Z"/></svg>; }
const futurePlatforms = [
    { name: 'TikTok', className: 'tiktok', mark: <span>♪</span>, copy: 'Connect your creator profile and prepare TikTok LIVE alerts.', note: 'Developer approval will be required' },
    { name: 'Facebook', className: 'facebook', mark: <span>f</span>, copy: 'Keep Facebook streams visible alongside your other channels.', note: 'Platform access to be reviewed' },
    { name: 'Custom RTMP', className: 'rtmp', mark: <Radio size={23}/>, copy: 'Save another streaming destination or custom broadcast endpoint.', note: 'Manual setup planned' }
];
const appearancePalettes = [
    { id: 'light', label: 'Light', colours: ['#f8f7fa', '#e9def2', '#8058b7'] },
    { id: 'dark', label: 'Dark', colours: ['#17121f', '#332541', '#b99ae6'] },
    { id: 'pastel', label: 'Pastel', colours: ['#f7eff9', '#e7f3ed', '#7752a2'] },
    { id: 'rainbow', label: 'Dark rainbow', colours: ['#141420', '#ffacd1', '#a8e2cb', '#b9b6ff'] },
    { id: 'contrast', label: 'Super contrast', colours: ['#08080c', '#fff', '#ffe06b'] },
] as const;
type AppearancePalette = typeof appearancePalettes[number]['id'];

const COMPLETION_MESSAGE = 'One less thing to remember. Nice work!';
const CONFETTI_COLOURS = ['#c9a6f5', '#f4a9cc', '#ffe291', '#9ae8bc', '#a8d9ff'];
const CONFETTI_PIECES = Array.from({ length: 88 }, (_, index) => ({
    '--confetti-left': ((index * 47 % 97) + 1) + '%',
    '--confetti-drift': ((index * 31 % 37) - 18) + 'vw',
    '--confetti-spin': ((index * 71 % 900) - 450) + 'deg',
    '--confetti-delay': (index * 23 % 480) + 'ms',
    '--confetti-duration': (1250 + index * 73 % 600) + 'ms',
    '--confetti-colour': CONFETTI_COLOURS[index % CONFETTI_COLOURS.length],
} as CSSProperties));
const DEFAULT_STREAM_VISUALS = { readinessPie: false, gameArt: false };

export default function Dashboard({ accountId = '', userName = 'Creator', initialUsername = '', isDeveloper = false, isTester = false }: {
    accountId?: string;
    userName?: string;
    initialUsername?: string;
    isDeveloper?: boolean;
    isTester?: boolean;
}) {
    const [popout, setPopout] = useState(false);
    const [completionCount, setCompletionCount] = useState(0);
    const [visualSettingsOpen, setVisualSettingsOpen] = useState(false);
    const [streamVisuals, setStreamVisuals] = useState(DEFAULT_STREAM_VISUALS);
    const streamVisualsKey = 'beipi-stream-visuals:' + accountId;

    useEffect(() => {
        try {
            const saved = JSON.parse(window.localStorage.getItem(streamVisualsKey) ?? 'null');
            setStreamVisuals({
                readinessPie: saved?.readinessPie === true,
                gameArt: saved?.gameArt === true,
            });
        } catch {
            setStreamVisuals(DEFAULT_STREAM_VISUALS);
        }
    }, [streamVisualsKey]);

    function updateStreamVisual(key: keyof typeof DEFAULT_STREAM_VISUALS, enabled: boolean) {
        const updated = { ...streamVisuals, [key]: enabled };
        setStreamVisuals(updated);
        try {
            window.localStorage.setItem(streamVisualsKey, JSON.stringify(updated));
        } catch {
            // Keep the current choice usable when local storage is unavailable.
        }
    }

    const [discordDirty, setDiscordDirty] = useState(false);
    const [textSize, setTextSize] = useState(DEFAULT_TEXT_SIZE);
    const [view, setView] = useState<View>('Home'), [settingsTab, setSettingsTab] = useState<SettingsTab>('account'), [initialCrewSpace, setInitialCrewSpace] = useState(''), [crewInviteOpen, setCrewInviteOpen] = useState(false), [streamTab, setStreamTab] = useState<StreamTab>('overview'), [items, setItems] = useState<Item[]>([]), [loading, setLoading] = useState(true), [error, setError] = useState(''), [toast, setToast] = useState(''), [busy, setBusy] = useState(false), [dialog, setDialog] = useState<string | null>(null), [filter, setFilter] = useState('open'), [menu, setMenu] = useState(false), [focus, setFocus] = useState(false), [palette, setPalette] = useState<AppearancePalette>('dark'), [highContrast, setHighContrast] = useState(false), [reducedMotion, setReducedMotion] = useState(false), [underlineLinks, setUnderlineLinks] = useState(false), [preferencesLoaded, setPreferencesLoaded] = useState(false), [username, setUsername] = useState(initialUsername), [usernameDraft, setUsernameDraft] = useState(initialUsername), [usernameBusy, setUsernameBusy] = useState(false), [usernameError, setUsernameError] = useState(''), [identityName, setIdentityName] = useState(initialUsername || userName);
    const dark = palette === 'dark' || palette === 'rainbow' || palette === 'contrast';
    const effectiveContrast = highContrast || palette === 'contrast';
    const [editingItem, setEditingItem] = useState<Item | null>(null), [itemColour, setItemColour] = useState('#A679C4'), [listLayout, setListLayout] = useState<Record<'Reminders' | 'Idea Pocket', 'list' | 'grid'>>({ Reminders: 'list', 'Idea Pocket': 'grid' }), [checklistLayout, setChecklistLayout] = useState<'list' | 'grid'>('list'), [checklistPhase, setChecklistPhase] = useState<'pre' | 'post'>('pre'), [draggedItemId, setDraggedItemId] = useState(''), [priorityFilter, setPriorityFilter] = useState<'all' | 'low' | 'medium' | 'high'>('all'), [reminderDateFrom, setReminderDateFrom] = useState(''), [reminderDateTo, setReminderDateTo] = useState('');
    const [twitch, setTwitch] = useState<TwitchConnection>({ connected: false }), [twitchLoading, setTwitchLoading] = useState(true);
    const [discord, setDiscord] = useState<DiscordConnection>({ connected: false }), [discordLoading, setDiscordLoading] = useState(true);
    const [google, setGoogle] = useState<GoogleConnection>({ connected: false }), [googleLoading, setGoogleLoading] = useState(true);
    async function syncApprovedItems(reportError: boolean) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        try {
            const response = await fetch(`/api/items?pastStreamsBefore=${encodeURIComponent(today.toISOString())}`, { cache: 'no-store' });
            const data = await response.json() as Item[] & { error?: string };
            if (!response.ok)
                throw Error(data.error);
            setItems(data);
            return true;
        }
        catch (approvalError) {
            if (reportError)
                setError(approvalError instanceof Error ? approvalError.message : 'The item was approved, but Pip could not refresh your lists.');
            return false;
        }
    }
    async function refreshItemsAfterSharedApproval() {
        const synced = await syncApprovedItems(true);
        if (synced)
            setToast('Approved. Pip added it to the right list.');
        window.setTimeout(() => { void syncApprovedItems(false); }, 700);
    }
    useEffect(() => { const savedPalette = appearancePalettes.find(option => option.id === window.localStorage.getItem('beipi-palette'));
        if (savedPalette) setPalette(savedPalette.id);
        else if (window.localStorage.getItem('beipi-theme') === 'light') setPalette('light'); setTextSize(getSavedTextSize(window.localStorage)); setHighContrast(window.localStorage.getItem('beipi-a11y-high-contrast') === 'true'); setUnderlineLinks(window.localStorage.getItem('beipi-a11y-underline-links') === 'true'); const savedMotion = window.localStorage.getItem('beipi-a11y-reduced-motion'); setReducedMotion(savedMotion === null ? window.matchMedia('(prefers-reduced-motion: reduce)').matches : savedMotion === 'true'); const reminderLayout = window.localStorage.getItem('beipi-reminder-layout'), ideaLayout = window.localStorage.getItem('beipi-idea-layout'), savedChecklistLayout = window.localStorage.getItem('beipi-checklist-layout'); setListLayout({ Reminders: reminderLayout === 'grid' ? 'grid' : 'list', 'Idea Pocket': ideaLayout === 'list' ? 'list' : 'grid' }); setChecklistLayout(savedChecklistLayout === 'grid' ? 'grid' : 'list'); setPreferencesLoaded(true); }, []);
    useEffect(() => {
        function restoreDashboardLocation() {
            const params = new URLSearchParams(window.location.search);
            const crewSpace = params.get('crewSpace') || '';
            const destination = dashboardViewFromPath(window.location.pathname) || 'Home';
            setPopout(params.get('popout') === '1');
            setInitialCrewSpace(isTester ? crewSpace : '');
            setCrewInviteOpen(false);
            setMenu(false);
            setFilter('open');
            if (!isTester && destination !== 'Home' && destination !== 'Account settings') {
                window.location.replace('/tester');
                return;
            }
            setView(isTester && crewSpace && destination === 'Home' ? 'My Crew' : destination);
            const tab = params.get('stream');
            setStreamTab(tab === 'checklist' || tab === 'schedule' || tab === 'analytics' ? tab : 'overview');
        }

        restoreDashboardLocation();
        window.addEventListener('popstate', restoreDashboardLocation);
        return () => window.removeEventListener('popstate', restoreDashboardLocation);
    }, [isTester]);
    useEffect(() => { if (!preferencesLoaded)
        return; window.localStorage.setItem('beipi-palette', palette); window.localStorage.setItem('beipi-a11y-high-contrast', String(highContrast)); window.localStorage.setItem('beipi-a11y-reduced-motion', String(reducedMotion)); window.localStorage.setItem('beipi-a11y-underline-links', String(underlineLinks)); }, [preferencesLoaded, palette, highContrast, reducedMotion, underlineLinks]);
    useEffect(() => {
        if (preferencesLoaded) window.localStorage.setItem(TEXT_SIZE_KEY, String(textSize));
    }, [preferencesLoaded, textSize]);
    useEffect(() => { if (!preferencesLoaded)
        return; window.localStorage.setItem('beipi-reminder-layout', listLayout.Reminders); window.localStorage.setItem('beipi-idea-layout', listLayout['Idea Pocket']); }, [preferencesLoaded, listLayout]);
    useEffect(() => { if (!preferencesLoaded)
        return; window.localStorage.setItem('beipi-checklist-layout', checklistLayout); }, [preferencesLoaded, checklistLayout]);
    useEffect(() => { if (!isTester) {
        setLoading(false);
        return;
    } const today = new Date(); today.setHours(0, 0, 0, 0); fetch(`/api/items?pastStreamsBefore=${encodeURIComponent(today.toISOString())}`, { cache: 'no-store' }).then(async (r) => { const data = await r.json() as Item[] & {
        error?: string;
    }; if (!r.ok)
        throw Error(data.error); setItems(data); }).catch(e => setError(e.message || 'Could not load your notes. Please refresh.')).finally(() => setLoading(false)); }, [isTester]);
    useEffect(() => { if (!isTester) {
        setTwitchLoading(false);
        return;
    } fetch('/api/auth/twitch/status', { cache: 'no-store' }).then(r => r.json()).then(data => setTwitch(data as TwitchConnection)).catch(() => setTwitch({ connected: false })).finally(() => setTwitchLoading(false)); const params = new URLSearchParams(window.location.search); const result = params.get('twitch'), twitchError = params.get('twitch_error'); if (result === 'connected')
        setToast('Twitch connected. B.E.I.P.I. found your channel!'); if (result === 'denied')
        setError(twitchError ? `Twitch declined the connection: ${twitchError}` : 'Twitch did not approve the connection. Please try again.'); if (result === 'error' || result === 'invalid-state')
        setError('Twitch could not be connected. Please try again.'); }, [isTester]);
    useEffect(() => { if (!isTester) {
        setDiscordLoading(false);
        return;
    } fetch('/api/auth/discord/status', { cache: 'no-store' }).then(r => r.json()).then(data => setDiscord(data as DiscordConnection)).catch(() => setDiscord({ connected: false })).finally(() => setDiscordLoading(false)); const result = new URLSearchParams(window.location.search).get('discord'); if (result === 'connected')
        setToast('Discord connected. B.E.I.P.I. found your manageable servers!'); if (result === 'denied')
        setToast('Discord connection was cancelled.'); if (result === 'not-configured')
        setError('Discord dashboard connection is not configured yet.'); if (result === 'error' || result === 'invalid-state')
        setError('Discord could not be connected. Please try again.'); }, [isTester]);
    useEffect(() => { if (!isTester) {
        setGoogleLoading(false);
        return;
    } fetch('/api/auth/google/status', { cache: 'no-store' }).then(r => r.json()).then(data => setGoogle(data as GoogleConnection)).catch(() => setGoogle({ connected: false })).finally(() => setGoogleLoading(false)); const result = new URLSearchParams(window.location.search).get('google'); if (result === 'connected')
        setToast('Google connected. B.E.I.P.I. found your YouTube channel!'); if (result === 'denied')
        setToast('Google connection was cancelled.'); if (result === 'not-configured')
        setError('Google connection is not configured yet.'); if (result === 'error' || result === 'invalid-state')
        setError('Google could not be connected. Please try again.'); }, [isTester]);
    useEffect(() => { if (!toast)
        return; const id = setTimeout(() => setToast(''), 4000); return () => clearTimeout(id); }, [toast, completionCount]);
    useEffect(() => { if (!dialog) {
        setEditingItem(null);
        return;
    } function key(e: KeyboardEvent) { if (e.key === 'Escape')
        setDialog(null); if (e.key === 'Tab') {
        const nodes = Array.from(document.querySelectorAll<HTMLElement>('.modal button:not(:disabled), .modal input:not(:disabled), .modal textarea:not(:disabled), .modal select:not(:disabled), .modal a[href]'));
        const first = nodes[0], last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last?.focus();
        }
        else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first?.focus();
        }
    } } window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key); }, [dialog]);
    const open = items.filter(i => !i.done), reminderOrder = items.filter(i => i.kind === 'reminder').sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)), reminders = reminderOrder.filter(i => !i.done), checklist = items.filter(i => i.kind === 'checklist'), preChecklist = checklist.filter(i => (i.checklistPhase || 'pre') === 'pre').sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)), preChecked = preChecklist.filter(i => i.done).length, activeChecklist = checklist.filter(i => (i.checklistPhase || 'pre') === checklistPhase).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)), activeChecked = activeChecklist.filter(i => i.done).length;
    const nextStream = items.filter(item => item.kind === 'crew-stream' && !item.done && item.due && new Date(item.due).getTime() > Date.now()).sort((left, right) => new Date(left.due!).getTime() - new Date(right.due!).getTime())[0];
    const nextGame = nextStream ? streamDetails(nextStream.note).game.trim() : '';
    const readinessPercent = preChecklist.length ? Math.round(preChecked / preChecklist.length * 100) : 0;
    async function request(method: string, body?: unknown, id?: string) { setBusy(true); setError(''); try {
        const r = await fetch('/api/items' + (id ? '?id=' + encodeURIComponent(id) : ''), { method, headers: { 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
        const data = await r.json() as Item & {
            error?: string;
        };
        if (!r.ok)
            throw Error(data.error);
        if (method === 'POST')
            setItems(old => [data, ...old]);
        if (method === 'PATCH')
            setItems(old => old.map(i => i.id === data.id ? data : i));
        if (method === 'DELETE')
            setItems(old => old.filter(i => i.id !== id));
        return true;
    }
    catch (e) {
        setError(e instanceof Error ? e.message : 'Something didn’t save. Please try again.');
        return false;
    }
    finally {
        setBusy(false);
    } }
    function openNewItem(kind: string) { setEditingItem(null); setItemColour(kind === 'idea' ? '#E4B85A' : '#A679C4'); setDialog(kind); }
    function openEditItem(item: Item) { setEditingItem(item); setItemColour(item.colorHex || (item.kind === 'idea' ? '#E4B85A' : '#A679C4')); setDialog(item.kind); }
    async function add(e: FormEvent<HTMLFormElement>) { e.preventDefault(); const form = new FormData(e.currentTarget), due = String(form.get('due') || ''), priority = String(form.get('priority') || editingItem?.priority || 'medium'), phase = String(form.get('checklistPhase') || editingItem?.checklistPhase || checklistPhase) as 'pre' | 'post', colorHex = /^#[0-9A-Fa-f]{6}$/.test(itemColour) ? itemColour.toUpperCase() : (dialog === 'idea' ? '#E4B85A' : '#A679C4'); const phaseItems = checklist.filter(item => (item.checklistPhase || 'pre') === phase); const payload = { title: form.get('title'), note: form.get('note') || '', due: due ? new Date(due + 'T12:00:00').toISOString() : null, priority, ...(['reminder', 'idea'].includes(dialog || '') ? { colorHex } : {}), ...(dialog === 'checklist' ? { checklistPhase: phase, sortOrder: editingItem?.sortOrder ?? phaseItems.length } : dialog === 'reminder' ? { sortOrder: editingItem?.sortOrder ?? reminderOrder.length } : {}) }; const saved = editingItem ? await request('PATCH', { id: editingItem.id, ...payload }) : await request('POST', { kind: dialog, ...payload }); if (saved) {
        setDialog(null);
        setEditingItem(null);
        setToast(editingItem ? 'Updated. Pip has kept everything tidy.' : 'Saved. You don’t have to hold that thought anymore.');
    } }
    async function toggle(item: Item) {
        if (!await request('PATCH', { id: item.id, done: !item.done })) return;

        if (!item.done && (item.kind === 'reminder' || item.kind === 'checklist')) {
            setCompletionCount(count => count + 1);
            setToast(COMPLETION_MESSAGE);
        } else {
            setToast(item.done ? 'Back on your list.' : 'Marked as done.');
        }
    }
    async function template() { const starter = checklistPhase === 'pre' ? ['Check microphone and game audio', 'Update stream title and category', 'Get water and take a breath'] : ['Save or review your stream recording', 'Note clips and highlights to revisit', 'Thank your community and moderators']; for (const [index, title] of starter.entries())
        if (!await request('POST', { kind: 'checklist', title, checklistPhase, sortOrder: activeChecklist.length + index, createdByPip: true }))
            return; setToast(`Pip saved your ${checklistPhase === 'pre' ? 'pre-stream' : 'post-stream'} starter checklist. You can edit every step.`); }
    async function resetChecklist() { for (const item of activeChecklist.filter(i => i.done))
        if (!await request('PATCH', { id: item.id, done: false }))
            return; setToast('Checklist reset. B.E.I.P.I. is ready for the next stream!'); }
    async function reorderItems(sourceId: string, targetId: string, kind: 'checklist' | 'reminder') { if (!sourceId || sourceId === targetId) return; const ordered = [...(kind === 'checklist' ? activeChecklist : reminderOrder)], from = ordered.findIndex(item => item.id === sourceId), to = ordered.findIndex(item => item.id === targetId); if (from < 0 || to < 0) return; const [moved] = ordered.splice(from, 1); ordered.splice(to, 0, moved); const positions = ordered.map((item, sortOrder) => ({ id: item.id, sortOrder })); setItems(current => current.map(item => { const position = positions.find(entry => entry.id === item.id); return position ? { ...item, sortOrder: position.sortOrder } : item; })); setDraggedItemId(''); setBusy(true); try { const response = await fetch('/api/items', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ positions, kind }) }); if (!response.ok) throw Error(); setToast(kind === 'reminder' ? 'Reminder order saved.' : 'Checklist order saved.'); } catch { setError(`Pip could not save that ${kind === 'reminder' ? 'reminder' : 'checklist'} order. Please try again.`); } finally { setBusy(false); } }
    function moveItem(itemId: string, direction: -1 | 1, kind: 'checklist' | 'reminder') { const ordered = kind === 'checklist' ? activeChecklist : reminderOrder, index = ordered.findIndex(item => item.id === itemId), target = ordered[index + direction]; if (target) void reorderItems(itemId, target.id, kind); }
    async function disconnectTwitch() { setBusy(true); try {
        await fetch('/api/auth/twitch/disconnect', { method: 'POST' });
        setTwitch({ connected: false });
        setToast('Twitch disconnected.');
    }
    catch {
        setError('Twitch could not be disconnected. Please try again.');
    }
    finally {
        setBusy(false);
    } }
    async function disconnectDiscord() { setBusy(true); try {
        await fetch('/api/auth/discord/disconnect', { method: 'POST' });
        setDiscord({ connected: false });
        setToast('Discord disconnected from the dashboard. B.E.I.P.I. remains installed in your server.');
    }
    catch {
        setError('Discord could not be disconnected. Please try again.');
    }
    finally {
        setBusy(false);
    } }
    async function disconnectGoogle() { setBusy(true); try {
        await fetch('/api/auth/google/disconnect', { method: 'POST' });
        setGoogle({ connected: false });
        setToast('Google and YouTube disconnected.');
    }
    catch {
        setError('Google could not be disconnected. Please try again.');
    }
    finally {
        setBusy(false);
    } }
    async function logOut() { setBusy(true); setError(''); try {
        const supabase = createClient();
        const { error } = await supabase.auth.signOut();
        if (error)
            throw error;
        window.location.assign('/account');
    }
    catch (value) {
        setError(value instanceof Error ? value.message : 'B.E.I.P.I. could not log you out. Please try again.');
        setBusy(false);
    } }
    async function saveUsername(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setUsernameBusy(true); setUsernameError(''); try {
        const response = await fetch('/api/account/profile', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: usernameDraft }) });
        const data = await response.json();
        if (!response.ok)
            throw Error(data.error || 'Your username could not be saved.');
        setUsername(data.username);
        setUsernameDraft(data.username);
        setIdentityName(data.username);
        setToast(`Username saved as @${data.username}.`);
    }
    catch (value) {
        setUsernameError(value instanceof Error ? value.message : 'Your username could not be saved.');
    }
    finally {
        setUsernameBusy(false);
    } }
    function dashboardUrl(name: View, tab: StreamTab, inPopout: boolean) {
        const params = new URLSearchParams();
        if (inPopout) params.set('popout', '1');
        if (name === 'My Stream' && tab !== 'overview') params.set('stream', tab);
        if (name === 'My Crew' && initialCrewSpace) params.set('crewSpace', initialCrewSpace);
        return dashboardPaths[name] + (params.size ? '?' + params.toString() : '');
    }

    function change(name: View, tab = streamTab) {
        if (!isTester && name !== 'Home' && name !== 'Account settings') {
            window.location.assign('/tester');
            return;
        }
        if (name !== view && view === 'Discord Setup' && discordDirty && !confirm('Leave your unsaved Discord draft?')) return;
        const url = dashboardUrl(name, tab, popout);
        if (window.location.pathname + window.location.search !== url) window.history.pushState(null, '', url);
        if (name !== view) setFilter('open');
        setView(name);
        if (name === 'My Stream') setStreamTab(tab);
        setCrewInviteOpen(false);
        setMenu(false);
    }

    function followDashboardLink(event: MouseEvent<HTMLAnchorElement>, name: View, tab = streamTab) {
        if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        change(name, tab);
    }

    const openMyStream = (tab: StreamTab) => change('My Stream', tab);
    const popoutUrl = dashboardUrl(view, streamTab, true);

    function openDashboardWindow(event: MouseEvent<HTMLAnchorElement>) {
        if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
        const popup = window.open('', '_blank', 'popup,width=1050,height=780');
        if (!popup) return;
        event.preventDefault();
        popup.opener = null;
        popup.location.replace(event.currentTarget.href);
    }

    function rows(list: Item[], compact = false, layout: 'list' | 'grid' = 'list', reorderKind: 'checklist' | 'reminder' | null = null) {
        return <div className={'rows ' + (compact ? 'compact ' : '') + (layout === 'grid' ? 'grid-view' : 'list-view')}>
            {list.map((item, index) => <article draggable={Boolean(reorderKind)} onDragStart={() => setDraggedItemId(item.id)} onDragEnd={() => setDraggedItemId('')} onDragOver={event => { if (reorderKind) event.preventDefault(); }} onDrop={() => { if (reorderKind) void reorderItems(draggedItemId, item.id, reorderKind); }} className={'item ' + (reorderKind ? 'movable-item ' : '') + (['reminder', 'idea'].includes(item.kind) ? 'custom-colour ' : '') + (item.kind === 'reminder' ? `priority-${item.priority || 'medium'} ` : item.kind === 'idea' ? 'idea-colour ' : '') + (draggedItemId === item.id ? 'dragging ' : '') + (item.done ? 'completed' : '')} style={['reminder', 'idea'].includes(item.kind) ? {'--item-accent': item.colorHex || (item.kind === 'idea' ? '#E4B85A' : '#A679C4')} as CSSProperties : undefined} key={item.id}>
                {reorderKind && <span className="drag-handle" title="Drag to move"><GripVertical size={17}/></span>}
                <button className="check" aria-label={(item.done ? 'Reopen ' : 'Complete ') + item.title} disabled={busy} onClick={() => toggle(item)}>{item.done && <Check size={14}/>}</button>
                <div className="item-text"><div className="item-title-line">{['reminder', 'idea'].includes(item.kind) && <span className="item-colour-dot" aria-hidden="true"/>}<strong>{item.title}</strong>{item.kind === 'reminder' && <span className={'priority-pill ' + (item.priority || 'medium')}>{item.priority || 'medium'}</span>}</div>{item.note && <p>{item.note}</p>}{(item.due || item.kind === 'connection' || item.kind === 'checklist' || item.sharedAddedByName) && <small>{item.due ? <><Clock size={12}/> {new Date(item.due).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</> : item.kind === 'connection' ? 'Saved reference · Not connected' : item.kind === 'checklist' ? item.createdByPip ? 'Saved by Pip' : 'Saved by you' : null}{item.sharedAddedByName && <>{item.due ? ' · ' : ''}Added by {item.sharedAddedByName}</>}</small>}</div>
                {!compact && <div className="item-actions">{reorderKind && <><button title="Move up" aria-label={'Move ' + item.title + ' up'} disabled={busy || index === 0} onClick={() => moveItem(item.id, -1, reorderKind)}><ArrowUp size={15}/></button><button title="Move down" aria-label={'Move ' + item.title + ' down'} disabled={busy || index === list.length - 1} onClick={() => moveItem(item.id, 1, reorderKind)}><ArrowDown size={15}/></button></>}<button title="Edit" aria-label={'Edit ' + item.title} disabled={busy} onClick={() => openEditItem(item)}><Pencil size={15}/></button>{item.kind === 'reminder' && !item.done && <button title="Move reminder to tomorrow" aria-label={'Snooze ' + item.title + ' until tomorrow'} disabled={busy} onClick={() => { const date = new Date(); date.setDate(date.getDate() + 1); void request('PATCH', { id: item.id, due: date.toISOString() }).then(ok => ok && setToast('Moved to tomorrow.')); }}><Clock size={16}/></button>}<button title="Delete" aria-label={'Delete ' + item.title} disabled={busy} onClick={() => { if (confirm('Delete this saved item?')) void request('DELETE', undefined, item.id); }}><Trash2 size={16}/></button></div>}
            </article>)}
        </div>;
    }
    function empty(kind: string) { return <div className="empty"><div className="empty-icon">{kind === 'checklist' ? <ClipboardCheck /> : kind === 'idea' ? <Lightbulb /> : <Leaf />}</div><h3>{kind === 'checklist' ? 'Your routine, your way.' : kind === 'idea' ? 'A home for your next good idea.' : 'A little space to breathe.'}</h3><p>{kind === 'checklist' ? 'Save the things you like to check before going live.' : kind === 'idea' ? 'Stream ideas, games to try, little thoughts worth keeping.' : 'Nothing waiting here. Add a note whenever you need one.'}</p>{kind === 'checklist' ? <button className="primary" disabled={busy} onClick={() => void template()}>Use a starter checklist <Plus size={16}/></button> : <button className="outline" onClick={() => openNewItem(kind)}>Add your first {kind === 'idea' ? 'idea' : 'reminder'} <Plus size={16}/></button>}</div>; }
    return <div className={'shell ' + (popout ? 'dashboard-popout ' : '') + (focus ? 'focus-mode ' : '') + (dark ? 'dark-theme ' : 'light-theme ') + (textSize > DEFAULT_TEXT_SIZE ? 'text-large ' : '') + (effectiveContrast ? 'high-contrast ' : '') + (reducedMotion ? 'reduce-motion ' : '') + (underlineLinks ? 'underline-links' : '')} data-palette={palette} style={{ '--dashboard-text-scale': textSize / DEFAULT_TEXT_SIZE } as CSSProperties}>
 <aside id="dashboard-navigation" className={menu ? 'sidebar visible' : 'sidebar'}><a href="/" className="brand"><span className="brand-mark">B<span>•</span></span><div>B.E.I.P.I<small>Your streaming companion</small></div></a><div className="workspace"><div className="workspace-icon">{identityName.slice(0, 1).toUpperCase()}</div><div><strong>{identityName}</strong><small>{isTester ? 'Your private dashboard' : 'Dashboard preview'}</small></div><ShieldCheck size={16}/></div><div className="nav-label">YOUR SPACE</div><nav aria-label="Dashboard sections">{navigation.map(({ name, icon: Icon }) => { const locked = !isTester && name !== 'Home', count = name === 'Reminders' ? reminders.length : name === 'Idea Pocket' ? open.filter(item => item.kind === 'idea').length : 0; return <a key={name} href={locked ? "/tester" : dashboardUrl(name, streamTab, popout)} className={'dashboard-nav-link ' + (view === name ? 'active ' : '') + (locked ? 'nav-locked' : '')} onClick={event => followDashboardLink(event, name)} aria-current={view === name ? 'page' : undefined} aria-label={locked ? `${name} — beta access required` : name} title={popout ? name : undefined}><Icon size={19}/><span className="dashboard-nav-text">{name}</span>{locked ? <LockKeyhole className="nav-lock" size={14}/> : count > 0 && <span className="count">{count}</span>}</a>; })}</nav><div className="sidebar-note"><Heart size={17}/><p>Less to remember.<br /><strong>More room to be you.</strong></p></div><a href={dashboardUrl("Account settings", streamTab, popout)} className={'profile ' + (view === 'Account settings' ? 'active' : '')} aria-label={popout ? 'Account settings' : undefined} title={popout ? 'Account settings' : undefined} onClick={event => followDashboardLink(event, 'Account settings')} aria-current={view === 'Account settings' ? 'page' : undefined}><div className="avatar">{identityName.slice(0, 1).toUpperCase()}</div><div><strong>{identityName}</strong><small>Account settings</small></div><Settings size={15}/></a></aside>
 <div className="body"><header className="topbar"><div className="crumb"><button className="mobile-menu" aria-label={menu ? 'Close navigation menu' : 'Open navigation menu'} aria-expanded={menu} aria-controls="dashboard-navigation" onClick={() => setMenu(!menu)}><Menu size={22}/></button><span>Your companion</span><ChevronRight size={14}/><strong>{view}</strong></div><div className="topbar-actions">{!popout && <a className="quiet dashboard-popout-link" href={popoutUrl} target="_blank" rel="noopener" aria-label="Open dashboard in a new window" title="Open dashboard in a new window" onClick={openDashboardWindow}><ExternalLink size={15}/><span>Pop out</span></a>}<button className="quiet theme-toggle" onClick={() => setPalette(dark ? 'light' : 'dark')} aria-pressed={!dark} aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'} title={dark ? 'Switch to light mode' : 'Switch to dark mode'}>{dark ? <Sun size={15}/> : <Moon size={15}/>}<span>{dark ? 'Light mode' : 'Dark mode'}</span></button><button className={'quiet ' + (focus ? 'selected' : '')} onClick={() => setFocus(!focus)} aria-pressed={focus}><Leaf size={15}/>{focus ? 'Show everything' : 'Focus view'}</button></div></header>
<main><div className="page-heading"><div>{view === 'Reminders' && <div className="eyebrow">A LITTLE LESS TO HOLD IN YOUR HEAD</div>}<h1>{view === 'Home' ? `Welcome, ${identityName}.` : view}</h1><p>{view === 'Home' ? (isTester ? 'Pick up where you left off. One little thing at a time.' : 'Take a look around while your beta access is locked.') : view === 'Reminders' ? 'A gentle place for the things you want to remember.' : view === 'My Stream' ? 'Plan, prepare and understand your streams in one place.' : view === 'Idea Pocket' ? 'Put it here before it disappears.' : view === 'Discord Setup' ? 'Your banners, messages and reaction roles. One step at a time.' : view === 'Connections' ? 'Your streaming platforms, together in one place.' : view === 'Account settings' ? 'Your profile, security and accessibility preferences in one place.' : 'A little support from the people you trust.'}</p></div>{isTester && view === 'My Crew' && <button className="primary" onClick={() => setCrewInviteOpen(true)}><UserPlus size={17}/> Give / Revoke access to My Crew</button>}{isTester && (['Reminders', 'Idea Pocket', 'Connections'].includes(view) || (view === 'My Stream' && streamTab === 'checklist')) && <button className="primary" onClick={() => openNewItem(kinds[view] ?? 'reminder')}><Plus size={17}/>{view === 'Idea Pocket' ? 'Save an idea' : view === 'My Stream' ? 'Add a step' : view === 'Connections' ? 'Save a channel' : 'Add a reminder'}</button>}</div>
 {error && <div className="error" role="alert">{error}<button onClick={() => setError('')} aria-label="Dismiss error"><X size={16}/></button></div>}
 {loading ? <div className="loading">B.E.I.P.I is finding your place…</div> : <>
 {view === 'Home' && !isTester && <><section className="hero beta-preview-hero"><div className="hero-copy"><span className="pill"><LockKeyhole size={14}/> PRIVATE BETA</span><h2>Your space is ready.<br />The tools are waiting.</h2><p>You can explore B.E.I.P.I.’s dashboard now. Request beta access when you’re ready to help us test the features.</p><a href="/tester" className="hero-button">Request beta access <ArrowUpRight size={17}/></a></div><div className="mascot"><Beipi /><span>Welcome aboard. ♡</span></div></section><section className="beta-preview-grid">{betaFeatures.map(({ name, copy, icon: Icon, tone }) => <a href="/tester" className="card beta-preview-card" key={name}><span className={'stat-icon ' + tone}><Icon size={20}/></span><span className="beta-preview-lock"><LockKeyhole size={13}/> Beta</span><h2>{name}</h2><p>{copy}</p><small>Request access to unlock <ChevronRight size={13}/></small></a>)}</section><section className="connection-strip beta-preview-strip"><span className="stat-icon lavender"><Sparkles size={21}/></span><div><h3>Want to help shape B.E.I.P.I.?</h3><p>Join the private beta, try new tools and send feedback directly to the development crew.</p></div><a className="outline" href="/tester">View beta access <ArrowUpRight size={16}/></a></section></>}
 {view === 'Home' && isTester && <><section className="hero"><div className="hero-copy"><span className="pill"><Sparkles size={14}/> YOUR LITTLE CO-PILOT</span><h2>You bring the stream.<br />I’ll help with the little things.</h2><p>Your tiny chaos coordinator—catching reminders,<br />stream ideas and pre-live jobs before they wander off.</p><button onClick={() => openMyStream('checklist')} className="hero-button">Let’s get stream-ready <ArrowUpRight size={17}/></button></div><div className="mascot"><Beipi /></div></section>
 <div className="stats"><button onClick={() => change('Reminders')}><span className="stat-icon lavender"><Bell size={20}/></span><div><strong>{reminders.length}</strong><span>Gentle reminders</span></div><ChevronRight size={17}/></button><button onClick={() => openMyStream('checklist')}><span className="stat-icon mint"><ClipboardCheck size={20}/></span><div><strong>{preChecked}<small> / {preChecklist.length}</small></strong><span>Pre-stream checks done</span></div><ChevronRight size={17}/></button><a href={dashboardUrl("Idea Pocket", streamTab, popout)} onClick={event => followDashboardLink(event, "Idea Pocket")}><span className="stat-icon peach"><Lightbulb size={20}/></span><div><strong>{open.filter(i => i.kind === 'idea').length}</strong><span>Ideas tucked away</span></div><ChevronRight size={17}/></a></div>
 <div className="home-grid"><section className="card"><div className="card-heading"><div><h2><Bell size={19}/> Your reminders</h2><p>No rush. Just a little nudge.</p></div><button className="text-button" onClick={() => change('Reminders')}>See all <ArrowUpRight size={15}/></button></div>{reminders.length ? rows(reminders.slice(0, 3), true) : empty('reminder')}</section><section className="card"><div className="card-heading"><div><h2><ClipboardCheck size={19}/> Before you go live</h2><p>Make a little room for a smoother start.</p></div><div className="card-heading-actions"><span className="subtle">{preChecked}/{preChecklist.length}</span><button className="text-button" disabled={busy || preChecked === 0} onClick={() => { setChecklistPhase('pre'); void resetChecklist(); }}><RotateCcw size={13}/> Reset after stream</button></div></div>{preChecklist.length ? <><div className="progress"><span style={{ width: 100 * preChecked / preChecklist.length + '%' }}/></div>{rows(preChecklist.slice(0, 4), true)}<button className="text-button bottom-link" onClick={() => openMyStream('checklist')}>Open your checklist <ArrowUpRight size={15}/></button></> : empty('checklist')}</section></div>
 <section className="connection-strip"><span className="stat-icon lavender"><Link2 size={21}/></span><div><h3>Your dashboard, taking shape.</h3><p>Your notes save here. Twitch, YouTube and Discord connections are the next step.</p></div><button className="outline" onClick={() => change('Connections')}>View connections <ArrowUpRight size={16}/></button></section></>}
 {['Reminders', 'Idea Pocket'].includes(view) && <section className="card full item-library"><div className="card-heading"><h2>{view === 'Reminders' ? 'Your little nudges' : 'Keep that thought'}</h2><div className="item-page-tools"><div className="tabs">{['open', 'done', 'all'].map(f => <button key={f} className={filter === f ? 'chosen' : ''} onClick={() => setFilter(f)}>{f === 'open' ? 'To do' : f === 'done' ? 'Done' : 'All'}</button>)}</div><div className="layout-toggle" aria-label="Choose item layout"><button className={listLayout[view as 'Reminders' | 'Idea Pocket'] === 'list' ? 'chosen' : ''} aria-label="List view" aria-pressed={listLayout[view as 'Reminders' | 'Idea Pocket'] === 'list'} onClick={() => setListLayout(current => ({ ...current, [view]: 'list' }))}><List size={17}/></button><button className={listLayout[view as 'Reminders' | 'Idea Pocket'] === 'grid' ? 'chosen' : ''} aria-label="Grid view" aria-pressed={listLayout[view as 'Reminders' | 'Idea Pocket'] === 'grid'} onClick={() => setListLayout(current => ({ ...current, [view]: 'grid' }))}><Grid2X2 size={17}/></button></div></div></div>{view === 'Reminders' && <div className="reminder-filters"><label>Priority<select value={priorityFilter} onChange={event => setPriorityFilter(event.target.value as 'all' | 'low' | 'medium' | 'high')}><option value="all">All priorities</option><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label><label>From<input type="date" value={reminderDateFrom} onChange={event => setReminderDateFrom(event.target.value)}/></label><label>To<input type="date" min={reminderDateFrom || undefined} value={reminderDateTo} onChange={event => setReminderDateTo(event.target.value)}/></label>{(priorityFilter !== 'all' || reminderDateFrom || reminderDateTo) && <button className="text-button" onClick={() => { setPriorityFilter('all'); setReminderDateFrom(''); setReminderDateTo(''); }}>Clear filters</button>}</div>}{(() => { const all = items.filter(i => i.kind === kinds[view]).sort((a, b) => view === 'Reminders' ? (a.sortOrder || 0) - (b.sortOrder || 0) : 0); const list = all.filter(i => filter === 'all' || i.done === (filter === 'done')).filter(item => view !== 'Reminders' || priorityFilter === 'all' || (item.priority || 'medium') === priorityFilter).filter(item => { if (view !== 'Reminders' || (!reminderDateFrom && !reminderDateTo)) return true; if (!item.due) return false; const date = new Date(item.due).toISOString().slice(0, 10); return (!reminderDateFrom || date >= reminderDateFrom) && (!reminderDateTo || date <= reminderDateTo); }); return list.length ? rows(list, false, listLayout[view as 'Reminders' | 'Idea Pocket'], view === 'Reminders' ? 'reminder' : null) : all.length ? <div className="empty"><Check size={28}/><h3>{priorityFilter !== 'all' || reminderDateFrom || reminderDateTo ? 'No reminders match those filters.' : filter === 'done' ? 'Nothing completed yet.' : 'You’re all caught up.'}</h3><p>{priorityFilter !== 'all' || reminderDateFrom || reminderDateTo ? 'Try changing or clearing a filter.' : 'Your saved items are still in the other tabs.'}</p></div> : empty(kinds[view]); })()}</section>}
 {view === 'My Stream' && <><nav className="discord-section-menu stream-section-menu" aria-label="My Stream sections">{[
                    { id: 'overview' as const, label: 'Overview', description: 'Your stream home at a glance.', icon: <LayoutDashboard size={22}/>, tone: 'lavender' },
                    { id: 'checklist' as const, label: 'Checklist', description: 'Get ready without holding it all in your head.', icon: <ClipboardCheck size={22}/>, tone: 'mint' },
                    { id: 'schedule' as const, label: 'Schedule', description: 'Plan streams and choose when Pip checks in.', icon: <CalendarDays size={22}/>, tone: 'lavender' },
                    { id: 'analytics' as const, label: 'Analytics', description: 'Clear insights from connected platforms.', icon: <BarChart3 size={22}/>, tone: 'gold' }
                ].map(item => <a key={item.id} href={dashboardUrl("My Stream", item.id, popout)} className={'card discord-section-button ' + (streamTab === item.id ? 'active' : '')} aria-current={streamTab === item.id ? 'page' : undefined} onClick={event => followDashboardLink(event, 'My Stream', item.id)}><span className={'stat-icon ' + item.tone}>{item.icon}</span><span><strong>{item.label}</strong><small>{item.description}</small></span><ChevronRight size={19}/></a>)}</nav>
 {streamTab === 'overview' && <><div className="stream-overview-grid"><section className="card stream-summary"><span className="stat-icon mint"><ClipboardCheck size={21}/></span><div><small>STREAM READINESS</small><h2>{readinessPercent}% ready</h2><p>{preChecked} of {preChecklist.length} pre-stream steps complete.</p><button className="text-button" onClick={() => openMyStream('checklist')}>Open checklist <ArrowUpRight size={15}/></button></div>
    {streamVisuals.readinessPie && <span className="stream-readiness-pie" aria-hidden="true" style={{ '--readiness': readinessPercent + '%' } as CSSProperties}/>}
    </section><section className="card stream-summary"><span className="stat-icon lavender"><CalendarDays size={21}/></span><div><small>NEXT STREAM</small><h2>{nextStream ? new Date(nextStream.due!).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }) : 'Nothing booked yet'}</h2><p>{nextStream ? `${new Date(nextStream.due!).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })} · ${nextStream.title}` : 'Add your next stream when you are ready.'}</p>{streamVisuals.gameArt && nextGame && <p className="stream-game-name">{nextGame}</p>}<button className="text-button" onClick={() => openMyStream('schedule')}>{nextStream ? 'Open schedule' : 'Add a stream'} <ArrowUpRight size={15}/></button></div>
    {streamVisuals.gameArt && nextGame && <StreamGameArt key={nextGame} game={nextGame}/>}
    </section></div><section className="card analytics-preview"><div><span className="eyebrow">YOUR STREAMING HOME</span><h2>Everything you need before you go live.</h2><p>Use your checklist, plan your next stream and keep the little details together in one calm space.</p></div><BeipiWriting /></section></>}
 {streamTab === 'checklist' && <section className="card full checklist-library">
  <div className="card-heading checklist-heading"><div><h2>Your stream routines</h2><p>Drag cards to arrange them. Pip saves your order automatically.</p></div><div className="layout-toggle" aria-label="Choose checklist layout"><button className={checklistLayout === 'list' ? 'chosen' : ''} aria-label="List view" aria-pressed={checklistLayout === 'list'} onClick={() => setChecklistLayout('list')}><List size={17}/></button><button className={checklistLayout === 'grid' ? 'chosen' : ''} aria-label="Grid view" aria-pressed={checklistLayout === 'grid'} onClick={() => setChecklistLayout('grid')}><Grid2X2 size={17}/></button></div></div>
  <div className="checklist-toolbar"><div className="checklist-toolbar-start"><div className="checklist-phase-tabs" role="tablist" aria-label="Checklist type"><button role="tab" aria-selected={checklistPhase === 'pre'} className={checklistPhase === 'pre' ? 'chosen' : ''} onClick={() => { setChecklistPhase('pre'); setFilter('open'); }}><ClipboardCheck size={17}/> Pre-Stream Checklist</button><button role="tab" aria-selected={checklistPhase === 'post'} className={checklistPhase === 'post' ? 'chosen' : ''} onClick={() => { setChecklistPhase('post'); setFilter('open'); }}><Sparkles size={17}/> Post Stream Checklist</button></div>
    <button type="button" className="outline stream-visual-settings-button" aria-expanded={visualSettingsOpen} aria-controls={visualSettingsOpen ? 'stream-visual-settings' : undefined} onClick={() => setVisualSettingsOpen(!visualSettingsOpen)}>
        <Settings size={16}/> Visual settings
    </button>
  </div><div className="tabs">{['open', 'done', 'all'].map(f => <button key={f} className={filter === f ? 'chosen' : ''} onClick={() => setFilter(f)}>{f === 'open' ? 'To do' : f === 'done' ? 'Done' : 'All'}</button>)}</div></div>
  {visualSettingsOpen && <fieldset id="stream-visual-settings" className="stream-visual-settings">
    <legend>My Stream overview</legend>
    <label><input type="checkbox" checked={streamVisuals.readinessPie} onChange={event => updateStreamVisual('readinessPie', event.currentTarget.checked)}/> Show readiness pie chart</label>
    <label><input type="checkbox" checked={streamVisuals.gameArt} onChange={event => updateStreamVisual('gameArt', event.currentTarget.checked)}/> Show Twitch game artwork for the next stream</label>
    <p>Artwork appears when the scheduled game name matches a Twitch category.</p>
  </fieldset>}
  {activeChecklist.length > 0 && <div className="checklist-summary"><span>{activeChecked} of {activeChecklist.length} steps complete</span><button className="text-button" disabled={busy} onClick={() => void resetChecklist()}><RotateCcw size={14}/> Reset this checklist</button></div>}
  {(() => { const list = activeChecklist.filter(i => filter === 'all' || i.done === (filter === 'done')); return list.length ? rows(list, false, checklistLayout, 'checklist') : activeChecklist.length ? <div className="empty"><Check size={28}/><h3>{filter === 'done' ? 'Nothing completed yet.' : 'You’re all caught up.'}</h3><p>Your saved steps are still in the other tabs.</p></div> : empty('checklist'); })()}
 </section>}
 {streamTab === 'schedule' && <MyCrew mode="schedule" inviteOpen={false} onInviteClose={() => undefined} initialSharedCreatorId="" items={items} busy={busy} streamingAccounts={{ twitch: twitch.connected ? twitch.user?.login || '' : '', twitchId: twitch.connected ? twitch.user?.id || '' : '', twitchDisplayName: twitch.connected ? twitch.user?.displayName || '' : '', twitchAvatarUrl: twitch.connected ? twitch.user?.profileImageUrl || '' : '', youtube: google.connected ? (google.channel?.handle || google.channel?.title || '') : '' }} onCreate={async (item) => request('POST', item)} onUpdate={async (id, item) => request('PATCH', { id, ...item })} onDelete={async (id) => { if (confirm('Delete this scheduled stream?')) await request('DELETE', undefined, id); }} onSaved={setToast}/>} 
 {streamTab === 'analytics' && <section className="card full analytics-empty"><span className="stat-icon lavender"><BarChart3 size={24}/></span><h2>Your analytics will live here.</h2><p>Once more streaming platforms are securely connected, B.E.I.P.I. will bring your recent stream performance together without making the page feel overwhelming.</p><div className="analytics-placeholders"><span /><span /><span /><span /><span /><span /></div><button className="outline" onClick={() => change('Connections')}>Manage connections <ArrowUpRight size={15}/></button></section>}</>}
 {view === 'Discord Setup' && <DiscordSetup onDirty={setDiscordDirty} popout={popout}/>}
 {view === 'Connections' && <><div className="notice"><Link2 size={20}/><div><strong>Connect the places where you create.</strong><p>Twitch, Discord and Google + YouTube have secure dashboard connections. We’ll add the remaining platforms carefully, one at a time.</p></div></div><div className="platform-grid"><section className="card platform"><span className="platform-icon twitch"><TwitchLogo /></span><span className={'status ' + (twitch.connected ? 'connected' : '')}>{twitchLoading ? 'Checking…' : twitch.connected ? 'Connected' : 'Not linked'}</span><h2>Twitch</h2><p>{twitch.connected ? <>Connected as <strong>{twitch.user?.displayName}</strong>. B.E.I.P.I. can recognise your Twitch channel.</> : 'Live alerts for PC, PlayStation and Xbox broadcasts.'}</p>{twitch.connected ? <button className="outline disconnect" disabled={busy} onClick={() => void disconnectTwitch()}>Disconnect Twitch</button> : <a className="outline platform-connect twitch-connect" href="/api/auth/twitch/start"><TwitchLogo /> Connect with Twitch</a>}<small>{twitch.connected ? `twitch.tv/${twitch.user?.login}` : 'Secure sign-in through Twitch'}</small></section><section className="card platform"><span className="platform-icon discord"><DiscordLogo /></span><span className={'status ' + (discord.connected ? 'connected' : '')}>{discordLoading ? 'Checking…' : discord.connected ? 'Connected' : 'Not linked'}</span><h2>Discord</h2><p>{discord.connected ? <>Connected as <strong>{discord.user?.displayName}</strong>. B.E.I.P.I. found {discord.guilds?.length ?? 0} server{(discord.guilds?.length ?? 0) === 1 ? '' : 's'} you can manage.</> : 'Link your Discord account and find the servers you manage.'}</p>{discord.connected ? <button className="outline disconnect" disabled={busy} onClick={() => void disconnectDiscord()}>Disconnect Discord</button> : <a className="outline platform-connect discord-connect" href="/api/auth/discord/start"><DiscordLogo /> Connect with Discord</a>}<small>{discord.connected ? `@${discord.user?.username}` : 'Secure sign-in through Discord'}</small></section><section className="card platform"><span className="platform-icon youtube"><YouTubeLogo /></span><span className={'status ' + (google.connected ? 'connected' : '')}>{googleLoading ? 'Checking…' : google.connected ? 'Connected' : 'Not linked'}</span><h2>Google + YouTube</h2><p>{google.connected ? <>Signed in as <strong>{google.user?.name}</strong>. {google.channel ? <>YouTube channel <strong>{google.channel.title}</strong> is connected.</> : 'No YouTube channel was found on this Google account.'}</> : 'Sign in with Google and connect your YouTube channel with read-only access.'}</p>{google.connected ? <button className="outline disconnect" disabled={busy} onClick={() => void disconnectGoogle()}>Disconnect Google</button> : <a className="outline platform-connect google-connect" href="/api/auth/google/start"><span>G</span> Continue with Google</a>}<small>{google.connected ? (google.channel?.handle || google.user?.email) : 'B.E.I.P.I. cannot edit or delete videos'}</small></section>{futurePlatforms.map(platform => <section className="card platform" key={platform.name}><span className={'platform-icon ' + platform.className}>{platform.mark}</span><span className="status">Coming soon</span><h2>{platform.name}</h2><p>{platform.copy}</p><button className="outline" disabled>Connect {platform.name}</button><small>{platform.note}</small></section>)}</div><section className="card full"><div className="card-heading"><h2>Saved channel references</h2><span className="subtle">Private to you</span></div>{items.some(i => i.kind === 'connection') ? rows(items.filter(i => i.kind === 'connection')) : <div className="empty"><Link2 size={26}/><h3>No channel references yet.</h3><p>Your connected accounts and saved channel notes will appear here.</p></div>}</section></>}
 {view === 'My Crew' && <MyCrew inviteOpen={crewInviteOpen} onInviteClose={() => setCrewInviteOpen(false)} initialSharedCreatorId={initialCrewSpace} items={items} busy={busy} streamingAccounts={{ twitch: twitch.connected ? twitch.user?.login || '' : '', twitchId: twitch.connected ? twitch.user?.id || '' : '', twitchDisplayName: twitch.connected ? twitch.user?.displayName || '' : '', twitchAvatarUrl: twitch.connected ? twitch.user?.profileImageUrl || '' : '', youtube: google.connected ? (google.channel?.handle || google.channel?.title || '') : '' }} onCreate={async (item) => request('POST', item)} onUpdate={async (id, item) => request('PATCH', { id, ...item })} onDelete={async (id) => { if (confirm('Delete this crew item?'))
            await request('DELETE', undefined, id); }} onSaved={setToast} onSharedItemApproved={refreshItemsAfterSharedApproval}/>} 
 {view === 'Account settings' && <><nav className="settings-category-menu" aria-label="Account settings categories"><button type="button" className={settingsTab === 'account' ? 'active' : ''} aria-current={settingsTab === 'account' ? 'page' : undefined} onClick={() => setSettingsTab('account')}><span className="stat-icon lavender"><Settings size={20}/></span><span><strong>Account</strong><small>Profile, appearance and security.</small></span><ChevronRight size={18}/></button><button type="button" className={settingsTab === 'accessibility' ? 'active' : ''} aria-current={settingsTab === 'accessibility' ? 'page' : undefined} onClick={() => setSettingsTab('accessibility')}><span className="stat-icon mint"><Accessibility size={20}/></span><span><strong>Accessibility</strong><small>Text, contrast, motion and links.</small></span><ChevronRight size={18}/></button></nav>{settingsTab === 'accessibility' ? <section className="card full accessibility-page"><section className="accessibility-settings" aria-labelledby="accessibility-title"><header><span className="stat-icon lavender"><Accessibility size={21}/></span><div><h2 id="accessibility-title">Your accessibility choices</h2><p>Make B.E.I.P.I. feel clearer and more comfortable for you. These choices stay on this device.</p></div></header>
    <div className="accessibility-text-size">
        <div className="accessibility-text-size-heading">
            <label htmlFor="dashboard-text-size"><Type size={20} aria-hidden="true"/> Font size</label>
            <output htmlFor="dashboard-text-size" aria-hidden="true">{textSize}%</output>
        </div>
        <input
            id="dashboard-text-size"
            type="range"
            min={DEFAULT_TEXT_SIZE}
            max={MAX_TEXT_SIZE}
            step={TEXT_SIZE_STEP}
            value={textSize}
            aria-valuetext={`${textSize}%${textSize === DEFAULT_TEXT_SIZE ? ' (default)' : ''}`}
            onChange={event => setTextSize(event.currentTarget.valueAsNumber)}
        />
        <div className="accessibility-text-size-range" aria-hidden="true">
            <span>{DEFAULT_TEXT_SIZE}% · Default</span>
            <span>{MAX_TEXT_SIZE}%</span>
        </div>
        <p className="accessibility-text-preview">Pick up where you left off. One little thing at a time.</p>
    </div>
    <div className="accessibility-grid"><button type="button" className={highContrast ? 'active' : ''} aria-pressed={highContrast} onClick={() => setHighContrast(!highContrast)}><Contrast size={20}/><span><strong>Higher contrast</strong><small>Strengthen text, borders and focus indicators.</small></span><Check size={17}/></button><button type="button" className={reducedMotion ? 'active' : ''} aria-pressed={reducedMotion} onClick={() => setReducedMotion(!reducedMotion)}><Leaf size={20}/><span><strong>Reduce motion</strong><small>Remove decorative movement and transitions.</small></span><Check size={17}/></button><button type="button" className={underlineLinks ? 'active' : ''} aria-pressed={underlineLinks} onClick={() => setUnderlineLinks(!underlineLinks)}><Link2 size={20}/><span><strong>Underline links</strong><small>Make links easier to distinguish from text.</small></span><Check size={17}/></button></div><button type="button" className="accessibility-reset" onClick={() => { setTextSize(DEFAULT_TEXT_SIZE); setHighContrast(false); setReducedMotion(window.matchMedia('(prefers-reduced-motion: reduce)').matches); setUnderlineLinks(false); }}><RotateCcw size={15}/> Reset accessibility choices</button></section></section> : <section className="card full account-settings"><div className="account-intro"><div className="avatar account-avatar">{identityName.slice(0, 1).toUpperCase()}</div><div><h2>{identityName}</h2><p>{username ? 'Your B.E.I.P.I. username' : isTester ? 'Private beta dashboard' : 'B.E.I.P.I. account'}</p></div></div><form className="setting-row username-setting" onSubmit={saveUsername}><div><strong>Username</strong><p>Choose the unique name people will recognise across B.E.I.P.I.</p></div><div className="username-editor"><label><span>@</span><input aria-label="B.E.I.P.I. username" value={usernameDraft} onChange={event => setUsernameDraft(event.target.value.replace(/[^A-Za-z0-9_]/g, ''))} minLength={3} maxLength={24} pattern="[A-Za-z0-9_]{3,24}" required placeholder="Your_Username"/></label><button className="outline" disabled={usernameBusy || usernameDraft === username}>{usernameBusy ? 'Saving…' : username ? 'Update' : 'Save username'}</button>{usernameError && <small role="alert">{usernameError}</small>}</div></form><fieldset className="appearance-palettes">
    <legend>Appearance</legend>
    <div className="appearance-palette-options">
        {appearancePalettes.map(option => (
            <label key={option.id}>
                <input type="radio" name="dashboard-palette" checked={palette === option.id} onChange={() => setPalette(option.id)}/>
                <span>{option.label}</span>
                <span className="appearance-swatches" aria-hidden="true">
                    {option.colours.map(colour => <span key={colour} style={{ backgroundColor: colour }}/>)}
                </span>
            </label>
        ))}
    </div>
</fieldset><div className="setting-row"><div><strong>Account access</strong><p>Your permanent B.E.I.P.I. account is connected and protecting this dashboard.</p></div><span className="status-inline connected">Connected</span></div><div className="setting-row"><div><strong>Security &amp; 2FA</strong><p>Add an authenticator app as an extra layer of account protection.</p></div><a className="outline developer-link" href="/account/security"><ShieldCheck size={15}/> Manage security</a></div>{isTester ? <div className="setting-row"><div><strong>Tester Portal</strong><p>Share feedback, report bugs and follow B.E.I.P.I.’s progress.</p></div><a className="outline developer-link" href="/tester"><MessageSquareText size={15}/> Open Tester Portal</a></div> : <div className="setting-row"><div><strong>Beta access</strong><p>Request access to unlock B.E.I.P.I.’s private testing features.</p></div><a className="outline developer-link" href="/tester"><LockKeyhole size={15}/> Request access</a></div>}{isDeveloper && <div className="setting-row"><div><strong>Developer access</strong><p>Manage accounts, tester access, connections, analytics and system health.</p></div><a className="outline developer-link" href="/developer"><ShieldCheck size={15}/> Open developer portal</a></div>}<div className="setting-row logout-row"><div><strong>Log out</strong><p>End your B.E.I.P.I. session on this device.</p></div><button className="outline logout-button" disabled={busy} onClick={() => void logOut()}><LogOut size={15}/>{busy ? 'Logging out…' : 'Log out'}</button></div></section>}</>}
 {view === 'Account settings' && settingsTab === 'accessibility' && <aside className="accessibility-contact card"><MessageSquareText size={20}/><div><strong>Is there something we could add?</strong><p>Accessibility needs are personal, and we want to keep learning. Tell us what would make B.E.I.P.I. easier for you at <a href="mailto:kickaa@beipi.app">kickaa@beipi.app</a>.</p></div></aside>}
 </>}
 <footer><span><Heart size={13}/> Made for brains with a few extra tabs open.</span><span>B.E.I.P.I · The streamer’s companion</span></footer>
 </main></div>{toast && <div className="toast" role="status">
    <Check size={17} aria-hidden="true"/>
    {toast}
 </div>}
 {toast === COMPLETION_MESSAGE && !reducedMotion && (
    <div key={completionCount} className="completion-confetti" aria-hidden="true">
        {CONFETTI_PIECES.map((style, index) => <span key={index} style={style}/>)}
    </div>
 )}
 {dialog && <div className="modal-backdrop" onClick={event => { if (event.target === event.currentTarget && !busy) setDialog(null); }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><button className="close" aria-label="Close dialog" disabled={busy} onClick={() => setDialog(null)}><X size={20}/></button><span className="stat-icon lavender">{editingItem ? <Pencil size={21}/> : <Plus size={23}/>}</span><h2 id="dialog-title">{editingItem ? `Edit ${dialog === 'idea' ? 'idea' : dialog === 'reminder' ? 'reminder' : 'entry'}.` : dialog === 'idea' ? 'Keep that thought.' : dialog === 'checklist' ? 'One little step.' : dialog === 'connection' ? 'Save a channel reference.' : 'Let’s remember this.'}</h2><p>{editingItem ? 'Change anything you need, then save it again.' : dialog === 'connection' ? 'This saves a reference, not an account connection.' : 'It’ll be here when you come back.'}</p><form key={editingItem?.id || `new-${dialog}`} onSubmit={add}><label>{dialog === 'connection' ? 'Channel or platform name' : 'What would you like to remember?'}<input name="title" maxLength={200} required autoFocus defaultValue={editingItem?.title || ''} placeholder={dialog === 'connection' ? 'Twitch · its_kickaa' : 'Give it a short, familiar name'}/></label><label>{dialog === 'connection' ? 'Channel URL or details' : 'A little more detail (optional)'}<textarea name="note" maxLength={2000} rows={3} defaultValue={editingItem?.note || ''} placeholder={dialog === 'connection' ? 'https://twitch.tv/its_kickaa' : 'Anything that will help future you…'}/></label>{['reminder', 'idea'].includes(dialog) && <label className="hex-colour-field">Card colour<div><input type="color" aria-label="Choose card colour" value={/^#[0-9A-Fa-f]{6}$/.test(itemColour) ? itemColour : '#A679C4'} onChange={event => setItemColour(event.target.value.toUpperCase())}/><input aria-label="Card colour hex value" value={itemColour} maxLength={7} pattern="#[0-9A-Fa-f]{6}" onChange={event => setItemColour(event.target.value.toUpperCase())} placeholder="#A679C4"/></div><small>Choose visually or enter a six-digit hex colour.</small></label>}{dialog === 'reminder' && <div className="modal-field-row"><label>Priority<select name="priority" defaultValue={editingItem?.priority || 'medium'}><option value="low">Low — gentle</option><option value="medium">Medium — keep nearby</option><option value="high">High — important</option></select></label><label>When? (optional)<input name="due" type="date" defaultValue={editingItem?.due ? new Date(editingItem.due).toISOString().slice(0, 10) : ''}/></label></div>}{dialog === 'checklist' && <label>Checklist<select name="checklistPhase" defaultValue={editingItem?.checklistPhase || checklistPhase}><option value="pre">Pre-Stream Checklist</option><option value="post">Post Stream Checklist</option></select></label>}<div className="modal-actions"><button type="button" className="outline" disabled={busy} onClick={() => setDialog(null)}>Cancel</button><button className="primary" disabled={busy}>{busy ? 'Saving…' : editingItem ? 'Save changes' : 'Save it for me'}<Check size={16}/></button></div>{error && <p className="form-error" role="alert">{error}</p>}</form></section></div>}
 </div>;
}

