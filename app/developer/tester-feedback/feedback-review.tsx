'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Bug, Check, ExternalLink, Filter, MessageSquareText, Save } from 'lucide-react';

const statuses = ['received', 'reviewing', 'planned', 'fixed', 'closed'] as const;
type Status = typeof statuses[number];
type FilterValue = 'open' | Status | 'all';
type ReportUpdate = { status: Status; developerResponse: string };
type Report = ReportUpdate & {
    id: string;
    kind: string;
    area: string;
    title: string;
    description: string;
    expectedResult: string;
    actualResult: string;
    severity: string;
    hasScreenshot: boolean;
    createdAt: string;
};

export default function FeedbackReview() {
    const [reports, setReports] = useState<Report[]>([]);
    const [drafts, setDrafts] = useState<Partial<Record<string, ReportUpdate>>>({});
    const [filter, setFilter] = useState<FilterValue>('open');
    const [busy, setBusy] = useState('');
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const saving = useRef(false);

    useEffect(() => {
        const controller = new AbortController();
        fetch('/api/tester-feedback', { cache: 'no-store', signal: controller.signal })
            .then(async response => {
                const data = await response.json();
                if (!response.ok) throw new Error(data.error || 'Feedback could not be loaded.');
                if (!controller.signal.aborted) setReports(data.reports || []);
            })
            .catch(error => {
                if (!controller.signal.aborted) setError(error.message);
            });
        return () => controller.abort();
    }, []);

    function edit(report: Report, changes: Partial<ReportUpdate>) {
        setDrafts(current => ({
            ...current,
            [report.id]: { status: report.status, developerResponse: report.developerResponse, ...current[report.id], ...changes },
        }));
    }

    async function save(report: Report) {
        const draft = drafts[report.id];
        if (!draft || saving.current) return;

        saving.current = true;
        setBusy(report.id);
        setError('');
        setNotice('');
        try {
            const response = await fetch('/api/tester-feedback', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: report.id, ...draft }),
            });
            const data = await response.json() as { report?: Report; error?: string };
            const saved = data.report;
            if (!response.ok || saved?.id !== report.id) {
                throw new Error(data.error || 'The report could not be updated. Try saving again.');
            }
            setReports(current => current.map(item => item.id === saved.id ? saved : item));
            setDrafts(current => {
                const next = { ...current };
                delete next[saved.id];
                return next;
            });
            setNotice(`${saved.title} saved as ${saved.status}.`);
        } catch (error) {
            setError(error instanceof Error ? error.message : 'The report could not be updated. Try saving again.');
        } finally {
            saving.current = false;
            setBusy('');
        }
    }

    const shown = reports.filter(report =>
        filter === 'all' || (filter === 'open' ? report.status !== 'fixed' && report.status !== 'closed' : report.status === filter)
    );

    return (
        <main className="developer-shell feedback-shell">
            <header className="developer-topbar">
                <a href="/developer"><ArrowLeft size={16}/> Developer portal</a>
                <span><MessageSquareText size={15}/> Tester feedback</span>
            </header>
            <div className="developer-heading">
                <div><span>FOUNDING TESTERS</span><h1>Feedback review queue</h1></div>
                <p>Turn reports into a clear trail from received to fixed.</p>
            </div>
            <div className="feedback-filters">
                <Filter size={15}/>
                {(['open', ...statuses, 'all'] as const).map(item => (
                    <button key={item} className={filter === item ? 'active' : ''} aria-pressed={filter === item} onClick={() => setFilter(item)}>{item}</button>
                ))}
            </div>
            {error && <p className="tester-error" role="alert">{error}</p>}
            {notice && <p role="status">{notice}</p>}
            <section className="feedback-review-list">
                {shown.map(report => {
                    const draft = drafts[report.id] ?? report;
                    const changed = draft.status !== report.status || draft.developerResponse !== report.developerResponse;
                    return (
                        <article className={'feedback-review-card ' + report.severity} key={report.id}>
                            <header>
                                <span className="developer-icon"><Bug size={20}/></span>
                                <div>
                                    <small>{report.kind} · {report.area} · {report.severity}</small>
                                    <h2>{report.title}</h2>
                                    <time>{new Date(report.createdAt).toLocaleString()}</time>
                                </div>
                            </header>
                            <p>{report.description}</p>
                            {report.expectedResult && <div className="feedback-compare">
                                <section><b>Expected</b><p>{report.expectedResult}</p></section>
                                <section><b>Actual</b><p>{report.actualResult || 'Not provided'}</p></section>
                            </div>}
                            {report.hasScreenshot && <a className="outline feedback-screenshot" href={'/api/tester-feedback/screenshots/' + report.id} target="_blank" rel="noopener"><ExternalLink size={14}/> View screenshot</a>}
                            <div className="feedback-review-controls">
                                <label>Status
                                    <select disabled={busy === report.id} value={draft.status} onChange={event => edit(report, { status: event.target.value as Status })}>
                                        {statuses.map(status => <option key={status} value={status}>{status}</option>)}
                                    </select>
                                    {draft.status !== report.status && <small>Saved status: {report.status}</small>}
                                </label>
                                <label>Response to tester
                                    <textarea rows={3} disabled={busy === report.id} value={draft.developerResponse} onChange={event => edit(report, { developerResponse: event.target.value })}/>
                                </label>
                                <button className="primary" disabled={Boolean(busy) || !changed} onClick={() => void save(report)}>
                                    <Save size={15}/>{busy === report.id ? 'Saving…' : 'Save update'}
                                </button>
                            </div>
                        </article>
                    );
                })}
                {!shown.length && <div className="tester-card tester-empty"><Check size={24}/> Nothing in this queue.</div>}
            </section>
        </main>
    );
}
